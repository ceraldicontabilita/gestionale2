"""
Router per gestione lotti di produzione: CRUD lotti, recall, registro,
registra-produzione-lotto, genera-lotto, anteprima-codice-lotto.
"""
import re
import uuid
import json
import logging
import os
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse, Response
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(tags=["Lotti Produzione"])

# MongoDB connection (stessa logica degli altri router)
_mongo_url = os.environ.get('MONGO_URL')
_client = AsyncIOMotorClient(_mongo_url)
db = _client[os.environ.get('DB_NAME', 'azienda_erp_db')]


def _json_loads_safe(s: Optional[str]) -> list:
    """Deserializza JSON string in lista; ritorna [] se None o malformato."""
    if not s:
        return []
    try:
        return json.loads(s)
    except Exception:
        return []


def set_database(database):
    """Permette override del db dall'esterno (compatibilità)."""
    global db
    db = database


# ── Funzioni helper di lotto (rimangono qui perché usate solo da questo router) ──

PRODOTTI_IN_KG = [
    "semola", "farina", "zucchero", "sale", "lievito", "burro", "olio",
    "latte", "panna", "ricotta", "mozzarella", "pomodoro", "sugo",
    "pasta", "riso", "frutta", "verdura", "carne", "pesce", "caffè"
]


def determina_unita_misura(prodotto: str) -> str:
    """Determina l'unità di misura appropriata per un prodotto."""
    nome_lower = prodotto.lower()
    for keyword in PRODOTTI_IN_KG:
        if keyword in nome_lower:
            return "kg"
    return "pz"


def genera_abbreviazione_prodotto(prodotto: str) -> str:
    """Genera un'abbreviazione di max 10 caratteri dal nome del prodotto."""
    stop_words = {'di', 'al', 'con', 'e', 'a', 'il', 'la', 'lo', 'le', 'gli', 'da', 'in', 'su', 'per'}
    parole = [p for p in re.sub(r'[^a-zA-Z\s]', '', prodotto).upper().split() if p.lower() not in stop_words]
    if len(parole) == 1:
        return parole[0][:10]
    elif len(parole) == 2:
        return f"{parole[0][:5]}_{parole[1][:4]}"
    else:
        return "_".join([p[:4] for p in parole[:2]])[:10]


def genera_codice_lotto(prodotto: str, progressivo: int, quantita: float, unita: str, data_produzione: str) -> str:
    """Genera il codice lotto nel formato: ABBRPRODOTTO-NNN-QTAunita-DDMMYYYY"""
    abbreviazione = genera_abbreviazione_prodotto(prodotto)
    try:
        data_obj = datetime.strptime(data_produzione, "%Y-%m-%d")
        data_fmt = data_obj.strftime("%d%m%Y")
    except (ValueError, TypeError):
        data_fmt = re.sub(r'[^0-9]', '', data_produzione)
    qty_str = str(int(quantita)) if quantita == int(quantita) else str(quantita)
    return f"{abbreviazione}-{progressivo:03d}-{qty_str}{unita}-{data_fmt}"


async def get_prossimo_progressivo(prodotto: str) -> int:
    """Incrementa e restituisce il progressivo per un prodotto."""
    chiave = genera_abbreviazione_prodotto(prodotto)
    result = await db.contatori_lotti.find_one_and_update(
        {"prodotto_chiave": chiave},
        {"$inc": {"progressivo": 1}},
        upsert=True,
        return_document=True
    )
    return result.get("progressivo", 1) if result else 1


# ── CRUD Lotti ────────────────────────────────────────────────────────────────

@router.get("/lotti")
async def get_lotti(
    search: Optional[str] = Query(None),
    data_da: Optional[str] = Query(None),
    data_a: Optional[str] = Query(None)
):
    query = {}
    if search:
        query["$or"] = [
            {"prodotto": {"$regex": search, "$options": "i"}},
            {"numero_lotto": {"$regex": search, "$options": "i"}}
        ]
    if data_da or data_a:
        def to_gg_mm_yyyy(d_str):
            try:
                return datetime.strptime(d_str, "%Y-%m-%d").strftime("%d/%m/%Y")
            except Exception:
                return d_str
        date_filter = {}
        if data_da:
            date_filter["$gte"] = to_gg_mm_yyyy(data_da)
        if data_a:
            date_filter["$lte"] = to_gg_mm_yyyy(data_a)
        if date_filter:
            query["data_produzione"] = date_filter
    items = await db.lotti.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@router.get("/lotti/recall/cerca")
