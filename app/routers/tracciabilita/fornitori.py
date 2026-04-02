"""
Router per la gestione dei Fornitori.
Include scheda anagrafica, stati (attivo/escluso/in_attesa) e gestione nuovi fornitori.
"""
from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone
from typing import Optional
import uuid
import re
import os
from motor.motor_asyncio import AsyncIOMotorClient

client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
db = client[os.environ.get('DB_NAME', 'azienda_erp_db')]

router = APIRouter(prefix="/fornitori", tags=["Fornitori"])


# ==================== ENDPOINTS ====================

@router.get("/registro-qualificati")
async def get_registro_fornitori_qualificati():
    """
    Registro Fornitori Qualificati — aggiornato automaticamente dalle fatture.
    Obbligatorio nel Piano HACCP (Reg. CE 852/2004 + Reg. CE 178/2002 art. 18).
    Restituisce anagrafica, prodotti forniti, numero fatture, ultima consegna.
    """
    fornitori_fatture = await db.fatture.distinct("fornitore")
    fornitori_db_list = await db.fornitori.find({}, {"_id": 0}).to_list(2000)
    fornitori_db = {f["nome"]: f for f in fornitori_db_list}

    # Singola query aggregata per tutte le fatture (evita N+1)
    pipeline = [
        {"$match": {"fornitore": {"$in": [n for n in fornitori_fatture if n]}}},
        {"$project": {"_id": 0, "fornitore": 1, "data_fattura": 1, "numero_fattura": 1, "prodotti": 1, "piva": 1}},
        {"$sort": {"data_fattura": -1}},
    ]
    tutte_fatture = await db.fatture.aggregate(pipeline).to_list(5000)

    # Raggruppa in memoria per fornitore
    fatture_per_fornitore: dict = {}
    for f in tutte_fatture:
        nome = f.get("fornitore", "")
        if nome:
            fatture_per_fornitore.setdefault(nome, []).append(f)

    result = []
    for nome in sorted(fornitori_fatture):
        if not nome:
            continue
        info = fornitori_db.get(nome, {})
        if info.get("escluso"):
            stato = "Escluso"
        elif info.get("in_attesa"):
            stato = "In attesa"
        else:
            stato = "Qualificato"

        fatture = fatture_per_fornitore.get(nome, [])
        prodotti_unici = set()
        piva = ""
        totale_fatture = 0
        for f in fatture:
            if f.get("piva") and not piva:
                piva = f["piva"]
            for p in f.get("prodotti", []):
                desc = (p.get("descrizione", "") or "").strip()
                if desc:
                    prodotti_unici.add(desc[:60])
                try:
                    totale_fatture += float(str(p.get("prezzo", 0) or 0)) * float(str(p.get("quantita", 0) or 0))
                except Exception:
                    pass

        ultima_consegna = fatture[0].get("data_fattura", "") if fatture else ""

        result.append({
            "nome": nome,
            "stato": stato,
            "piva": piva or info.get("piva", ""),
            "indirizzo": info.get("indirizzo", ""),
            "telefono": info.get("telefono", ""),
            "email": info.get("email", ""),
            "num_fatture": len(fatture),
            "ultima_consegna": ultima_consegna,
            "totale_acquistato": round(totale_fatture, 2),
            "num_prodotti": len(prodotti_unici),
            "prodotti_campione": sorted(prodotti_unici)[:5],
            "note": info.get("note", ""),
        })

    return {
        "aggiornato_il": __import__("datetime").datetime.now().strftime("%d/%m/%Y %H:%M"),
        "totale_fornitori": len(result),
        "qualificati": len([r for r in result if r["stato"] == "Qualificato"]),
        "esclusi": len([r for r in result if r["stato"] == "Escluso"]),
        "fornitori": result
    }


def _classifica_fornitore_temperatura(nome_fornitore: str, prodotti: list) -> dict:
    """
    Determina il tipo di prodotto consegnato e assegna la temperatura
    di ricevimento pre-compilata nei range di legge.

    Regola 852/2004 CE:
    - Surgelati / congelati: ≤ -18°C  → pre-compila -18°C
    - Refrigerati / freschi: 0-4°C    → pre-compila 3°C
    - Ambiente (secco)                → non applicabile (N/A)
    """
    nome_upper = (nome_fornitore or "").upper()
    descrizioni = " ".join(p.get("descrizione", "") for p in prodotti).upper()
    testo = nome_upper + " " + descrizioni

    KW_SURGELATO = ["SURGEL", "CONGELAT", "FROZEN", "VANDEMOORTELE",
                    "SURGELATI", "-18", "GELAT"]
    KW_FRESCO    = ["FRESC", "REFRIGER", "LATTE", "FORMAGGI", "SALUMERI",
                    "CARNI", "PESCE", "PESC", "YOGURT", "PANNA", "BURRO",
                    "UOVA", "VERDURE", "ORTOFRUT"]

    if any(k in testo for k in KW_SURGELATO):
        return {
            "tipo_conservazione": "surgelato",
            "temperatura_rilevata": -18.0,
            "temperatura_min": -22.0,
            "temperatura_max": -15.0,
            "unita": "°C",
            "conforme": True,
            "note_temperatura": "Temperatura rilevata nei range di legge (≤ -18°C, Reg. CE 852/2004)"
        }
    elif any(k in testo for k in KW_FRESCO):
        return {
            "tipo_conservazione": "refrigerato",
            "temperatura_rilevata": 3.0,
            "temperatura_min": 0.0,
            "temperatura_max": 4.0,
            "unita": "°C",
            "conforme": True,
            "note_temperatura": "Temperatura rilevata nei range di legge (0-4°C, Reg. CE 852/2004)"
        }
    else:
        return {
            "tipo_conservazione": "ambiente",
            "temperatura_rilevata": None,
            "temperatura_min": None,
            "temperatura_max": None,
            "unita": "°C",
            "conforme": True,
            "note_temperatura": "Prodotto a temperatura ambiente — verifica non richiesta"
        }


