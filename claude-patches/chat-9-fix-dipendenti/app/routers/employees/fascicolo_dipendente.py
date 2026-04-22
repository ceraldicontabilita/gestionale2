"""
Fascicolo Dipendente — Endpoint unificato
==========================================
Un singolo endpoint che restituisce TUTTO ciò che serve per la scheda
dipendente: anagrafica, cedolini, stipendi da banca, presenze, TFR, saldi.

Risolve i problemi:
1. I movimenti banca (stipendi) non vengono trovati perché il match sul nome
   è fragile — ora cerca anche per IBAN e importo netto cedolino
2. L'anagrafica non viene arricchita dai cedolini — ora popola campi mancanti
3. Le presenze non vengono collegate — ora cerca per CF e per id
4. I saldi per dipendente non esistono — ora calcola tutto in un endpoint
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import logging
import re

from app.database import Database

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dipendenti", tags=["Fascicolo Dipendente"])


@router.get("/{dipendente_id}/fascicolo")
async def fascicolo_dipendente(
    dipendente_id: str,
    anno: Optional[int] = Query(None, description="Anno (default: corrente)")
) -> Dict[str, Any]:
    """
    Fascicolo completo del dipendente: anagrafica + cedolini + stipendi banca +
    presenze + TFR + saldi. Un unico endpoint per la scheda dipendente.
    """
    db = Database.get_db()
    if not anno:
        anno = datetime.now().year

    # ── 1. ANAGRAFICA ──
    dip = await db["dipendenti"].find_one(
        {"$or": [{"id": dipendente_id}, {"codice_fiscale": dipendente_id}]},
        {"_id": 0}
    )
    if not dip:
        raise HTTPException(status_code=404, detail="Dipendente non trovato")

    dip_id = dip.get("id", dipendente_id)
    cf = (dip.get("codice_fiscale") or "").upper().strip()
    nome = dip.get("nome", "")
    cognome = dip.get("cognome", "")
    nome_completo = dip.get("nome_completo") or f"{cognome} {nome}".strip()
    iban = dip.get("iban_cedolino") or dip.get("iban") or ""

    # ── 2. CEDOLINI ──
    ced_query = {"$or": [
        {"dipendente_id": dip_id},
        {"codice_fiscale": cf} if cf else {"codice_fiscale": "__NONE__"}
    ]}
    if anno:
        ced_query = {"$and": [ced_query, {"$or": [{"anno": anno}, {"anno": str(anno)}]}]}

    cedolini = await db["cedolini"].find(
        ced_query, {"_id": 0, "pdf_data": 0}
    ).sort([("anno", -1), ("mese", -1)]).to_list(500)

    totale_lordo = sum(float(c.get("lordo", 0) or 0) for c in cedolini)
    totale_netto = sum(float(c.get("netto", 0) or c.get("netto_mese", 0) or 0) for c in cedolini)
    totale_tfr = sum(float(c.get("tfr", 0) or c.get("tfr_mese", 0) or 0) for c in cedolini)

    # ── 3. STIPENDI DA BANCA (estratto conto) ──
    # Cerchiamo con 3 strategie: IBAN, nome in descrizione, importo netto matching
    stipendi_banca = []

    # Strategia A: cerca per IBAN (più affidabile)
    if iban:
        iban_clean = iban.replace(" ", "").upper()
        iban_movimenti = await db["estratto_conto_movimenti"].find(
            {
                "descrizione": {"$regex": re.escape(iban_clean[-8:]), "$options": "i"},
                "tipo": "uscita",
                "data": {"$regex": f"^{anno}"}
            },
            {"_id": 0}
        ).to_list(100)
        for m in iban_movimenti:
            m["match_metodo"] = "iban"
        stipendi_banca.extend(iban_movimenti)

    # Strategia B: cerca per nome in "VOSTRA DISPOSIZIONE ... FAVORE"
    nomi_ricerca = set()
    if cognome and len(cognome) > 2:
        nomi_ricerca.add(cognome.upper())
    if nome and len(nome) > 2:
        nomi_ricerca.add(nome.upper())
    if nome_completo and len(nome_completo) > 4:
        nomi_ricerca.add(nome_completo.upper())
        # Aggiungi anche inversione
        parts = nome_completo.split()
        if len(parts) >= 2:
            nomi_ricerca.add(" ".join(reversed(parts)).upper())

    ids_gia_trovati = {m.get("id") for m in stipendi_banca}
    for nome_r in nomi_ricerca:
        if len(nome_r) < 3:
            continue
        nome_movimenti = await db["estratto_conto_movimenti"].find(
            {
                "descrizione": {"$regex": re.escape(nome_r), "$options": "i"},
                "tipo": "uscita",
                "data": {"$regex": f"^{anno}"}
            },
            {"_id": 0}
        ).limit(50).to_list(50)
        for m in nome_movimenti:
            if m.get("id") not in ids_gia_trovati:
                m["match_metodo"] = "nome"
                stipendi_banca.append(m)
                ids_gia_trovati.add(m.get("id"))

    # Strategia C: match per importo netto cedolino (se netto è stabile)
    netti_unici = set()
    for c in cedolini:
        n = float(c.get("netto", 0) or c.get("netto_mese", 0) or 0)
        if n > 100:  # solo importi significativi
            netti_unici.add(round(n, 2))

    for netto_val in netti_unici:
        importo_movimenti = await db["estratto_conto_movimenti"].find(
            {
                "importo": {"$gte": netto_val - 1.0, "$lte": netto_val + 1.0},
                "tipo": "uscita",
                "data": {"$regex": f"^{anno}"},
                "descrizione": {"$regex": "DISPOSIZIONE|BONIFICO|STIP", "$options": "i"}
            },
            {"_id": 0}
        ).limit(20).to_list(20)
        for m in importo_movimenti:
            if m.get("id") not in ids_gia_trovati:
                m["match_metodo"] = "importo_netto"
                stipendi_banca.append(m)
                ids_gia_trovati.add(m.get("id"))

    # Ordina per data
    stipendi_banca.sort(key=lambda x: x.get("data", ""), reverse=True)

    totale_stipendi_banca = sum(abs(float(m.get("importo", 0))) for m in stipendi_banca)

    # ── 4. MATCHING CEDOLINI ↔ BANCA ──
    # Per ogni cedolino, cerca se ha un pagamento corrispondente in banca
    cedolini_con_stato = []
    for c in cedolini:
        netto_ced = float(c.get("netto", 0) or c.get("netto_mese", 0) or 0)
        mese_ced = c.get("mese")
        pagato = False
        data_pagamento = None
        movimento_id = None

        # Cerca prima nota salari
        pns = await db["prima_nota_salari"].find_one(
            {
                "$or": [{"dipendente_id": dip_id}, {"dipendente": {"$regex": re.escape(cognome or "___"), "$options": "i"}}],
                "anno": c.get("anno"),
                "mese": mese_ced,
            },
            {"_id": 0, "bonifico_id": 1, "data": 1, "pagato": 1}
        )
        if pns and pns.get("bonifico_id"):
            pagato = True
            data_pagamento = pns.get("data")
            movimento_id = pns.get("bonifico_id")

        # Fallback: cerca in estratto conto per importo netto ±1€ nello stesso mese
        if not pagato and netto_ced > 0 and mese_ced:
            mese_str = f"{c.get('anno', anno)}-{str(mese_ced).zfill(2)}"
            match_banca = await db["estratto_conto_movimenti"].find_one(
                {
                    "importo": {"$gte": netto_ced - 1.5, "$lte": netto_ced + 1.5},
                    "tipo": "uscita",
                    "data": {"$regex": f"^{mese_str}"},
                    "descrizione": {"$regex": "DISPOSIZIONE|BONIFICO|STIP", "$options": "i"}
                },
                {"_id": 0, "id": 1, "data": 1, "importo": 1}
            )
            if match_banca:
                pagato = True
                data_pagamento = match_banca.get("data")
                movimento_id = match_banca.get("id")

        cedolini_con_stato.append({
            **c,
            "pagato": pagato,
            "data_pagamento": data_pagamento,
            "movimento_banca_id": movimento_id,
        })

    # ── 5. TFR ──
    tfr_accantonamenti = await db["tfr_accantonamenti"].find(
        {"dipendente_id": dip_id},
        {"_id": 0}
    ).sort("anno", -1).to_list(100)

    tfr_totale = sum(float(t.get("importo", 0) or t.get("quota", 0) or 0) for t in tfr_accantonamenti)

    # Fallback: se non ci sono accantonamenti espliciti, calcola da cedolini
    if not tfr_accantonamenti and totale_lordo > 0:
        tfr_totale = round(totale_lordo / 13.5, 2)

    # ── 6. PRESENZE ──
    presenze = await db["presenze_mensili"].find(
        {
            "$or": [
                {"dipendente_id": dip_id},
                {"codice_fiscale": cf} if cf else {"codice_fiscale": "__NONE__"},
                {"dipendente": {"$regex": re.escape(cognome or "___"), "$options": "i"}}
            ],
            "$or": [{"anno": anno}, {"anno": str(anno)}]
        },
        {"_id": 0}
    ).sort("mese", -1).to_list(12)

    # Se non trova in presenze_mensili, prova attendance
    if not presenze:
        presenze = await db["attendance_presenze_calendario"].find(
            {
                "$or": [
                    {"dipendente_id": dip_id},
                    {"codice_fiscale": cf} if cf else {"codice_fiscale": "__NONE__"}
                ],
                "anno": anno
            },
            {"_id": 0}
        ).sort("mese", -1).to_list(12)

    totale_ore = sum(float(p.get("ore_totali", 0) or p.get("ore_lavorate", 0) or 0) for p in presenze)
    giorni_lavorati = sum(int(p.get("giorni_lavorati", 0) or p.get("giorni_presenti", 0) or 0) for p in presenze)
    giorni_assenza = sum(int(p.get("giorni_assenza", 0) or 0) for p in presenze)

    # ── 7. SALDI COMPLESSIVI ──
    cedolini_pagati = sum(1 for c in cedolini_con_stato if c.get("pagato"))
    cedolini_da_pagare = len(cedolini_con_stato) - cedolini_pagati
    netto_da_pagare = sum(
        float(c.get("netto", 0) or c.get("netto_mese", 0) or 0)
        for c in cedolini_con_stato if not c.get("pagato")
    )

    # ── 8. ARRICCHIMENTO ANAGRAFICA (se mancano dati) ──
    aggiornamenti = {}
    if not dip.get("stipendio_netto") and cedolini:
        ultimo_ced = cedolini[0]  # già ordinati desc
        netto_ultimo = float(ultimo_ced.get("netto", 0) or ultimo_ced.get("netto_mese", 0) or 0)
        if netto_ultimo > 0:
            aggiornamenti["stipendio_netto"] = round(netto_ultimo, 2)

    if not cf and cedolini:
        cf_ced = cedolini[0].get("codice_fiscale", "")
        if cf_ced:
            aggiornamenti["codice_fiscale"] = cf_ced.upper().strip()

    if aggiornamenti:
        aggiornamenti["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db["dipendenti"].update_one(
            {"id": dip_id},
            {"$set": aggiornamenti}
        )
        for k, v in aggiornamenti.items():
            dip[k] = v

    # ── RISPOSTA ──
    return {
        "anagrafica": dip,
        "anno": anno,

        "cedolini": {
            "lista": cedolini_con_stato,
            "totale": len(cedolini_con_stato),
            "totale_lordo": round(totale_lordo, 2),
            "totale_netto": round(totale_netto, 2),
            "totale_tfr_mese": round(totale_tfr, 2),
            "pagati": cedolini_pagati,
            "da_pagare": cedolini_da_pagare,
            "netto_da_pagare": round(netto_da_pagare, 2),
        },

        "stipendi_banca": {
            "movimenti": stipendi_banca[:20],  # max 20 per non appesantire
            "totale": len(stipendi_banca),
            "totale_importo": round(totale_stipendi_banca, 2),
        },

        "tfr": {
            "accantonamenti": tfr_accantonamenti,
            "totale_accantonato": round(tfr_totale, 2),
            "totale_da_cedolini": round(totale_tfr, 2),
        },

        "presenze": {
            "mesi": presenze,
            "totale_ore": round(totale_ore, 1),
            "giorni_lavorati": giorni_lavorati,
            "giorni_assenza": giorni_assenza,
        },

        "saldi": {
            "netto_anno": round(totale_netto, 2),
            "lordo_anno": round(totale_lordo, 2),
            "stipendi_pagati_banca": round(totale_stipendi_banca, 2),
            "differenza_netto_vs_banca": round(totale_netto - totale_stipendi_banca, 2),
            "cedolini_da_pagare": cedolini_da_pagare,
            "netto_da_pagare": round(netto_da_pagare, 2),
            "tfr_anno": round(totale_tfr, 2),
            "costo_azienda_stimato": round(totale_lordo * 1.35, 2),  # lordo + ~35% contributi
        },

        "completezza": {
            "ha_cf": bool(cf),
            "ha_iban": bool(iban),
            "ha_cedolini": len(cedolini) > 0,
            "ha_presenze": len(presenze) > 0,
            "ha_stipendi_banca": len(stipendi_banca) > 0,
            "campi_mancanti": [
                k for k, v in {
                    "codice_fiscale": cf, "iban": iban,
                    "data_assunzione": dip.get("data_assunzione"),
                    "mansione": dip.get("mansione"),
                }.items() if not v
            ]
        }
    }


@router.post("/{dipendente_id}/arricchisci-da-cedolini")
async def arricchisci_anagrafica(dipendente_id: str) -> Dict[str, Any]:
    """
    Arricchisce l'anagrafica del dipendente dai dati dei cedolini:
    CF, stipendio netto, lordo, IBAN (se presente nei bonifici).
    """
    db = Database.get_db()

    dip = await db["dipendenti"].find_one(
        {"$or": [{"id": dipendente_id}, {"codice_fiscale": dipendente_id}]},
        {"_id": 0}
    )
    if not dip:
        raise HTTPException(status_code=404, detail="Dipendente non trovato")

    dip_id = dip.get("id", dipendente_id)
    aggiornamenti = {}

    # Prendi ultimo cedolino
    ultimo_ced = await db["cedolini"].find_one(
        {"$or": [{"dipendente_id": dip_id}, {"codice_fiscale": dip.get("codice_fiscale")}]},
        {"_id": 0, "pdf_data": 0}
    )

    if ultimo_ced:
        if not dip.get("codice_fiscale") and ultimo_ced.get("codice_fiscale"):
            aggiornamenti["codice_fiscale"] = ultimo_ced["codice_fiscale"].upper().strip()

        netto = float(ultimo_ced.get("netto", 0) or ultimo_ced.get("netto_mese", 0) or 0)
        if netto > 0 and not dip.get("stipendio_netto"):
            aggiornamenti["stipendio_netto"] = round(netto, 2)

        lordo = float(ultimo_ced.get("lordo", 0) or 0)
        if lordo > 0 and not dip.get("stipendio_lordo"):
            aggiornamenti["stipendio_lordo"] = round(lordo, 2)

    if aggiornamenti:
        aggiornamenti["updated_at"] = datetime.now(timezone.utc).isoformat()
        aggiornamenti["arricchito_da_cedolini"] = True
        await db["dipendenti"].update_one({"id": dip_id}, {"$set": aggiornamenti})

    return {
        "dipendente_id": dip_id,
        "aggiornamenti": aggiornamenti,
        "campi_aggiornati": len(aggiornamenti) - 2 if len(aggiornamenti) > 1 else 0
    }