async def recall_lotti_per_ingrediente(
    ingrediente: str = Query(...),
    data_da: str = Query(None),
    data_a: str = Query(None),
    fornitore: str = Query(None),
    frigo: str = Query(None),
    mesi: int = Query(2, description="Quanti mesi indietro cercare (default 2)"),
    limit: int = Query(200)
):
    """Cerca tutti i lotti che contengono un determinato ingrediente (per recall ASL).
    Di default cerca solo negli ultimi 2 mesi."""
    from datetime import timedelta

    testo = ingrediente.strip()
    pattern = re.escape(testo[:60])

    # Calcola data di inizio automatica (ultimi N mesi) se non specificata dall'utente
    if not data_da:
        data_inizio = (datetime.now(timezone.utc) - timedelta(days=mesi * 31)).strftime("%d/%m/%Y")
        data_da = (datetime.now(timezone.utc) - timedelta(days=mesi * 31)).strftime("%Y-%m-%d")

    base_query = {"ingredienti_dettaglio": {"$elemMatch": {"$regex": pattern, "$options": "i"}}}
    lotti = await db.lotti.find(base_query, {"_id": 0}).sort("data_produzione", -1).limit(limit).to_list(limit)

    if not lotti:
        parole = [p for p in testo.split() if len(p) > 2][:3]
        if parole:
            pattern_corto = re.escape(" ".join(parole))
            base_query = {"ingredienti_dettaglio": {"$elemMatch": {"$regex": pattern_corto, "$options": "i"}}}
            lotti = await db.lotti.find(base_query, {"_id": 0}).sort("data_produzione", -1).limit(limit).to_list(limit)

    def parse_data(d_str):
        if not d_str:
            return None
        try:
            fmt = "%d/%m/%Y" if "/" in d_str else "%Y-%m-%d"
            return datetime.strptime(d_str, fmt).date()
        except Exception:
            return None

    dt_da = parse_data(data_da)
    dt_a = parse_data(data_a)
    risultati = []
    for lotto in lotti:
        if dt_da or dt_a:
            dt_lotto = parse_data(lotto.get("data_produzione", ""))
            if dt_lotto:
                if dt_da and dt_lotto < dt_da:
                    continue
                if dt_a and dt_lotto > dt_a:
                    continue
        if frigo and frigo.strip():
            if frigo.strip().lower() not in (lotto.get("frigo_numero") or "").lower():
                continue
        ing_match = [
            ing for ing in (lotto.get("ingredienti_dettaglio") or [])
            if testo.lower()[:30] in ing.lower() or any(
                p.lower() in ing.lower() for p in testo.split()[:3] if len(p) > 3
            )
        ]
        fornitore_estratto = ""
        if ing_match:
            parti = ing_match[0].split(" - ")
            if len(parti) >= 2:
                fornitore_estratto = parti[1].split(" n°")[0].strip()
        if fornitore and fornitore.strip():
            testo_cerca = (fornitore_estratto + " " + " ".join(lotto.get("ingredienti_dettaglio") or [])).lower()
            if fornitore.strip().lower() not in testo_cerca:
                continue
        risultati.append({
            "id": lotto.get("id"),
            "prodotto": lotto.get("prodotto"),
            "numero_lotto": lotto.get("numero_lotto"),
            "data_produzione": lotto.get("data_produzione"),
            "data_scadenza": lotto.get("data_scadenza"),
            "quantita": lotto.get("quantita"),
            "unita_misura": lotto.get("unita_misura"),
            "allergeni_testo": lotto.get("allergeni_testo"),
            "frigo_numero": lotto.get("frigo_numero", ""),
            "ingrediente_trovato": ing_match[0] if ing_match else testo,
            "fornitore": fornitore_estratto,
            "tracciato_via_componente": False
        })

    # Cerca anche nei lotti_componenti[] (tracciabilità indiretta)
    componenti_query = {"lotti_componenti.lotto_id": {"$exists": True}}
    lotti_con_comp = await db.lotti.find(componenti_query, {"_id": 0,
        "id": 1, "prodotto": 1, "numero_lotto": 1, "data_produzione": 1,
        "data_scadenza": 1, "quantita": 1, "unita_misura": 1, "frigo_numero": 1,
        "lotti_componenti": 1}).limit(limit).to_list(limit)
    ids_gia_trovati = {r["id"] for r in risultati if r.get("id")}
    for lotto in lotti_con_comp:
        if lotto.get("id") in ids_gia_trovati:
            continue
        componenti = lotto.get("lotti_componenti") or []
        match_comp = [c for c in componenti if testo.lower() in (c.get("nome") or "").lower()
                      or testo.lower() in (c.get("numero_lotto") or "").lower()]
        if not match_comp:
            continue
        risultati.append({
            "id": lotto.get("id"),
            "prodotto": lotto.get("prodotto"),
            "numero_lotto": lotto.get("numero_lotto"),
            "data_produzione": lotto.get("data_produzione"),
            "data_scadenza": lotto.get("data_scadenza"),
            "quantita": lotto.get("quantita"),
            "unita_misura": lotto.get("unita_misura"),
            "allergeni_testo": "",
            "frigo_numero": lotto.get("frigo_numero", ""),
            "ingrediente_trovato": match_comp[0].get("nome", testo),
            "fornitore": "",
            "tracciato_via_componente": True
        })

    return {"ingrediente_cercato": testo, "totale_lotti": len(risultati), "lotti": risultati}