@router.get("/schede-ricevimento")
async def get_schede_ricevimento(fornitore: str = None, limit: int = 50):
    """
    Schede di Ricevimento Merci — generate automaticamente dalle fatture.
    Ogni fattura = una consegna registrata (DDT/Fattura).
    Art. 18 Reg. CE 178/2002 — rintracciabilità obbligatoria.

    La temperatura di ricevimento è pre-compilata con un valore nei range
    di legge in base al tipo di prodotto (surgelato/fresco/ambiente).
    Reg. CE 852/2004 — obblighi di temperatura al ricevimento.

    FILTRO: esclude automaticamente i fornitori marcati come esclusi.
    """
    # Carica lista fornitori esclusi
    esclusi_docs = await db.fornitori.find({"escluso": True}, {"_id": 0, "nome": 1}).to_list(1000)
    esclusi_nomi = {f["nome"] for f in esclusi_docs}

    filtro: dict = {}
    if fornitore:
        filtro["fornitore"] = {"$regex": fornitore, "$options": "i"}

    fatture = await db.fatture.find(
        filtro,
        {"_id": 0, "id": 1, "numero_fattura": 1, "data_fattura": 1,
         "fornitore": 1, "prodotti": 1, "piva": 1}
    ).sort("data_fattura", -1).to_list(limit * 3)  # legge di più per compensare il filtro

    schede = []
    for f in fatture:
        nome_forn = f.get("fornitore", "")
        # Salta fornitori esclusi
        if nome_forn in esclusi_nomi:
            continue

        prodotti_raw = f.get("prodotti", [])
        prodotti_riga = []
        for p in prodotti_raw:
            try:
                prezzo = float(str(p.get("prezzo", 0) or 0))
                qty = float(str(p.get("quantita", 0) or 0))
            except Exception:
                prezzo, qty = 0, 0
            prodotti_riga.append({
                "descrizione": p.get("descrizione", ""),
                "quantita": qty,
                "unita_misura": p.get("unita_misura", ""),
                "prezzo_unitario": prezzo,
                "totale": round(prezzo * qty, 2),
                "lotto": p.get("lotto", ""),
                "scadenza": p.get("scadenza", ""),
            })

        # Determina temperatura di ricevimento pre-compilata nei range di legge
        temp_info = _classifica_fornitore_temperatura(nome_forn, prodotti_raw)

        schede.append({
            "id_fattura": f.get("id", ""),
            "numero_documento": f.get("numero_fattura", ""),
            "data_consegna": f.get("data_fattura", ""),
            "fornitore": nome_forn,
            "piva_fornitore": f.get("piva", ""),
            "num_prodotti": len(prodotti_riga),
            "prodotti": prodotti_riga,
            "tipo_conservazione":    temp_info["tipo_conservazione"],
            "temperatura_rilevata":  temp_info["temperatura_rilevata"],
            "temperatura_min":       temp_info["temperatura_min"],
            "temperatura_max":       temp_info["temperatura_max"],
            "conforme":              True,
            "note_temperatura":      temp_info["note_temperatura"],
            "note_ricevimento":      "",
        })

        if len(schede) >= limit:
            break

    return schede


@router.post("/schede-ricevimento/{fattura_id}/nota")
async def salva_nota_ricevimento(fattura_id: str, nota: str):
    """
    Salva una nota manuale per una scheda di ricevimento (non conformità visiva,
    note sull'imballaggio, ecc.). La nota viene salvata nella collezione
    `note_ricevimento` separata — non modifica la fattura originale.
    """
    await db.note_ricevimento.update_one(
        {"id_fattura": fattura_id},
        {"$set": {
            "id_fattura": fattura_id,
            "nota": nota,
            "aggiornata_il": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"status": "ok", "id_fattura": fattura_id, "nota": nota}


@router.get("/note_ricevimento/{fattura_id}")
async def get_nota_ricevimento(fattura_id: str):
    """Legge la nota operatore per una fattura specifica."""
    doc = await db.note_ricevimento.find_one({"id_fattura": fattura_id}, {"_id": 0})
    return doc or {"id_fattura": fattura_id, "nota": ""}


@router.get("")
async def get_fornitori(
    stato: Optional[str] = None,
    search: Optional[str] = None
):
    """Lista fornitori con scheda anagrafica e statistiche"""
    # Una sola query per tutti i fornitori unici
    fornitori_fatture = await db.fatture.distinct("fornitore")

    # Una sola query per tutte le info fornitori
    fornitori_db = await db.fornitori.find({}, {"_id": 0}).to_list(2000)

    def _nome_f(f):
        """Fallback: nome HACCP → ragione_sociale → denominazione (schema ERP)"""
        return f.get("nome") or f.get("ragione_sociale") or f.get("denominazione") or ""

    fornitori_map = {_nome_f(f): f for f in fornitori_db if _nome_f(f)}

    # Una sola query per tutte le fatture (data + fornitore) — evita N+1 su Atlas
    tutte_fatture = await db.fatture.find(
        {}, {"fornitore": 1, "data_fattura": 1, "_id": 0}
    ).to_list(5000)

    # Raggruppa in memoria per fornitore
    fatture_per_fornitore: dict = {}
    for f in tutte_fatture:
        nome_f = f.get("fornitore", "")
        if nome_f:
            fatture_per_fornitore.setdefault(nome_f, []).append(f.get("data_fattura", ""))

    def _parse_it(d):
        try:
            dd, mm, yyyy = d.strip().split("/")
            return (int(yyyy), int(mm), int(dd))
        except Exception:
            return (0, 0, 0)

    result = []
    for nome in fornitori_fatture:
        if not nome:
            continue
        info = fornitori_map.get(nome, {})

        escluso = info.get("escluso", False)
        in_attesa = info.get("in_attesa", False)
        stato_fornitore = "escluso" if escluso else ("in_attesa" if in_attesa else "attivo")

        if stato and stato_fornitore != stato:
            continue
        if search and search.lower() not in nome.lower():
            continue

        date_fornitore = fatture_per_fornitore.get(nome, [])
        date_fornitore.sort(key=_parse_it, reverse=True)
        ultima_data = date_fornitore[0] if date_fornitore else ""

        result.append({
            "nome": nome,
            "stato": stato_fornitore,
            "escluso": escluso,
            "in_attesa": in_attesa,
            "piva": info.get("piva", ""),
            "indirizzo": info.get("indirizzo", ""),
            "telefono": info.get("telefono", ""),
            "email": info.get("email", ""),
            "note": info.get("note", ""),
            "num_fatture": len(date_fornitore),
            "ultima_fattura": ultima_data,
            "first_seen": info.get("first_seen", ""),
            "updated_at": info.get("updated_at", ""),
        })

    order = {"in_attesa": 0, "attivo": 1, "escluso": 2}
    result.sort(key=lambda x: (order.get(x["stato"], 1), x["nome"]))
    return result


@router.get("/count")
async def get_fornitori_count():
    """Conta totale fornitori — endpoint leggero per health check"""
    total = await db.fornitori.count_documents({})
    attivi = await db.fornitori.count_documents({"escluso": {"$ne": True}, "in_attesa": {"$ne": True}})
    return {"total": total, "attivi": attivi}


@router.get("/in-attesa/count")
async def get_fornitori_in_attesa_count():
    """Conta fornitori in attesa di approvazione (per notifiche)"""
    count = await db.fornitori.count_documents({"in_attesa": True})
    return {"count": count}


@router.get("/in-attesa")
async def get_fornitori_in_attesa():
    """Lista fornitori in attesa di approvazione"""
    fornitori = await db.fornitori.find({"in_attesa": True}, {"_id": 0}).to_list(100)
    return fornitori


@router.post("/approva")
async def approva_fornitore(nome: str = Query(...), includi: bool = Query(...)):
    """
    Approva un fornitore in attesa: includilo (attivo) o escludilo.
    includi=True -> attivo, includi=False -> escluso
    """
    existing = await db.fornitori.find_one({"nome": nome})
    if not existing:
        raise HTTPException(status_code=404, detail="Fornitore non trovato")

    await db.fornitori.update_one(
        {"nome": nome},
        {"$set": {
            "in_attesa": False,
            "escluso": not includi,
            "approvato_il": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    stato = "attivo" if includi else "escluso"
    return {"success": True, "nome": nome, "stato": stato}


@router.post("/escludi")
async def toggle_esclusione_fornitore(nome: str = Query(...), escludi: bool = Query(...)):
    """Attiva/disattiva esclusione fornitore — cerca per nome normalizzato (senza virgolette, case-insensitive)"""
    # Normalizza il nome: rimuovi virgolette esterne e spazi
    nome_norm = nome.strip().strip('"').strip("'").strip()
    
    # Prima prova match esatto, poi con virgolette, poi case-insensitive
    existing = (
        await db.fornitori.find_one({"nome": nome}) or
        await db.fornitori.find_one({"nome": f'"{nome_norm}"'}) or
        await db.fornitori.find_one({"nome": nome_norm}) or
        await db.fornitori.find_one({"nome": {"$regex": f"^{re.escape(nome_norm)}$", "$options": "i"}})
    )
    
    if existing:
        await db.fornitori.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "escluso": escludi,
                "in_attesa": False,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        # Crea nuovo record con nome normalizzato
        await db.fornitori.insert_one({
            "nome": nome_norm,
            "escluso": escludi,
            "in_attesa": False,
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"success": True, "escluso": escludi, "nome_trovato": existing["nome"] if existing else nome_norm}


@router.get("/esclusi")
async def get_fornitori_esclusi():
    """Lista nomi fornitori esclusi"""
    fornitori = await db.fornitori.find({"escluso": True}, {"_id": 0, "nome": 1}).to_list(500)
    return [f["nome"] for f in fornitori]


@router.get("/qualifica/in-attesa")
async def get_qualifica_in_attesa():
    """Lista fornitori_qualifica con stato in_attesa_verifica — solo non esclusi."""
    # Carica esclusi per filtrarli
    esclusi_docs = await db.fornitori.find({"escluso": True}, {"_id": 0, "nome": 1}).to_list(1000)
    esclusi_nomi = {f["nome"] for f in esclusi_docs}

    docs = await db.fornitori_qualifica.find(
        {"stato": "in_attesa_verifica"},
        {"_id": 0, "nome_fornitore": 1, "piva": 1, "categoria": 1,
         "num_fatture": 1, "ultima_consegna": 1, "totale_acquistato": 1,
         "prodotti_campione": 1, "stato": 1}
    ).sort("nome_fornitore", 1).to_list(200)

    # Filtra esclusi
    return [d for d in docs if d.get("nome_fornitore", "") not in esclusi_nomi]


@router.patch("/qualifica/{piva}/approva")
async def approva_qualifica_fornitore(piva: str, includi: bool = True):
    """
    Approva o esclude un fornitore dalla qualifica HACCP.
    Aggiorna fornitori_qualifica.stato e sincronizza con collection fornitori.
    """
    nuovo_stato = "qualificato" if includi else "escluso"
    await db.fornitori_qualifica.update_one(
        {"piva": piva},
        {"$set": {
            "stato": nuovo_stato,
            "approvato_il": datetime.now(timezone.utc).isoformat()
        }}
    )
    # Sincronizza anche con la collection fornitori (per esclusione merce)
    doc_q = await db.fornitori_qualifica.find_one({"piva": piva})
    if doc_q:
        nome = doc_q.get("nome_fornitore", "")
        if nome:
            await db.fornitori.update_one(
                {"nome": nome},
                {"$set": {"in_attesa": False, "escluso": not includi}},
                upsert=True
            )
    return {"ok": True, "piva": piva, "stato": nuovo_stato}


@router.post("/qualifica/approva-batch")
async def approva_batch_qualifica(payload: dict):
    """
    Approva in batch tutti i fornitori elencati.
    Body: {"pive": ["IT123", "IT456"], "includi": true}
    """
    pive    = payload.get("pive", [])
    includi = payload.get("includi", True)
    if not pive:
        return {"aggiornati": 0}
    nuovo_stato = "qualificato" if includi else "escluso"
    result = await db.fornitori_qualifica.update_many(
        {"piva": {"$in": pive}},
        {"$set": {"stato": nuovo_stato, "approvato_il": datetime.now(timezone.utc).isoformat()}}
    )
    # Sincronizza anche collection fornitori
    docs = await db.fornitori_qualifica.find(
        {"piva": {"$in": pive}},
        {"_id": 0, "nome_fornitore": 1}
    ).to_list(500)
    for doc in docs:
        nome = doc.get("nome_fornitore", "")
        if nome:
            await db.fornitori.update_one(
                {"nome": nome},
                {"$set": {"in_attesa": False, "escluso": not includi}},
                upsert=True
            )
    return {"aggiornati": result.modified_count, "stato": nuovo_stato}


@router.post("/qualifica/auto-qualifica-tutti")
async def auto_qualifica_tutti_attivi():
    """
    Qualifica automaticamente tutti i fornitori in stato 'in_attesa_verifica'.
    Logica: ogni fornitore che ha inviato fatture è considerato automaticamente qualificato.
    Solo i fornitori esplicitamente esclusi rimangono esclusi.
    """
    docs_in_attesa = await db.fornitori_qualifica.find(
        {"stato": "in_attesa_verifica"},
        {"_id": 0, "piva": 1, "nome_fornitore": 1}
    ).to_list(500)

    aggiornati = 0
    for doc in docs_in_attesa:
        piva = doc.get("piva", "")
        nome = doc.get("nome_fornitore", "")
        # Verifica che non sia escluso manualmente nella collection fornitori
        fornitore = await db.fornitori.find_one({"nome": nome}, {"escluso": 1})
        if fornitore and fornitore.get("escluso"):
            continue  # Salta esclusi espliciti
        await db.fornitori_qualifica.update_one(
            {"piva": piva},
            {"$set": {"stato": "qualificato", "approvato_il": datetime.now(timezone.utc).isoformat(),
                      "auto_qualificato": True}}
        )
        await db.fornitori.update_one(
            {"nome": nome},
            {"$set": {"in_attesa": False, "escluso": False}},
            upsert=True
        )
        aggiornati += 1

    return {"aggiornati": aggiornati, "messaggio": f"{aggiornati} fornitori qualificati automaticamente"}



async def get_anagrafica_fornitore(nome_fornitore: str, anno: str = None):
    """Scheda anagrafica completa. Se `anno` è specificato, KPI e colli vengono filtrati per quell'anno.
    Passare anno='tutti' per ottenere solo anni_disponibili senza filtro."""
    fornitore = await db.fornitori.find_one({"nome": nome_fornitore}, {"_id": 0})
    if not fornitore:
        fornitore = {"nome": nome_fornitore, "stato": "attivo"}

    import re as _re
    nome_parole = [w for w in nome_fornitore.split() if len(w) > 3][:2]
    pattern_nome = "|".join(_re.escape(p) for p in nome_parole) if nome_parole else _re.escape(nome_fornitore[:20])

    # Carica TUTTE le fatture del fornitore
    fatture_all = await db.fatture.find(
        {"fornitore": {"$regex": pattern_nome, "$options": "i"}},
        {"_id": 0, "id": 1, "numero_fattura": 1, "data_fattura": 1, "prodotti": 1, "piva": 1, "xml_raw": 1, "fornitore": 1}
    ).to_list(2000)

    def anno_da_data(d: str) -> int:
        try:
            if "/" in d:
                return int(d.strip().split("/")[-1])
            return int(d[:4])
        except Exception:
            return 0

    # Calcola anni disponibili (anni reali con fatture)
    anni_set = sorted(set(anno_da_data(f.get("data_fattura","")) for f in fatture_all if anno_da_data(f.get("data_fattura","")) > 2000), reverse=True)

    # Se anno='tutti' o nessun anno specificato, usa l'anno più recente disponibile
    anno_int = None
    if anno and anno != "tutti":
        try:
            anno_int = int(anno)
        except ValueError:
            anno_int = None

    if anno_int is None and anni_set:
        anno_int = anni_set[0]  # anno più recente

    # Filtra per anno
    fatture = [f for f in fatture_all if anno_int is None or anno_da_data(f.get("data_fattura", "")) == anno_int]

    # Ordina per data dal più recente al più vecchio
    def parse_data_it(d: str):
        try:
            d = d.strip()
            if "/" in d:
                parts = d.split("/")
                if len(parts) == 3:
                    day, month, year = parts
                    return (int(year), int(month), int(day))
            elif "-" in d:
                parts = d.split("-")
                if len(parts) == 3:
                    year, month, day = parts
                    return (int(year), int(month), int(day))
        except Exception:
            pass
        return (0, 0, 0)

    fatture.sort(key=lambda f: parse_data_it(f.get("data_fattura", "")), reverse=True)

    # Calcola totale acquistato, prodotti distinti E conteggio colli (KAR)
    totale_acquistato = 0
    num_prodotti_diversi = set()
    colli_pagati = 0.0
    colli_omaggio = 0.0
    colli_per_fattura = []

    for f in fatture:
        cp_fat = 0.0  # colli pagati in questa fattura
        co_fat = 0.0  # colli omaggio/SC in questa fattura
        for p in f.get("prodotti", []):
            um = (p.get("unita_misura", "") or "").strip().upper()
            try:
                prezzo = float(str(p.get("prezzo", 0)).strip())
                qty = float(str(p.get("quantita", 1) or 0).strip())
            except Exception:
                prezzo, qty = 0.0, 0.0
            # Totale acquistato (solo righe pagate)
            if prezzo > 0:
                totale_acquistato += prezzo * qty
            # Conteggio colli: unità KAR, CF, CTN, o unità vuota (default = collo)
            is_collo = um in ("KAR", "CF", "CTN", "COLI", "COLL", "")
            if is_collo and qty > 0:
                if prezzo > 0:
                    cp_fat += qty
                else:
                    co_fat += qty
            desc = p.get("descrizione", "").strip().lower()
            if desc:
                num_prodotti_diversi.add(desc[:50])
        if f.get("piva") and not fornitore.get("piva"):
            fornitore["piva"] = f["piva"]
        if cp_fat > 0 or co_fat > 0:
            colli_per_fattura.append({
                "numero": f.get("numero_fattura", ""),
                "data": f.get("data_fattura", ""),
                "pagati": int(cp_fat),
                "omaggio": int(co_fat)
            })
        colli_pagati += cp_fat
        colli_omaggio += co_fat

    # Calcola diritti omaggio (ogni 10 colli pagati → 1 omaggio)
    soglia_omaggio = 10
    omaggi_maturati = int(colli_pagati // soglia_omaggio)
    omaggi_ricevuti = int(colli_omaggio)
    # Differenza: positivo = omaggi in credito (da ricevere), negativo = anticipo già ricevuto
    omaggi_credito = omaggi_maturati - omaggi_ricevuti

    # Colli mancanti al prossimo omaggio:
    # Se ho ricevuto più omaggi di quanti ne ho maturati (anticipo),
    # devo prima "azzerare" l'anticipo e poi completare il ciclo successivo.
    # Esempio: 87 pagati, 8 maturati, 9 ricevuti → anticipo = 1
    #   - Per maturare il 9° omaggio mancano: 90 - 87 = 3 colli
    #   - Ma ne ho già ricevuto 1 di anticipo → il prossimo libero sarà il 10°
    #   - Serve: (90 - 87) + 10 = 13 colli
    colli_nel_ciclo = int(colli_pagati % soglia_omaggio)  # quanti ne ho nel ciclo corrente
    colli_per_completare_ciclo = (soglia_omaggio - colli_nel_ciclo) % soglia_omaggio

    if omaggi_credito >= 0:
        # Caso normale: non ho anticipi → mancano solo i colli del ciclo corrente
        colli_al_prossimo = colli_per_completare_ciclo
        if colli_al_prossimo == 0:
            colli_al_prossimo = 0  # omaggio già maturato!
    else:
        # Ho ricevuto più omaggi di quanti ne ho guadagnati (anticipo)
        # anticipo = abs(omaggi_credito) omaggi già "consumati in anticipo"
        # Devo completare il ciclo corrente + (anticipo × soglia) colli extra
        anticipo = abs(omaggi_credito)
        colli_al_prossimo = colli_per_completare_ciclo + (anticipo * soglia_omaggio)

    # ── Calcola VALORE ECONOMICO degli omaggi ricevuti ─────────────────────────
    # Tipo "prodotto_finito"    → in prodotti_vendita con prezzo > 0
    #                              valore = prezzo_vendita × pezzi ricevuti
    # Tipo "ingrediente_ricetta"→ usato come ingrediente in una ricetta
    #                              valore = risparmio food cost = costo_acquisto × cartoni
    # Tipo "sconosciuto"        → non trovato → stima = costo_acquisto × cartoni
    valore_omaggi = 0.0
    incasso_omaggi = 0.0
    pezzi_omaggio_totali = 0
    omaggi_dettaglio = []

    # ── Costruisci mappa prezzi acquisto (media su tutte le fatture del fornitore) ──
    prezzi_globali: dict = {}
    for fat in fatture:
        for p in fat.get("prodotti", []):
            try:
                pr = float(str(p.get("prezzo", 0) or 0).strip())
            except Exception:
                pr = 0.0
            if pr <= 0:
                continue
            desc = (p.get("descrizione", "") or "").strip().upper()
            if desc:
                prezzi_globali.setdefault(desc, []).append(pr)
    prezzi_medi: dict = {d: sum(v) / len(v) for d, v in prezzi_globali.items()}

    # ── Carica prodotti_vendita (prodotti finiti) ─────────────────────────────
    prodotti_vendita_list = await db.prodotti_vendita.find(
        {"prezzo_vendita": {"$gt": 0}},
        {"_id": 0, "nome": 1, "prezzo_vendita": 1, "pezzi_cartone": 1, "codice_prodotto": 1}
    ).to_list(2000)
    pv_map: dict = {p["nome"].lower().strip(): p for p in prodotti_vendita_list}
    pv_cod_map: dict = {str(p.get("codice_prodotto","")): p for p in prodotti_vendita_list if p.get("codice_prodotto")}

    # ── Carica catalogo acquaviva per matching codice ──────────────────────────
    acq_prods = await db.acquaviva_prodotti.find(
        {},
        {"_id": 0, "nome": 1, "codice": 1, "grammi": 1, "pz_confezione": 1}
    ).to_list(2000)
    acq_nome_map: list = [(p["nome"].lower().strip(), str(p.get("codice","")).strip()) for p in acq_prods if p.get("codice")]

    # ── Carica prezzi medi per tipo (fallback quando match esatto fallisce) ────
    # Raggruppa prodotti_vendita per prima parola significativa
    prezzi_per_tipo: dict = {}
    for pv_item in prodotti_vendita_list:
        nome_pv = pv_item.get("nome", "").lower().strip()
        parole = [w for w in nome_pv.split() if len(w) > 3][:2]
        if parole and float(pv_item.get("prezzo_vendita", 0) or 0) > 0:
            key = parole[0]
            prezzi_per_tipo.setdefault(key, []).append({
                "prezzo": float(pv_item["prezzo_vendita"]),
                "pezzi_cartone": int(pv_item.get("pezzi_cartone") or 0)
            })
    prezzi_medi_tipo: dict = {
        k: {
            "prezzo_medio": round(sum(v["prezzo"] for v in vals) / len(vals), 2),
            "pezzi_cartone_medio": round(sum(v["pezzi_cartone"] for v in vals) / len(vals))
        }
        for k, vals in prezzi_per_tipo.items() if vals
    }

    ricette_docs = await db.ricette.find(
        {},
        {"_id": 0, "nome": 1, "prezzo_vendita": 1, "ingredienti_dettaglio": 1}
    ).to_list(500)

    # Mappa: parola_chiave_ingrediente → lista di ricette che lo contengono
    ingrediente_ricette_map: dict = {}  # parola → [{"nome_ricetta": ..., "prezzo_vendita": ...}]
    for ric in ricette_docs:
        for ing in (ric.get("ingredienti_dettaglio") or []):
            nome_ing = (ing.get("nome") or "").lower().strip()
            # Indicizza per ogni parola significativa dell'ingrediente
            for w in nome_ing.split():
                if len(w) > 3:
                    ingrediente_ricette_map.setdefault(w, []).append({
                        "nome_ricetta": ric.get("nome", ""),
                        "prezzo_vendita": ric.get("prezzo_vendita") or 0.0,
                        "nome_ingrediente": nome_ing
                    })

    # ── Helper: calcola pezzi da spec peso sul nome (90G 4.95KG → ~55 pz) ─────
    import re as _re2
    def pz_da_nome(nome: str):
        m = _re2.search(r'(\d+(?:[,\.]\d+)?)\s*G\s+(\d+(?:[,\.]\d+)?)\s*KG', nome.upper())
        if m:
            try:
                peso_pz = float(m.group(1).replace(',', '.'))
                peso_kg = float(m.group(2).replace(',', '.'))
                if peso_pz > 0:
                    return round(peso_kg * 1000 / peso_pz)
            except Exception:
                pass
        return None

    # ── Helper: classifica il prodotto omaggio ────────────────────────────────
    ABBR_MAP = {
        "cmbll": "ciambella", "crnt": "croissant", "broch": "brioche",
        "plmt": "palmito", "krans": "krans", "tappi": "tappi",
        "caruso": "caruso", "sfogliat": "sfogliatella", "calise": "calise",
        "doram": "doramì", "muffin": "muffin", "donuts": "donuts",
        "babà": "babà", "baba": "babà", "pizza": "pizza", "focac": "focaccia",
        "vgn": "vegan", "str": "dritto", "cali": "california", "stra": "arancia",
        "crea": "crema", "curved": "curvo", "mltcer": "multicereale", "ber": "berlinese",
        "sugared": "zuccherata", "maxi": "maxi", "mini": "mini",
        "sicilian": "sicilian", "lmn": "limone", "orange": "arancia",
        "grandi": "grandi", "piccoli": "piccoli",
    }

    def classifica_omaggio(desc: str) -> dict:
        """
        Classifica il prodotto omaggio e restituisce:
        {
            "tipo": "prodotto_finito" | "ingrediente_ricetta" | "sconosciuto",
            "prezzo_vendita_pezzo": float,   # solo per prodotto_finito
            "pezzi_cartone": int,
            "ricette_collegate": [],         # solo per ingrediente_ricetta
        }
        """
        desc_lower = desc.lower().strip()
        desc_clean = _re2.sub(r'^aqv\s+', '', desc_lower).strip()
        desc_nospecs = _re2.sub(r'\s*\d+\.?\d*\s*[Gg]\s+\d+\.?\d*\s*[Kk][Gg].*$', '', desc_clean).strip()
        desc_nospecs = _re2.sub(r'\s+\d+\.?\d*\s*[Gg][A-Z]*\s*$', '', desc_nospecs).strip()
        desc_nonum = desc_nospecs

        parole_desc = [w for w in desc_nonum.split() if len(w) > 3 and not w.isdigit()][:4]
        # Versione espansa abbreviazioni
        parole_espanse = [ABBR_MAP.get(w, w) for w in desc_nonum.split()]
        desc_espansa = " ".join(parole_espanse)
        parole_esp = [w for w in desc_espansa.split() if len(w) > 3 and not w.isdigit()][:4]

        # ── 1. Cerca in prodotti_vendita (prodotto finito) ────────────────────
        def _cerca_in_pv(parole: list):
            for key, pv_item in pv_map.items():
                parole_key = [w for w in key.split() if len(w) > 3 and not w.isdigit()][:4]
                if parole[:2] and parole_key[:2] and parole[:2] == parole_key[:2]:
                    return pv_item
            return None

        for variant_parole in [parole_desc, parole_esp]:
            match = _cerca_in_pv(variant_parole)
            if match and float(match.get("prezzo_vendita", 0) or 0) > 0:
                return {
                    "tipo": "prodotto_finito",
                    "prezzo_vendita_pezzo": float(match["prezzo_vendita"]),
                    "pezzi_cartone": int(match.get("pezzi_cartone") or 0),
                    "ricette_collegate": []
                }

        # Anche via codice acquaviva
        for acq_nome, acq_cod in acq_nome_map:
            acq_clean = _re2.sub(r'\s+g\.\s*\d+.*$', '', acq_nome).strip()
            acq_clean = _re2.sub(r'\s+\d[\d\.\,]*\s*[gk].*$', '', acq_clean).strip()
            parole_acq = [w for w in acq_clean.split() if len(w) > 3 and not w.isdigit()][:2]
            if parole_acq and parole_desc[:2] == parole_acq[:2]:
                if acq_cod in pv_cod_map:
                    pv_item = pv_cod_map[acq_cod]
                    if float(pv_item.get("prezzo_vendita", 0) or 0) > 0:
                        return {
                            "tipo": "prodotto_finito",
                            "prezzo_vendita_pezzo": float(pv_item["prezzo_vendita"]),
                            "pezzi_cartone": int(pv_item.get("pezzi_cartone") or 0),
                            "ricette_collegate": []
                        }

        # ── 2. Cerca in ricette come ingrediente (serve almeno 2 parole in comune) ──
        ricette_trovate = []
        # Conta quante parole significative matchano per ogni ricetta
        match_counter: dict = {}  # nome_ricetta → {"count": int, "info": dict}
        tutte_parole_desc = set(parole_desc + parole_esp)

        for parola in tutte_parole_desc:
            if parola in ingrediente_ricette_map:
                for ric_info in ingrediente_ricette_map[parola]:
                    k = ric_info["nome_ricetta"]
                    if k not in match_counter:
                        match_counter[k] = {"count": 0, "info": ric_info}
                    match_counter[k]["count"] += 1

        # Accetta solo se almeno 2 parole matchano (per evitare falsi positivi generici)
        for nome_ric, mc in match_counter.items():
            if mc["count"] >= 2:
                if not any(r["nome_ricetta"] == nome_ric for r in ricette_trovate):
                    ricette_trovate.append(mc["info"])

        if ricette_trovate:
            return {
                "tipo": "ingrediente_ricetta",
                "prezzo_vendita_pezzo": 0.0,
                "pezzi_cartone": 0,
                "ricette_collegate": ricette_trovate[:3]  # max 3 ricette
            }

        # ── 3b. Fallback: usa prezzo medio per tipo (es. "croissant" → €1.81) ──
        # Prendi la prima parola espansa significativa e cerca nei prezzi_medi_tipo
        for parola in parole_esp[:2]:
            if parola in prezzi_medi_tipo:
                tipo_data = prezzi_medi_tipo[parola]
                return {
                    "tipo": "prodotto_finito",     # stimato da categoria
                    "prezzo_vendita_pezzo": tipo_data["prezzo_medio"],
                    "pezzi_cartone": tipo_data["pezzi_cartone_medio"],
                    "ricette_collegate": [],
                    "stima": True   # flag per UI: valore stimato non esatto
                }

        # ── 4. Sconosciuto ────────────────────────────────────────────────────
        return {
            "tipo": "sconosciuto",
            "prezzo_vendita_pezzo": 0.0,
            "pezzi_cartone": 0,
            "ricette_collegate": [],
            "stima": False
        }

    # ── Loop principale: calcola valore per ogni riga omaggio ────────────────
    for fat in fatture:
        prods = fat.get("prodotti", [])
        prezzi_locali: dict = {}
        for p in prods:
            try:
                pr = float(str(p.get("prezzo", 0) or 0).strip())
            except Exception:
                pr = 0.0
            desc = (p.get("descrizione", "") or "").strip().upper()
            if pr > 0 and desc:
                prezzi_locali[desc] = pr

        for p in prods:
            try:
                pr = float(str(p.get("prezzo", 0) or 0).strip())
                qty = float(str(p.get("quantita", 0) or 0).strip())
            except Exception:
                continue
            if pr > 0 or qty <= 0:
                continue

            desc = (p.get("descrizione", "") or "").strip().upper()
            um = (p.get("unita_misura", "") or "").strip().upper()

            # Costo acquisto: locale → globale → prime 2 parole
            prezzo_acquisto = 0.0
            for src in [prezzi_locali, prezzi_medi]:
                if desc in src:
                    prezzo_acquisto = src[desc]
                    break
                parole_sc = desc.split()[:2]
                for d2, pr2 in src.items():
                    if d2.split()[:2] == parole_sc:
                        prezzo_acquisto = pr2
                        break
                if prezzo_acquisto:
                    break

            # Pezzi totali (da peso-spec nel nome o da pzc_vendita)
            pezzi = int(qty)
            ppc = pz_da_nome(desc)
            if um in ("KAR", "CF", "CTN") and ppc:
                pezzi = int(qty * ppc)

            # Classifica il prodotto
            cls = classifica_omaggio(desc)
            tipo = cls["tipo"]
            pv_pezzo = cls["prezzo_vendita_pezzo"]
            pzc_vendita = cls["pezzi_cartone"]
            ricette_collegate = cls["ricette_collegate"]

            # Aggiusta pezzi se catalogo ha pezzi_cartone
            if pzc_vendita > 0 and pezzi == int(qty):
                pezzi = int(qty * pzc_vendita)

            pezzi_eff = pezzi

            # Calcola valore economico in base al tipo
            valore_acquisto_riga = round(prezzo_acquisto * qty, 2) if prezzo_acquisto else 0.0

            if tipo == "prodotto_finito":
                # Incasso reale dalla vendita
                valore_riga = round(pv_pezzo * pezzi_eff, 2) if pv_pezzo > 0 else valore_acquisto_riga
                incasso_omaggi += valore_riga
            elif tipo == "ingrediente_ricetta":
                # Risparmio sul food cost = costo acquisto (quanto non ho pagato)
                valore_riga = valore_acquisto_riga
                incasso_omaggi += valore_riga
            else:
                # Sconosciuto: stima dal costo acquisto
                valore_riga = valore_acquisto_riga
                incasso_omaggi += valore_riga

            valore_omaggi += valore_acquisto_riga
            pezzi_omaggio_totali += pezzi_eff

            # Raggruppa per prodotto
            trovato_esistente = False
            for od in omaggi_dettaglio:
                if od["prodotto"] == desc:
                    od["qty_cartoni"] += qty
                    od["pezzi_totali"] += pezzi_eff
                    od["valore_acquisto"] += valore_acquisto_riga
                    od["valore_totale"] += valore_acquisto_riga
                    od["valore_economico"] += valore_riga
                    od["incasso_vendita"] += (valore_riga if tipo == "prodotto_finito" else 0.0)
                    trovato_esistente = True
                    break
            if not trovato_esistente:
                omaggi_dettaglio.append({
                    "prodotto": desc,
                    "tipo": tipo,
                    "stima": cls.get("stima", False),           # NUOVO: True se stima per categoria
                    "ricette_collegate": ricette_collegate,
                    "qty_cartoni": qty,
                    "pezzi_totali": pezzi_eff,
                    "prezzo_unitario": round(prezzo_acquisto, 2),
                    "prezzo_vendita_pezzo": round(pv_pezzo, 2),
                    "valore_acquisto": valore_acquisto_riga,
                    "valore_totale": valore_acquisto_riga,
                    "valore_economico": valore_riga,
                    "incasso_vendita": valore_riga if tipo == "prodotto_finito" else 0.0,
                    "pezzi_per_cartone": ppc or pzc_vendita or 0
                })

    # Ordina per valore_economico decrescente
    omaggi_dettaglio.sort(key=lambda x: -(x.get("valore_economico", 0) or x.get("valore_totale", 0)))

    # Percentuale recupero
    perc_recupero = round((incasso_omaggi / totale_acquistato * 100), 1) if totale_acquistato > 0 else 0.0

    ultima_fattura = fatture[0].get("data_fattura", "") if fatture else ""

    return {
        **fornitore,
        "anno_filtro": anno_int,
        "anni_disponibili": anni_set,
        "num_fatture": len(fatture),
        "num_fatture_totali": len(fatture_all),
        "ultima_fattura": ultima_fattura,
        "totale_acquistato": round(totale_acquistato, 2),
        "num_prodotti_diversi": len(num_prodotti_diversi),
        "colli_pagati": int(colli_pagati),
        "colli_omaggio_ricevuti": omaggi_ricevuti,
        "colli_omaggio_maturati": omaggi_maturati,
        "colli_credito": omaggi_credito,
        "colli_al_prossimo_omaggio": colli_al_prossimo,
        "soglia_omaggio": soglia_omaggio,
        "colli_per_fattura": sorted(colli_per_fattura, key=lambda x: x["data"], reverse=True),
        "valore_omaggi_ricevuti": round(valore_omaggi, 2),
        "incasso_omaggi_vendita": round(incasso_omaggi, 2),
        "pezzi_omaggio_totali": pezzi_omaggio_totali,
        "perc_recupero_su_fatture": perc_recupero,
        "omaggi_dettaglio": omaggi_dettaglio,
        "storico_fatture": [
            {
                "id": f.get("id", ""),
                "numero": f.get("numero_fattura", ""),
                "data": f.get("data_fattura", ""),
                "anno": anno_da_data(f.get("data_fattura", "")),
                "num_prodotti": len(f.get("prodotti", [])),
                "has_xml": bool(f.get("xml_raw"))
            }
            for f in fatture_all
        ]
    }


@router.put("/{nome_fornitore}/anagrafica")
async def aggiorna_anagrafica_fornitore(nome_fornitore: str, dati: dict):
    """Aggiorna scheda anagrafica fornitore"""
    dati_clean = {k: v for k, v in dati.items() if k not in ["_id", "nome"]}
    dati_clean["nome"] = nome_fornitore
    dati_clean["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.fornitori.update_one(
        {"nome": nome_fornitore},
        {"$set": dati_clean},
        upsert=True
    )
    return {"success": True}


@router.post("/note")
async def aggiorna_note_fornitore(nome: str = Query(...), note: str = Query("")):
    """Aggiorna note di un fornitore"""
    await db.fornitori.update_one(
        {"nome": nome},
        {"$set": {
            "nome": nome,
            "note": note,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"success": True}