@router.get("/lotti/{lotto_id}")
async def get_lotto(lotto_id: str):
    item = await db.lotti.find_one({"id": lotto_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Lotto non trovato")
    return item


@router.delete("/lotti/{lotto_id}")
async def delete_lotto(lotto_id: str):
    result = await db.lotti.delete_one({"$or": [{"id": lotto_id}, {"lotto_id": lotto_id}]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lotto non trovato")
    return {"message": "Eliminato con successo"}


@router.patch("/lotti/{lotto_id}/consuma")
async def marca_lotto_consumato(lotto_id: str):
    """Marca il lotto come consumato/esaurito senza eliminarlo dal registro storico."""
    result = await db.lotti.update_one(
        {"$or": [{"id": lotto_id}, {"lotto_id": lotto_id}]},
        {"$set": {
            "consumato": True,
            "data_consumo": datetime.now(timezone.utc).isoformat(),
            "quantita": 0
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lotto non trovato")
    return {"message": "Lotto marcato come consumato"}


@router.patch("/lotti/{lotto_id}/smalti")
async def smalti_lotto(lotto_id: str, motivo: str = "smaltito_scaduto", note: str = ""):
    """
    Smaltisce formalmente un lotto scaduto o non conforme.
    Cambia stato in 'smaltito' e registra data + motivo per la tracciabilità HACCP.
    Reg. CE 852/2004 — obbligo di documentare lo smaltimento.
    """
    result = await db.lotti.update_one(
        {"$or": [{"id": lotto_id}, {"lotto_id": lotto_id}]},
        {"$set": {
            "stato": "smaltito",
            "motivo_smaltimento": motivo,
            "note_smaltimento": note,
            "data_smaltimento": datetime.now(timezone.utc).isoformat(),
            "smaltito_da": "operatore",
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lotto non trovato")
    return {"status": "ok", "lotto_id": lotto_id, "motivo": motivo}


@router.post("/lotti/smalti-batch")
async def smalti_batch_lotti(payload: dict, motivo: str = "smaltito_scaduto"):
    """
    Smaltisce in batch i lotti IDs forniti.
    Body: {"ids": ["id1", "id2", ...]}
    Aggiunge campo 'stato: smaltito' anche ai lotti che non lo avevano.
    """
    lotti_ids = payload.get("ids", [])
    if not lotti_ids:
        return {"smaltiti": 0}
    result = await db.lotti.update_many(
        {"id": {"$in": lotti_ids}},
        {"$set": {
            "stato": "smaltito",
            "motivo_smaltimento": motivo,
            "data_smaltimento": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"smaltiti": result.modified_count}


# ── Anteprima codice lotto ────────────────────────────────────────────────────

@router.get("/anteprima-codice-lotto/{prodotto}")
async def anteprima_codice_lotto(
    prodotto: str,
    quantita: float = Query(1),
    unita_misura: str = Query(None),
    data_produzione: str = Query(...)
):
    """Genera un'anteprima del codice lotto SENZA salvare."""
    if not unita_misura:
        unita_misura = determina_unita_misura(prodotto)
    chiave = genera_abbreviazione_prodotto(prodotto)
    contatore = await db.contatori_lotti.find_one({"prodotto_chiave": chiave}, {"_id": 0})
    prossimo = (contatore.get("progressivo", 0) if contatore else 0) + 1
    codice_lotto = genera_codice_lotto(prodotto, prossimo, quantita, unita_misura, data_produzione)
    abbreviazione = genera_abbreviazione_prodotto(prodotto)
    return {
        "codice_lotto": codice_lotto,
        "abbreviazione": abbreviazione,
        "progressivo": prossimo,
        "quantita": quantita,
        "unita_misura": unita_misura,
        "formato": f"{abbreviazione}-{prossimo:03d}-{int(quantita) if quantita == int(quantita) else quantita}{unita_misura}-DDMMYYYY"
    }


# ── Unità di misura ───────────────────────────────────────────────────────────

@router.get("/unita-misura/{prodotto}")
async def get_unita_misura(prodotto: str):
    unita = determina_unita_misura(prodotto)
    return {"prodotto": prodotto, "unita_misura": unita}


@router.get("/prodotti-in-kg")
async def get_prodotti_in_kg():
    return {"prodotti": PRODOTTI_IN_KG}


# ── Scala lotti fornitori (FIFO) ──────────────────────────────────────────────

async def scala_lotti_fornitori_per_ricetta(ricetta: dict, moltiplicatore: float, numero_lotto_produzione: str) -> dict:
    """Scala automaticamente i lotti fornitori per ogni ingrediente (FIFO)."""
    ingredienti_dettaglio = ricetta.get("ingredienti_dettaglio", [])
    lotti_scalati = []
    lotti_esauriti = []
    ingredienti_non_trovati = []

    for ing in ingredienti_dettaglio:
        nome_ing = ing.get("nome", "").strip()
        if not nome_ing:
            continue
        try:
            quantita_base = float(str(ing.get("quantita", 0) or 0).replace(",", "."))
        except (ValueError, TypeError):
            continue
        if quantita_base <= 0:
            continue
        unita = ing.get("unita_misura") or ing.get("unita", "g")
        quantita_scalata = quantita_base * moltiplicatore

        nome_norm = nome_ing.lower().strip()
        parole = nome_norm.split()
        search_patterns = [nome_norm]
        if len(parole) >= 2:
            search_patterns.append(" ".join(parole[:2]))
        if len(parole) >= 1:
            search_patterns.append(parole[0])

        # MODIFICA 3 — Step 0: cerca aliases nel dizionario per allargare la ricerca FIFO
        try:
            diz_entry = await db.dizionario_prodotti.find_one(
                {"$or": [
                    {"nome_normalizzato": {"$regex": re.escape(nome_norm[:20]), "$options": "i"}},
                    {"aliases": {"$elemMatch": {"$regex": re.escape(nome_norm[:20]), "$options": "i"}}}
                ]},
                {"_id": 0, "aliases": 1, "nome_normalizzato": 1}
            )
            if diz_entry:
                for alias in (diz_entry.get("aliases") or []):
                    alias_parole = alias.split()
                    if alias_parole:
                        p = " ".join(alias_parole[:2])
                        if p not in search_patterns and len(p) >= 3:
                            search_patterns.append(p)
        except Exception:
            pass

        lotti_candidati = []
        for pattern in search_patterns:
            if len(pattern) < 3:
                continue
            lotti_trovati = await db.lotti_fornitori.find(
                {"esaurito": False, "quantita_disponibile": {"$gt": 0},
                 "prodotto_nome_norm": {"$regex": re.escape(pattern), "$options": "i"}},
                {"_id": 0}
            ).sort("data_scadenza", 1).to_list(20)
            for lotto_f in lotti_trovati:
                if not any(x["id"] == lotto_f["id"] for x in lotti_candidati):
                    lotti_candidati.append(lotto_f)
            if lotti_candidati:
                break

        if not lotti_candidati:
            ingredienti_non_trovati.append(nome_ing)
            continue

        quantita_rimasta = quantita_scalata
        for lotto in lotti_candidati:
            if quantita_rimasta <= 0:
                break
            qt_lotto_disp = float(lotto.get("quantita_disponibile", 0) or 0)
            unita_lotto = lotto.get("unita_misura", "PZ").upper()
            if unita_lotto in ("PZ", "CF", "CONF") and unita.lower() in ("pz", "pezzi", "cf"):
                qt_da_consumare = min(qt_lotto_disp, quantita_rimasta)
            elif unita_lotto == "KG" and unita.lower() in ("kg", "lt", "l"):
                qt_da_consumare = min(qt_lotto_disp, quantita_rimasta)
            elif unita_lotto == "KG" and unita.lower() in ("g", "ml"):
                qt_kg = quantita_rimasta / 1000
                qt_da_consumare = min(qt_lotto_disp, qt_kg)
            else:
                qt_da_consumare = min(qt_lotto_disp, quantita_rimasta)
            qt_nuova = max(0, qt_lotto_disp - qt_da_consumare)
            esaurito = qt_nuova <= 0.001
            await db.lotti_fornitori.update_one(
                {"id": lotto["id"]},
                {"$set": {
                    "quantita_disponibile": round(qt_nuova, 3),
                    "esaurito": esaurito,
                    "ultimo_utilizzo": datetime.now(timezone.utc).isoformat(),
                    "ricetta_ultimo_utilizzo": ricetta.get("nome", "")
                },
                "$push": {"storico_utilizzi": {
                    "data": datetime.now(timezone.utc).isoformat(),
                    "quantita_usata": round(qt_da_consumare, 3),
                    "ricetta": ricetta.get("nome", ""),
                    "lotto_produzione": numero_lotto_produzione,
                    "quantita_rimasta": round(qt_nuova, 3)
                }}}
            )
            lotti_scalati.append({
                "ingrediente": nome_ing,
                "lotto_id": lotto["id"],
                "lotto_id_fornitore": lotto.get("lotto_id_fornitore", ""),
                "fornitore": lotto.get("fornitore", ""),
                "prodotto": lotto.get("prodotto_nome", ""),
                "quantita_consumata": round(qt_da_consumare, 3),
                "quantita_rimasta": round(qt_nuova, 3),
                "unita": unita_lotto,
                "esaurito": esaurito
            })
            if esaurito:
                lotti_esauriti.append({"lotto_id": lotto["id"], "prodotto": lotto.get("prodotto_nome", ""), "fornitore": lotto.get("fornitore", "")})
            if unita_lotto == "KG" and unita.lower() in ("g", "ml"):
                quantita_rimasta -= qt_da_consumare * 1000
            else:
                quantita_rimasta -= qt_da_consumare

    return {"lotti_scalati": lotti_scalati, "lotti_esauriti": lotti_esauriti, "ingredienti_non_trovati": ingredienti_non_trovati}


# ── Registra produzione e crea lotto ─────────────────────────────────────────

@router.post("/registra-produzione-lotto")
async def registra_produzione_e_crea_lotto(
    ricetta_id: str = Query(...),
    pezzi: int = Query(...),
    pezzi_base: int = Query(...),
    costo_totale: float = Query(...),
    data_produzione: str = Query(...),
    frigo_numero: str = Query(None),
    lotti_componenti_json: Optional[str] = Query(None)  # JSON: [{lotto_id, numero_lotto, nome, quantita_usata, unita}]
):
    """
    Registra una produzione e:
    1. Salva l'evento nella collection produzioni
    2. Scala i lotti fornitori in modo FIFO
    3. Crea un lotto di produzione
    """
    ricetta = await db.ricette.find_one({"id": ricetta_id}, {"_id": 0})
    if not ricetta:
        raise HTTPException(status_code=404, detail=f"Ricetta con id '{ricetta_id}' non trovata")

    try:
        dt = datetime.strptime(data_produzione, "%Y-%m-%d")
        data_fmt = dt.strftime("%d/%m/%Y")
    except (ValueError, TypeError):
        data_fmt = data_produzione

    porzioni_base = float(ricetta.get("porzioni", pezzi_base) or pezzi_base)
    moltiplicatore = pezzi / porzioni_base if porzioni_base > 0 else 1

    # Scala lotti fornitori
    lotti_info = await scala_lotti_fornitori_per_ricetta(ricetta, moltiplicatore, "TEMP")

    # Genera lotto
    progressivo = await get_prossimo_progressivo(ricetta["nome"])
    unita = determina_unita_misura(ricetta["nome"])
    numero_lotto = genera_codice_lotto(ricetta["nome"], progressivo, pezzi, unita, data_produzione)

    # Aggiorna numero lotto nei lotti scalati
    for ls in lotti_info["lotti_scalati"]:
        await db.lotti_fornitori.update_one(
            {"id": ls["lotto_id"]},
            {"$set": {"ricetta_ultimo_utilizzo": ricetta["nome"]}}
        )

    from app.routers.tracciabilita.utils import _calcola_scadenza, _rileva_allergeni

    # Calcola scadenza dalla deperibilità degli ingredienti
    ingredienti_nomi = [ing.get("nome", "") for ing in ricetta.get("ingredienti_dettaglio", [])]
    if not ingredienti_nomi:
        ingredienti_nomi = ricetta.get("ingredienti", [])
    scad_info = _calcola_scadenza(ingredienti_nomi, data_produzione)
    data_scad_frigo = scad_info[0]  # formato "dd/mm/yyyy"
    data_scad_abb = scad_info[1]
    ing_critico = scad_info[2]
    giorni_frigo = scad_info[3]
    mesi_abb = scad_info[5]

    allergeni_info = _rileva_allergeni(ingredienti_nomi)

    lotto_doc = {
        "id": str(uuid.uuid4()),
        "prodotto": ricetta["nome"],
        "ingredienti_dettaglio": [ing.get("nome", "") for ing in ricetta.get("ingredienti_dettaglio", [])],
        "data_produzione": data_fmt,
        "data_scadenza": data_scad_frigo,
        "numero_lotto": numero_lotto,
        "etichetta": f"{ricetta['nome']} - prodotto il giorno {data_fmt}",
        "quantita": pezzi,
        "unita_misura": unita,
        "costo_totale": costo_totale,
        "costo_pezzo": round(costo_totale / pezzi, 4) if pezzi > 0 else 0,
        "progressivo": progressivo,
        "frigo_numero": frigo_numero or "",
        "lotti_fornitori": lotti_info,
        "scadenza_abbattuto": data_scad_abb,
        "mesi_abbattuto": mesi_abb,
        "ingrediente_critico": ing_critico,
        "conservazione_note": f"Frigo (0-4°C): {giorni_frigo} giorni | Abbattuto (-18°C): {mesi_abb} mesi",
        "allergeni_testo": allergeni_info.get("testo_etichetta", ""),
        "allergeni_presenti": allergeni_info.get("allergeni_presenti", []),
        "lotti_componenti": _json_loads_safe(lotti_componenti_json),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.lotti.insert_one(lotto_doc)
    lotto_doc.pop("_id", None)

    # Salva evento produzione
    await db.produzioni.insert_one({
        "id": str(uuid.uuid4()),
        "ricetta_id": ricetta_id,
        "ricetta_nome": ricetta["nome"],
        "pezzi": pezzi,
        "data": data_fmt,
        "data_iso": data_produzione,
        "costo_totale": costo_totale,
        "costo_pezzo": round(costo_totale / pezzi, 4) if pezzi > 0 else 0,
        "numero_lotto": numero_lotto,
        "lotti_fornitori_scalati": len(lotti_info["lotti_scalati"]),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    return lotto_doc


# ── Genera lotto da ricetta (legacy) ─────────────────────────────────────────

@router.post("/genera-lotto/{ricetta_nome}")
async def genera_lotto_da_ricetta(
    ricetta_nome: str,
    data_produzione: str = Query(...),
    data_scadenza: str = Query(None),
    quantita: float = Query(1),
    unita_misura: str = Query(None),
    frigo_numero: str = Query(None)
):
    from app.routers.tracciabilita.utils import _calcola_scadenza, _rileva_allergeni

    ricetta = await db.ricette.find_one({"nome": {"$regex": f"^{ricetta_nome}$", "$options": "i"}}, {"_id": 0})
    if not ricetta:
        raise HTTPException(status_code=404, detail=f"Ricetta '{ricetta_nome}' non trovata")

    ingredienti_base = []
    if ricetta.get("ricetta_base_id"):
        base = await db.ricette.find_one({"id": ricetta["ricetta_base_id"]}, {"_id": 0})
        if base:
            ingredienti_base = base.get("ingredienti", [])
    ingredienti_variante = ricetta.get("ingredienti", [])
    if ingredienti_base:
        nomi_base_lower = {i.lower() for i in ingredienti_base}
        extra = [i for i in ingredienti_variante if i.lower() not in nomi_base_lower]
        ingredienti_totali = ingredienti_base + extra
    else:
        ingredienti_totali = ingredienti_variante

    if not unita_misura:
        unita_misura = determina_unita_misura(ricetta["nome"])

    fornitori_esclusi_docs = await db.fornitori.find({"escluso": True}, {"_id": 0}).to_list(1000)
    nomi_esclusi = [f["nome"] for f in fornitori_esclusi_docs]

    ingredienti_dettaglio = []
    ingredienti_per_scadenza = []
    for ingrediente in ingredienti_totali:
        query = {"materia_prima": {"$regex": ingrediente, "$options": "i"}}
        if nomi_esclusi:
            query["azienda"] = {"$nin": nomi_esclusi}
        materia = await db.materie_prime.find_one(query, {"_id": 0})
        if materia and materia.get("descrizione_completa"):
            ingredienti_dettaglio.append(materia["descrizione_completa"])
            ingredienti_per_scadenza.append(materia.get("materia_prima", ingrediente))
        else:
            ingredienti_dettaglio.append(ingrediente)
            ingredienti_per_scadenza.append(ingrediente)

    allergeni_info = _rileva_allergeni(ingredienti_per_scadenza + ingredienti_dettaglio)
    scadenza_info = _calcola_scadenza(ingredienti_per_scadenza, data_produzione)
    data_scad_frigo, data_scad_abb, ing_critico, giorni_frigo, giorni_abb, mesi_abb = scadenza_info

    if not data_scadenza:
        data_scadenza = data_scad_frigo

    progressivo = await get_prossimo_progressivo(ricetta["nome"])
    numero_lotto = genera_codice_lotto(ricetta["nome"], progressivo, quantita, unita_misura, data_produzione)

    try:
        data_obj = datetime.strptime(data_produzione, "%Y-%m-%d")
        data_formattata = data_obj.strftime("%d/%m/%Y")
    except (ValueError, TypeError):
        data_formattata = data_produzione

    lotto_id = str(uuid.uuid4())
    lotto_doc = {
        "id": lotto_id,
        "prodotto": ricetta["nome"],
        "ingredienti_dettaglio": ingredienti_dettaglio,
        "data_produzione": data_formattata,
        "data_scadenza": data_scadenza,
        "numero_lotto": numero_lotto,
        "etichetta": f"{ricetta['nome']} - prodotto il giorno {data_formattata}",
        "quantita": quantita,
        "unita_misura": unita_misura,
        "scadenza_abbattuto": data_scad_abb,
        "mesi_abbattuto": mesi_abb,
        "ingrediente_critico": ing_critico,
        "conservazione_note": f"Frigo (0-4°C): {giorni_frigo} giorni | Abbattuto (-18°C): {mesi_abb} mesi",
        "frigo_numero": frigo_numero or "",
        "allergeni": allergeni_info["allergeni_presenti"],
        "allergeni_testo": allergeni_info["testo_etichetta"],
        "progressivo": progressivo,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.lotti.insert_one(lotto_doc)
    lotto_doc.pop("_id", None)
    return lotto_doc


# ── Registro lotti mensile HTML ──────────────────────────────────────────────

MESI_ITALIANO = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
                 "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"]


@router.get("/registro-lotti/{anno}/{mese}", response_class=HTMLResponse)
async def get_registro_lotti_mensile(anno: int, mese: int):
    mese_str = f"/{mese:02d}/{anno}"
    lotti = await db.lotti.find(
        {"data_produzione": {"$regex": mese_str}}, {"_id": 0}
    ).sort("created_at", 1).to_list(10000)

    totale_lotti = len(lotti)
    prodotti_unici = len(set(item.get("prodotto", "") for item in lotti))
    con_allergeni = sum(1 for item in lotti if item.get("allergeni"))

    rows = ""
    for i, lotto in enumerate(lotti, 1):
        numero_lotto = lotto.get("numero_lotto", "N/A")
        prodotto = lotto.get("prodotto", "N/A")
        data_prod = lotto.get("data_produzione", "N/A")
        data_scad = lotto.get("data_scadenza", "N/A")
        if data_scad and "-" in str(data_scad):
            try:
                data_scad = datetime.fromisoformat(str(data_scad).replace("Z", "")).strftime("%d/%m/%Y")
            except Exception:
                pass
        quantita = f"{lotto.get('quantita', '')} {lotto.get('unita_misura', '')}"
        ingredienti = lotto.get("ingredienti_dettaglio", [])
        ing_text = ", ".join([str(x)[:30] for x in ingredienti[:3]])
        if len(ingredienti) > 3:
            ing_text += f" (+{len(ingredienti)-3} altri)"
        allergeni = lotto.get("allergeni", [])
        allergeni_html = (
            f'<span style="background:#ffebee;color:#c62828;padding:2px 5px;border-radius:3px;font-size:7pt;font-weight:bold;">'
            f'{", ".join([a.upper()[:10] for a in allergeni])}</span>'
            if allergeni else '<span style="color:#999;">Nessuno</span>'
        )
        conservazione = "Frigo 0-4°C" if "frigo" in str(lotto.get("conservazione_note", "")).lower() else "Ambiente"
        rows += f"""<tr>
            <td style="text-align:center"><strong>{i}</strong></td>
            <td><span style="font-family:monospace;font-size:7pt;background:#e0e0e0;padding:2px 5px;border-radius:3px">{numero_lotto[:25]}</span></td>
            <td><strong>{prodotto[:25]}</strong></td>
            <td style="white-space:nowrap">{data_prod}</td>
            <td style="white-space:nowrap">{data_scad}</td>
            <td style="text-align:center">{quantita}</td>
            <td style="font-size:7pt">{ing_text[:60]}</td>
            <td>{allergeni_html}</td>
            <td style="font-size:8pt">{conservazione}</td>
        </tr>"""

    if not lotti:
        rows = '<tr><td colspan="9" style="text-align:center;padding:30px;color:#999;">Nessun lotto registrato per questo mese</td></tr>'

    return HTMLResponse(content=f"""<!DOCTYPE html><html lang="it"><head>
<meta charset="UTF-8">
<title>Registro Lotti - {MESI_ITALIANO[mese-1]} {anno}</title>
<style>
@page {{ size: A4; margin: 12mm; }}
@media print {{ .no-print {{ display: none; }} }}
body {{ font-family: Arial, sans-serif; font-size: 10pt; color: #333; }}
.header {{ border: 2px solid #1565c0; padding: 20px; margin-bottom: 20px; background: #e3f2fd; border-radius: 8px; }}
.header h1 {{ color: #0d47a1; margin: 0; font-size: 20pt; text-align: center; }}
.stats {{ display: flex; justify-content: space-around; background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0; }}
.stat {{ text-align: center; }}
.stat-v {{ font-size: 24pt; font-weight: bold; color: #2e7d32; }}
table {{ width: 100%; border-collapse: collapse; font-size: 8pt; }}
th {{ background: #1565c0; color: white; padding: 8px 5px; text-align: left; }}
td {{ border: 1px solid #ddd; padding: 6px 5px; vertical-align: top; }}
tr:nth-child(even) {{ background: #f5f5f5; }}
.btn {{ padding: 12px 30px; font-size: 14pt; background: #1565c0; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }}
</style></head><body>
<div class="header">
<h1>REGISTRO DEI LOTTI DI PRODUZIONE</h1>
<p style="text-align:center"><strong>CERALDI GROUP S.R.L.</strong> - Piazza Carità 14, 80134 Napoli</p>
<p style="text-align:center">Periodo: <strong>{MESI_ITALIANO[mese-1].upper()} {anno}</strong> | Generato il: {datetime.now().strftime('%d/%m/%Y ore %H:%M')}</p>
</div>
<div class="stats">
<div class="stat"><div class="stat-v">{totale_lotti}</div><div>LOTTI REGISTRATI</div></div>
<div class="stat"><div class="stat-v">{prodotti_unici}</div><div>PRODOTTI DIVERSI</div></div>
<div class="stat"><div class="stat-v">{con_allergeni}</div><div>CON ALLERGENI</div></div>
</div>
<div class="no-print" style="text-align:center;margin:20px 0">
<button onclick="window.print()" class="btn">Stampa / Salva PDF</button>
<a href="/api/registro-lotti/{anno}/{mese}/csv" class="btn" style="text-decoration:none">Scarica CSV</a>
</div>
<table><thead><tr>
<th>N°</th><th>NUMERO LOTTO</th><th>PRODOTTO</th><th>DATA PROD.</th>
<th>DATA SCAD.</th><th>QTÀ</th><th>INGREDIENTI</th><th>ALLERGENI</th><th>CONSERVAZIONE</th>
</tr></thead><tbody>{rows}</tbody></table>
<div style="margin-top:30px;text-align:center;font-size:8pt;color:#999;border-top:1px solid #ddd;padding-top:10px">
<p>Conforme a Reg. (CE) 178/2002 | Conservare per almeno 5 anni</p></div>
</body></html>""")


@router.get("/registro-lotti/{anno}/{mese}/csv")
async def get_registro_lotti_csv(anno: int, mese: int):
    mese_str = f"/{mese:02d}/{anno}"
    lotti = await db.lotti.find({"data_produzione": {"$regex": mese_str}}, {"_id": 0}).sort("created_at", 1).to_list(10000)
    lines = ["N°;Numero Lotto;Prodotto;Data Produzione;Data Scadenza;Quantità;Unità;Ingredienti;Allergeni"]
    for i, row in enumerate(lotti, 1):
        ingredienti = row.get("ingredienti_dettaglio", [])
        ing_str = ", ".join([str(x)[:30] for x in ingredienti[:5]]).replace(";", ",")
        allergeni = ", ".join(row.get("allergeni", [])).replace(";", ",")
        lines.append(f'{i};"{row.get("numero_lotto","").replace(";",",")}";"{row.get("prodotto","").replace(";",",")}";"{row.get("data_produzione","")}";"{row.get("data_scadenza","")}";{row.get("quantita","")};"{row.get("unita_misura","")}";"{ing_str}";"{allergeni}"')
    return Response(
        content="\n".join(lines).encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="registro_lotti_{anno}_{mese:02d}.csv"'}
    )


@router.get("/registro-lotti/{anno}", response_class=HTMLResponse)
async def get_registro_lotti_annuale(anno: int):
    lotti = await db.lotti.find({"data_produzione": {"$regex": f"/{anno}$"}}, {"_id": 0}).sort("created_at", 1).to_list(50000)
    lotti_per_mese = {}
    for lotto_a in lotti:
        data_prod = lotto_a.get("data_produzione", "")
        if "/" in data_prod:
            parti = data_prod.split("/")
            if len(parti) >= 2:
                mese = int(parti[1])
                lotti_per_mese.setdefault(mese, []).append(lotto_a)
    righe = ""
    totale_anno = 0
    for mese in range(1, 13):
        lotti_mese = lotti_per_mese.get(mese, [])
        n = len(lotti_mese)
        totale_anno += n
        unici = len(set(item.get("prodotto", "") for item in lotti_mese))
        righe += f"""<tr><td><strong>{MESI_ITALIANO[mese-1]}</strong></td><td>{n}</td><td>{unici}</td>
        <td><a href="/api/registro-lotti/{anno}/{mese}" target="_blank" style="color:#1565c0;font-weight:bold">Dettaglio</a></td></tr>"""
    righe += f'<tr style="background:#e8f5e9;font-weight:bold"><td>TOTALE ANNO</td><td>{totale_anno}</td><td>{len(set(item.get("prodotto","") for item in lotti))}</td><td>-</td></tr>'
    return HTMLResponse(content=f"""<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
<title>Registro Lotti Annuale - {anno}</title>
<style>body{{font-family:Arial,sans-serif;font-size:10pt;max-width:800px;margin:30px auto;padding:20px}}
h1{{color:#1565c0}}table{{width:100%;border-collapse:collapse;margin:20px 0}}
th{{background:#1565c0;color:white;padding:10px}}td{{border:1px solid #ddd;padding:8px;text-align:center}}</style>
</head><body><h1>REGISTRO LOTTI ANNUALE - {anno}</h1>
<p><strong>CERALDI GROUP S.R.L.</strong> - Piazza Carità 14, 80134 Napoli</p>
<button onclick="window.print()" style="padding:10px 25px;background:#1565c0;color:white;border:none;border-radius:5px;cursor:pointer;margin:10px 0">Stampa</button>
<table><tr><th>MESE</th><th>LOTTI</th><th>PRODOTTI DISTINTI</th><th>AZIONE</th></tr>{righe}</table>
<p style="color:#999;font-size:9pt;margin-top:20px">Conforme a Reg. (CE) 178/2002</p></body></html>""")



@router.post("/lotti/ricalcola-tracciabilita")
async def ricalcola_tracciabilita_lotti(solo_mancanti: bool = True):
    """
    Ricalcola lotti_scalati per i lotti di produzione che non hanno tracciabilità.
    Se solo_mancanti=True (default) processa solo quelli senza lotti_scalati.
    Chiamato dopo la creazione manuale di un lotto o come manutenzione.
    """
    query = {"$or": [
        {"lotti_fornitori": {"$exists": False}},
        {"lotti_fornitori": None},
        {"lotti_fornitori.lotti_scalati": {"$exists": False}},
        {"lotti_fornitori.lotti_scalati": {"$size": 0}},
    ]}
    if not solo_mancanti:
        query = {}

    lotti_da_processare = await db.lotti.find(query, {"_id": 0}).to_list(200)
    aggiornati = 0
    errori = []

    for lotto in lotti_da_processare:
        ricetta_id = lotto.get("ricetta_id")
        ricetta_nome = lotto.get("prodotto", "")
        numero_lotto = lotto.get("numero_lotto") or lotto.get("id", "")

        # Cerca la ricetta nel DB — prima esatta, poi fuzzy
        ricetta = None
        if ricetta_id:
            ricetta = await db.ricette.find_one({"id": ricetta_id}, {"_id": 0})
        if not ricetta and ricetta_nome:
            # Prova match esatto
            ricetta = await db.ricette.find_one(
                {"nome": {"$regex": f"^{re.escape(ricetta_nome)}$", "$options": "i"}},
                {"_id": 0}
            )
        if not ricetta and ricetta_nome:
            # Prova match parziale sulle prime 3 parole
            parole = ricetta_nome.lower().split()[:3]
            for parola in parole:
                if len(parola) > 3:
                    ricetta = await db.ricette.find_one(
                        {"nome": {"$regex": re.escape(parola), "$options": "i"}},
                        {"_id": 0}
                    )
                    if ricetta:
                        break

        if not ricetta:
            # Senza ricetta, costruiamo lotti_scalati dai dizionario_prodotti per ogni ingrediente
            ing_dettaglio = lotto.get("ingredienti_dettaglio", [])
            scalati_da_dizionario = []
            for ing_str in ing_dettaglio:
                # Estrae nome e quantità dalla stringa "Nome (qx unità)"
                import re as re_mod
                m = re_mod.match(r"^(.+?)\s*\((\d[\d,.]*)\s*(\w+)\)", str(ing_str))
                if m:
                    nome_ing = m.group(1).strip()
                    # Cerca nel dizionario prodotti
                    diz = await db.dizionario_prodotti.find_one(
                        {"nome_normalizzato": {"$regex": re_mod.escape(nome_ing[:15].lower()), "$options": "i"}},
                        {"_id": 0}
                    )
                    if diz:
                        scalati_da_dizionario.append({
                            "ingrediente": nome_ing,
                            "lotto_id": f"DIZ-{diz.get('id','?')}",
                            "lotto_id_fornitore": f"DIZ-{diz.get('id','?')}",
                            "fornitore": diz.get("fornitore", ""),
                            "prodotto": diz.get("nome_normalizzato", nome_ing),
                            "quantita_consumata": None,
                            "quantita_rimasta": round(float(diz.get("quantita_disponibile_kg", 0) or 0), 3),
                            "unita": diz.get("unita_confezione", "KG"),
                            "esaurito": float(diz.get("quantita_disponibile_kg", 0) or 0) <= 0,
                            "da_dizionario": True,
                        })
            if scalati_da_dizionario:
                await db.lotti.update_one(
                    {"id": lotto["id"]},
                    {"$set": {"lotti_fornitori": {
                        "lotti_scalati": scalati_da_dizionario,
                        "ingredienti_non_trovati": [],
                        "fonte": "dizionario_prodotti"
                    }}}
                )
                aggiornati += 1
            continue

        try:
            risultato = await scala_lotti_fornitori_per_ricetta(ricetta, 1.0, numero_lotto)
            await db.lotti.update_one(
                {"id": lotto["id"]},
                {"$set": {"lotti_fornitori": risultato}}
            )
            aggiornati += 1
        except Exception as e:
            errori.append(f"{numero_lotto}: {str(e)}")

    return {
        "processati": len(lotti_da_processare),
        "aggiornati": aggiornati,
        "errori": errori
    }

async def ricalcola_scadenze_lotti():
    """Ricalcola la data di scadenza per tutti i lotti che la hanno vuota o mancante."""
    from app.routers.tracciabilita.utils import _calcola_scadenza

    lotti_senza_scad = await db.lotti.find(
        {"$or": [{"data_scadenza": ""}, {"data_scadenza": None}, {"data_scadenza": {"$exists": False}}]},
        {"_id": 0}
    ).to_list(10000)

    aggiornati = 0
    for lotto in lotti_senza_scad:
        ingredienti = lotto.get("ingredienti_dettaglio", [])
        if isinstance(ingredienti, list):
            nomi_ing = [i if isinstance(i, str) else i.get("nome", "") for i in ingredienti]
        else:
            nomi_ing = []

        data_prod = lotto.get("data_produzione", "")
        if not data_prod:
            continue

        try:
            scad_info = _calcola_scadenza(nomi_ing, data_prod)
            data_scad_frigo, data_scad_abb, ing_critico, giorni_frigo, giorni_abb, mesi_abb = scad_info
            await db.lotti.update_one(
                {"id": lotto["id"]},
                {"$set": {
                    "data_scadenza": data_scad_frigo,
                    "scadenza_abbattuto": data_scad_abb,
                    "ingrediente_critico": ing_critico,
                    "conservazione_note": f"Frigo (0-4°C): {giorni_frigo} giorni | Abbattuto (-18°C): {mesi_abb} mesi"
                }}
            )
            aggiornati += 1
        except Exception as e:
            continue

    return {"message": f"Ricalcolate scadenze per {aggiornati} lotti", "aggiornati": aggiornati}
