"""
Router per prodotti semilavorati commerciali (Acquaviva, Vandemoortele, Alpha, ecc.).
Gestisce: listino, vendite giornaliere, registro invenduto e prezzo per pezzo.
"""
from fastapi import APIRouter, HTTPException, Query, Body, UploadFile, File
from datetime import datetime, timezone
from typing import Optional, List
from pymongo import UpdateOne
import uuid, re, io

router = APIRouter(prefix="/acquaviva", tags=["acquaviva"])

# ── ALLERGENI — keywords molto più ampie per copertura da Descrizione ─────────
ALLERGENI_MAP = {
    "glutine":           ["farina","grano","frument","orzo","segale","farro","avena","kamut","semola","pasta","pane","biscot","brioche","croissant","cornett","sfoglia","lievit","focacc","crackers","cracker","grissini"],
    "latte":             ["latte","burro","panna","formaggio","mozzarella","ricotta","mascarpone","yogurt","latticin","besciamella","cheddar","grana","parmigian","parvé","caciott","lattiero"],
    "uova":              ["uov","albume","tuorlo","maionese"],
    "frutta a guscio":   ["nocciola","noce","mandorla","pistacchio","anacardo","pinoli","arachid","pecan","noce di cocco","frutta a guscio","granella di noce"],
    "soia":              ["soia","tofu","lecitina di soia","proteina di soia"],
    "sesamo":            ["sesamo","tahina"],
    "senape":            ["senape","mostarda"],
    "sedano":            ["sedano"],
    "solfiti":           ["solfiti","solforosa","metabisolfito","e220","e221","e222","e223","e224"],
    "pesce":             ["pesce","merluzzo","salmone","tonno","acciuga","sardina","orata","baccalà","alice"],
    "crostacei":         ["gambero","aragosta","granchio","scampo","astice"],
    "molluschi":         ["cozze","vongole","calamaro","polpo","seppia","ostrica"],
    "lupini":            ["lupini","lupino"],
    "margarina":         ["margarina"],  # non allergene ufficiale ma importante
}

# Allergeni che richiedono dichiarazione obbligatoria
ALLERGENI_UE = {"glutine","latte","uova","frutta a guscio","soia","sesamo","senape","sedano","solfiti","pesce","crostacei","molluschi","lupini"}

def rileva_allergeni(nome: str = "", descrizione: str = "", categoria: str = "") -> List[str]:
    """Rileva allergeni dal nome + descrizione + categoria del prodotto."""
    testo = f"{nome} {descrizione} {categoria}".lower()
    trovati = []
    for allergene, kws in ALLERGENI_MAP.items():
        if any(kw in testo for kw in kws):
            trovati.append(allergene)
    return trovati

def rileva_allergeni_da_testo(testo: str) -> List[str]:
    return rileva_allergeni(descrizione=testo)


# ── IMPORT listino Excel ─────────────────────────────────────────────────────
async def import_listino_acquaviva(db, file_url: str = None, prodotti_json: list = None, fonte: str = "acquaviva"):
    """
    Importa il listino Acquaviva nel DB.
    Accetta lista di prodotti già parsati da Excel.
    """
    if not prodotti_json:
        return {"importati": 0, "aggiornati": 0}
    
    importati = 0
    aggiornati = 0
    
    # Carica prezzi dalle fatture per fornitori semilavorati (Acquaviva + Vandemoortele + Alpha)
    fatture_semi = await db.fatture.find(
        {"fornitore": {"$regex": "acquaviva|vandemoortele|alpha", "$options": "i"}},
        {"prodotti": 1, "fornitore": 1, "_id": 0}
    ).to_list(500)
    
    prezzi_da_fatture = {}   # nome_lower -> {prezzo_confezione, pz_confezione}
    for f in fatture_semi:
        for p in (f.get("prodotti") or []):
            desc_raw = (p.get("descrizione") or "").strip()
            if not desc_raw:
                continue
            desc_key = desc_raw.lower()
            prezzo = float(p.get("prezzo") or 0)
            quantita = float(p.get("quantita") or 1)
            if prezzo > 0:
                if desc_key not in prezzi_da_fatture:
                    prezzi_da_fatture[desc_key] = {"prezzo": prezzo, "quantita": quantita, "descrizione": desc_raw}
    
    def match_prezzo(nome_prodotto: str) -> dict:
        """Cerca il prezzo fattura più vicino per nome prodotto."""
        nk = nome_prodotto.lower()
        # Match esatto
        if nk in prezzi_da_fatture:
            return prezzi_da_fatture[nk]
        # Match parziale (il nome del prodotto è contenuto nella descrizione fattura)
        for dk, dv in prezzi_da_fatture.items():
            if len(nk) > 5 and nk[:10] in dk:
                return dv
            if len(dk) > 5 and dk[:10] in nk:
                return dv
        return {}
    
    for prod in prodotti_json:
        nome = (prod.get("Nome") or "").strip()
        if not nome:
            continue
        
        codice = str(prod.get("Codice") or "")
        img_url = prod.get("URL_Immagine") or ""
        categoria = prod.get("Categoria") or ""
        grammi_raw = prod.get("Grammi") or ""
        grammi = 0
        try:
            grammi = float(str(grammi_raw).replace(",", ".").split("-")[0].strip())
        except:
            pass
        pz_conf_raw = prod.get("Pz_Confezione") or ""
        pz_conf = 0
        try:
            pz_conf = float(str(pz_conf_raw).replace(",", ".").replace("*", "").strip())
        except:
            pass
        
        ingredienti_str = prod.get("Ingredienti") or ""
        allergeni_excel = prod.get("Allergeni") or ""
        descrizione = prod.get("Descrizione") or ""
        
        # Rileva allergeni da NOME + DESCRIZIONE + CATEGORIA (le colonne Ingredienti/Allergeni sono spesso vuote)
        allergeni = rileva_allergeni(nome=nome, descrizione=f"{descrizione} {ingredienti_str} {allergeni_excel}", categoria=categoria)
        
        # Cerca prezzo dalle fatture
        match = match_prezzo(nome)
        prezzo_acq = float(match.get("prezzo") or 0)
        pz_conf_fatt = float(match.get("quantita") or 0)
        
        # Usa pz_confezione dal listino se disponibile, altrimenti dalla fattura
        pz_eff = pz_conf if pz_conf > 0 else (pz_conf_fatt if pz_conf_fatt > 0 else 1)
        prezzo_singolo = round(prezzo_acq / pz_eff, 4) if pz_eff > 0 and prezzo_acq > 0 else 0

        doc = {
            "codice": codice,
            "nome": nome,
            "categoria": categoria,
            "grammi": grammi,
            "pz_confezione": pz_eff,
            "foto_url": img_url,
            "ingredienti_str": ingredienti_str,
            "descrizione": descrizione,
            "allergeni": allergeni,
            "prezzo_acquisto_confezione": prezzo_acq,
            "prezzo_singolo": prezzo_singolo,
            "prezzo_vendita": 0,
            "fonte": fonte,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        esistente = await db.acquaviva_prodotti.find_one({"codice": codice})
        if esistente:
            await db.acquaviva_prodotti.update_one(
                {"codice": codice},
                {"$set": doc}
            )
            aggiornati += 1
        else:
            doc["id"] = str(uuid.uuid4())
            doc["created_at"] = datetime.now(timezone.utc).isoformat()
            doc["prezzo_vendita"] = 0
            await db.acquaviva_prodotti.insert_one(doc)
            importati += 1
    
    return {"importati": importati, "aggiornati": aggiornati, "totale": importati + aggiornati}


# ── ENDPOINTS ────────────────────────────────────────────────────────────────

async def get_db():
    from app.routers.tracciabilita.server import db
    return db


@router.get("/prodotti")
async def get_acquaviva_prodotti(
    search: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    fonte: Optional[str] = Query(None)  # "acquaviva", "alpha", "vandemoortele", None=tutti
):
    from app.routers.tracciabilita.server import db
    query = {}
    if fonte:
        query["fonte"] = fonte
    else:
        # Per default mostra tutti i semilavorati (acquaviva + vandemoortele, non alpha)
        query["fonte"] = {"$in": ["acquaviva", "vandemoortele"]}
    if search:
        query["nome"] = {"$regex": search, "$options": "i"}
    if categoria:
        query["categoria"] = {"$regex": categoria, "$options": "i"}
    items = await db.acquaviva_prodotti.find(query, {"_id": 0}).sort("nome", 1).to_list(1000)
    return items


@router.get("/prodotti/senza-glutine")
async def get_prodotti_senza_glutine(search: Optional[str] = Query(None)):
    """Prodotti PROGETTO ALPHA (senza glutine)."""
    from app.routers.tracciabilita.server import db
    query = {"fonte": "alpha"}
    if search:
        query["nome"] = {"$regex": search, "$options": "i"}
    items = await db.acquaviva_prodotti.find(query, {"_id": 0}).sort("nome", 1).to_list(500)
    return items


@router.post("/import-listino-2026")
async def import_listino_2026(payload: dict = Body(...)):
    """
    Importa il listino Acquaviva/VDM 2026 con tutti i campi:
    codice_aqv_2025, codice_aqv_2026, categoria_aqv, categoria_vdm,
    descrizione, grammi, qty_cartone, unita_misura, prezzo_ct, iva_pct, ct_ble, ct_strato.
    
    Merge su: codice_aqv_2026 (che corrisponde al campo 'codice' nel DB).
    Se il prodotto esiste già, aggiorna SOLO i campi listino senza toccare prezzi vendita o foto.
    """
    prodotti = payload.get("prodotti", [])
    fonte = payload.get("fonte", "acquaviva")
    
    importati = 0
    aggiornati = 0
    errori = []
    
    for prod in prodotti:
        codice_2026 = str(prod.get("codice_aqv_2026", "") or "").strip()
        codice_2025 = str(prod.get("codice_aqv_2025", "") or "").strip()
        nome = (prod.get("descrizione", "") or "").strip()
        
        if not nome:
            continue
        
        # Codice principale = 2026, fallback 2025
        codice_principale = codice_2026 if codice_2026 else codice_2025
        
        # Grammi: parsing robusto (può essere "30-35", "18-20", ecc.)
        grammi_raw = str(prod.get("grammi", "") or "")
        grammi = 0.0
        try:
            grammi = float(grammi_raw.replace(",", ".").split("-")[0].split("/")[0].strip())
        except:
            pass
        
        # Prezzo CT (prezzo per cartone/confezione)
        prezzo_ct = 0.0
        try:
            prezzo_ct = float(str(prod.get("prezzo_ct", 0) or 0))
        except:
            pass
        
        qty_cartone = 0.0
        try:
            qty_cartone = float(str(prod.get("qty_cartone", 0) or 0))
        except:
            pass
        
        # Prezzo per singolo pezzo
        prezzo_singolo_calc = round(prezzo_ct / qty_cartone, 4) if qty_cartone > 0 and prezzo_ct > 0 else 0.0
        
        iva_pct = 10.0
        try:
            iva_pct = float(str(prod.get("iva_pct", 10) or 10))
        except:
            pass
        
        ct_ble = 0
        try:
            ct_ble = int(float(str(prod.get("ct_ble", 0) or 0)))
        except:
            pass
        
        ct_strato = 0
        try:
            ct_strato = int(float(str(prod.get("ct_strato", 0) or 0)))
        except:
            pass
        
        categoria_aqv = prod.get("categoria_aqv", "") or ""
        categoria_vdm = prod.get("categoria_vdm", "") or ""
        unita_misura  = prod.get("unita_misura", "PZ") or "PZ"
        
        allergeni = rileva_allergeni(nome=nome, descrizione=nome, categoria=categoria_aqv)
        
        # Campi da aggiornare / inserire
        campi_listino = {
            "codice_aqv_2025": codice_2025,
            "codice_aqv_2026": codice_2026,
            "categoria_aqv": categoria_aqv,
            "categoria_vdm": categoria_vdm,
            "nome": nome,
            "grammi": grammi,
            "pz_confezione": qty_cartone,
            "qty_cartone": qty_cartone,
            "unita_misura": unita_misura,
            "prezzo_ct": prezzo_ct,
            "prezzo_singolo": prezzo_singolo_calc,
            "iva_pct": iva_pct,
            "ct_ble": ct_ble,
            "ct_strato": ct_strato,
            "fonte": fonte,
            "data_listino": "2026-01-01",
            "allergeni": allergeni,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        try:
            # Cerca per codice 2026, poi per codice 2025 (migrazione)
            esistente = None
            if codice_2026:
                esistente = await db.acquaviva_prodotti.find_one({"codice": codice_2026})
            if not esistente and codice_2025:
                esistente = await db.acquaviva_prodotti.find_one({"codice": codice_2025})
            if not esistente:
                esistente = await db.acquaviva_prodotti.find_one({
                    "nome": {"$regex": nome[:15], "$options": "i"}
                })
            
            if esistente:
                # Aggiorna — mantiene prezzo_vendita, foto_url esistenti
                update_set = {**campi_listino, "codice": codice_principale}
                await db.acquaviva_prodotti.update_one(
                    {"_id": esistente["_id"]},
                    {"$set": update_set}
                )
                aggiornati += 1
            else:
                # Inserisci nuovo
                doc = {
                    **campi_listino,
                    "codice": codice_principale,
                    "categoria": f"{categoria_aqv} | {categoria_vdm}",
                    "foto_url": "",
                    "ingredienti_str": "",
                    "descrizione": "",
                    "prezzo_acquisto_confezione": prezzo_ct,
                    "prezzo_vendita": 0,
                    "id": str(uuid.uuid4()),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.acquaviva_prodotti.insert_one(doc)
                importati += 1
        except Exception as e:
            errori.append(f"{nome}: {str(e)[:80]}")
    
    return {
        "importati": importati,
        "aggiornati": aggiornati,
        "totale": importati + aggiornati,
        "errori": errori[:10]  # Mostra max 10 errori
    }



    """Importa lista prodotti parsati dall'Excel."""
    from app.routers.tracciabilita.server import db
    prodotti = payload.get("prodotti", [])
    fonte = payload.get("fonte", "acquaviva")  # "acquaviva", "alpha", "vandemoortele"
    result = await import_listino_acquaviva(db, prodotti_json=prodotti, fonte=fonte)
    return result


@router.post("/import-listino-pdf")
async def import_listino_da_pdf(file: UploadFile = File(...)):
    """
    Parsa il listino Acquaviva 2026 in PDF e aggiorna i prezzi
    sui prodotti già presenti in acquaviva_prodotti.
    Matching per codice (codice_aqv_2026 o codice_aqv_2025).
    Non crea prodotti nuovi — aggiorna solo i 352 esistenti.
    """
    from app.routers.tracciabilita.server import db as db_local
    content = await file.read()
    prodotti = []

    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    for row in table:
                        if not row or len(row) < 9:
                            continue
                        # Colonne: [cod2025, cod2026, cat_aqv, cat_vdm, descrizione, g, qty_ct, um, prezzo_unit, €ct, iva, ...]
                        cod2025 = str(row[0] or "").strip()
                        cod2026 = str(row[1] or "").strip()
                        nome    = str(row[4] or "").strip()
                        if not nome or cod2026 in ("CODICE AQV 2026", "CODICE\nAQV 2026", ""):
                            continue
                        if not cod2025.replace(" ", "").isdigit() and not cod2026.replace(" ", "").isdigit():
                            continue
                        try:
                            grammi      = float(re.sub(r'\s+', '', str(row[5] or "0")).replace(",", ".") or "0")
                            qty_cartone = float(re.sub(r'\s+', '', str(row[6] or "1")).replace(",", ".") or "1")
                            um          = str(row[7] or "PZ").strip().replace(" ", "") or "PZ"
                            prezzo_unit = float(re.sub(r'\s+', '', str(row[8] or "0")).replace(",", ".") or "0")
                            prezzo_ct   = float(re.sub(r'\s+', '', str(row[9] or "0")).replace(",", ".") or "0")
                            iva         = int(float(re.sub(r'\s+', '', str(row[10] or "10")).replace(",", ".") or "10"))
                        except (ValueError, TypeError, IndexError):
                            continue
                        if prezzo_unit <= 0 and prezzo_ct <= 0:
                            continue
                        prodotti.append({
                            "codice_aqv_2025": cod2025 or cod2026,
                            "codice_aqv_2026": cod2026 or cod2025,
                            "nome": nome,
                            "grammi": grammi,
                            "pz_confezione": int(qty_cartone) if qty_cartone >= 1 else 1,
                            "unita_misura": um,
                            "prezzo_acquisto_confezione": prezzo_ct if prezzo_ct > 0 else prezzo_unit,
                            "prezzo_singolo": round(prezzo_unit, 4),
                            "iva_pct": iva,
                        })
    except ImportError:
        raise HTTPException(500, "pdfplumber non disponibile. Contattare l'amministratore.")

    if not prodotti:
        raise HTTPException(400, "Nessun prodotto estratto dal PDF. Verificare il formato del file.")

    aggiornati = 0
    non_trovati = []

    # Carica tutti i prodotti AQV dal DB in un colpo solo (evita N+1 query)
    tutti_prodotti = await db_local.acquaviva_prodotti.find(
        {}, {"_id": 0, "id": 1, "codice": 1, "codice_aqv_2026": 1, "codice_aqv_2025": 1}
    ).to_list(2000)

    # Costruisce lookup per cod2026 e cod2025
    lookup: dict = {}
    for p in tutti_prodotti:
        for campo in ("codice", "codice_aqv_2026", "codice_aqv_2025"):
            val = str(p.get(campo, "") or "").strip()
            if val:
                lookup[val] = p["id"]

    from motor.motor_asyncio import AsyncIOMotorClient  # noqa: F401
    bulk_ops = []

    for prod in prodotti:
        cod2026 = prod.get("codice_aqv_2026", "")
        cod2025 = prod.get("codice_aqv_2025", "")
        pid = lookup.get(cod2026) or lookup.get(cod2025)
        if pid:
            bulk_ops.append(UpdateOne(
                {"id": pid},
                {"$set": {
                    "prezzo_acquisto_confezione": prod["prezzo_acquisto_confezione"],
                    "prezzo_singolo": prod["prezzo_singolo"],
                    "prezzo_ct": prod["prezzo_acquisto_confezione"],
                    "codice_aqv_2026": cod2026,
                    "codice_aqv_2025": cod2025,
                    "iva_pct": prod["iva_pct"],
                    "grammi": prod["grammi"],
                    "pz_confezione": prod["pz_confezione"],
                    "data_listino": "2026-01-01",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            ))
            aggiornati += 1
        else:
            non_trovati.append(f"{cod2026 or cod2025} — {prod['nome'][:40]}")

    if bulk_ops:
        await db_local.acquaviva_prodotti.bulk_write(bulk_ops, ordered=False)

    return {
        "estratti_da_pdf": len(prodotti),
        "aggiornati_nel_db": aggiornati,
        "non_trovati_nel_db": len(non_trovati),
        "esempi_non_trovati": non_trovati[:10]
    }


@router.put("/prodotti/{prodotto_id}/prezzo")
async def set_prezzi_prodotto(
    prodotto_id: str,
    prezzo_vendita: Optional[float] = Query(None),
    prezzo_acquisto_confezione: Optional[float] = Query(None),
    pz_confezione: Optional[float] = Query(None)
):
    """Aggiorna prezzi e pezzi per confezione di un prodotto semilavorato."""
    from app.routers.tracciabilita.server import db
    upd = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if prezzo_vendita is not None:
        upd["prezzo_vendita"] = prezzo_vendita
    if prezzo_acquisto_confezione is not None:
        upd["prezzo_acquisto_confezione"] = prezzo_acquisto_confezione
        # Ricalcola prezzo singolo
        prod = await db.acquaviva_prodotti.find_one({"id": prodotto_id})
        pz = pz_confezione or (prod.get("pz_confezione") if prod else 1) or 1
        upd["prezzo_singolo"] = round(prezzo_acquisto_confezione / pz, 4) if pz > 0 else 0
    if pz_confezione is not None:
        upd["pz_confezione"] = pz_confezione
    if not upd:
        return {"ok": False, "msg": "Nessun valore da aggiornare"}
    await db.acquaviva_prodotti.update_one({"id": prodotto_id}, {"$set": upd})
    return {"ok": True}


@router.post("/registra-vendita")
async def registra_vendita_acquaviva(
    prodotto_id: str = Query(...),
    pezzi_messi_in_vendita: int = Query(...),
    pezzi_venduti: int = Query(0),
    note: str = Query("")
):
    """
    Registra quanti pezzi si mettono in vendita di un prodotto Acquaviva.
    Applica stessa logica dell'invenduto.
    """
    from app.routers.tracciabilita.server import db
    prodotto = await db.acquaviva_prodotti.find_one({"id": prodotto_id}, {"_id": 0})
    if not prodotto:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    
    oggi = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    ora = datetime.now(timezone.utc).strftime("%H:%M")
    pezzi_invenduti = max(0, pezzi_messi_in_vendita - pezzi_venduti)
    
    prezzo_sing = float(prodotto.get("prezzo_vendita") or prodotto.get("prezzo_singolo") or 0)
    valore_invenduto = round(pezzi_invenduti * prezzo_sing, 2)
    valore_venduto = round(pezzi_venduti * prezzo_sing, 2)
    
    doc = {
        "id": str(uuid.uuid4()),
        "prodotto_id": prodotto_id,
        "nome_prodotto": prodotto["nome"],
        "categoria": prodotto.get("categoria", ""),
        "foto_url": prodotto.get("foto_url", ""),
        "allergeni": prodotto.get("allergeni", []),
        "data": oggi,
        "ora": ora,
        "pezzi_messi_in_vendita": pezzi_messi_in_vendita,
        "pezzi_venduti": pezzi_venduti,
        "pezzi_invenduti": pezzi_invenduti,
        "prezzo_singolo": prezzo_sing,
        "valore_venduto": valore_venduto,
        "valore_invenduto": valore_invenduto,
        "note": note,
        "fonte": "acquaviva",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.vendite_banco.insert_one(doc)
    return {"ok": True, "registrazione": {k: v for k, v in doc.items() if k != "id"}}


@router.get("/storico-vendite")
async def get_storico_vendite_acquaviva(
    data_da: Optional[str] = Query(None),
    data_a: Optional[str] = Query(None)
):
    from app.routers.tracciabilita.server import db
    query = {"fonte": "acquaviva"}
    if data_da:
        query["data"] = {"$gte": data_da}
    if data_a:
        query.setdefault("data", {})["$lte"] = data_a
    
    items = await db.vendite_banco.find(query, {"_id": 0}).sort("data", -1).to_list(500)
    return items


@router.get("/acquistati-da-fatture")
async def get_prodotti_acquistati_da_fatture():
    """
    Restituisce i prodotti Acquaviva/Vandemoortele effettivamente acquistati
    (trovati nelle fatture XML), non tutto il catalogo.
    Restituisce descrizione fattura + pz_cartone + peso_g + costo_pezzo + info prodotto_vendita (se linkato).
    """
    from app.routers.tracciabilita.server import db
    import re
    
    # Tutti i prodotti dalle fatture Vandemoortele
    fatture = await db.fatture.find(
        {"fornitore": {"$regex": "vandemoortele", "$options": "i"}},
        {"_id": 0, "prodotti": 1, "data_fattura": 1}
    ).to_list(200)
    
    # Aggrega per descrizione
    per_desc = {}
    for fat in fatture:
        for p in fat.get("prodotti", []):
            desc = p.get("descrizione", "").strip()
            qty = float(p.get("quantita", 0) or 0)
            prezzo = float(p.get("prezzo", 0) or 0)
            if not desc or qty <= 0:
                continue
            m_peso = re.search(r"(\d+\.?\d*)\s*G\b", desc.upper())
            peso_g = float(m_peso.group(1)) if m_peso else None
            m_kg = re.search(r"(\d+\.?\d*)\s*KG", desc.upper())
            kg_cart = float(m_kg.group(1)) if m_kg else None
            pz_cart = round(kg_cart * 1000 / peso_g) if kg_cart and peso_g and peso_g > 0 else None
            if desc not in per_desc:
                per_desc[desc] = {
                    "descrizione": desc,
                    "cartoni_totali": 0,
                    "peso_g": peso_g,
                    "pz_cartone": pz_cart,
                    "prezzo_cartone": prezzo,
                    "costo_pezzo": round(prezzo / pz_cart, 4) if pz_cart and prezzo > 0 else 0
                }
            per_desc[desc]["cartoni_totali"] += qty
    
    # Cerca match in prodotti_vendita (per nome parziale)
    pv_acq = await db.prodotti_vendita.find(
        {"fonte": "acquaviva"},
        {"_id": 0, "id": 1, "nome": 1, "prezzo_vendita": 1, "costo_produzione": 1,
         "margine_percentuale": 1, "pezzi_cartone": 1, "peso_pezzo_g": 1,
         "immagine_url": 1, "categoria": 1, "attivo": 1}
    ).to_list(500)
    
    # Crea mappa nome_semplice → prodotto_vendita
    pv_map = {}
    for pv in pv_acq:
        chiave = pv["nome"].lower().replace(" ", "")[:10]
        pv_map[chiave] = pv
    
    risultati = []
    pv_usati = set()  # evita duplicati nella lista risultati
    for desc, info in sorted(per_desc.items(), key=lambda x: -x[1]["cartoni_totali"]):
        # Cerca match prodotto_vendita per parole chiave (non già usato)
        match_pv = None
        desc_upper = desc.upper()
        for pv in pv_acq:
            if pv["id"] in pv_usati:
                continue
            nome_low = pv["nome"].lower()
            nome_words = [w for w in nome_low.split() if len(w) > 3]
            # Calcola quante parole del nome_pv appaiono nella descrizione fattura
            hits = sum(1 for w in nome_words if w.upper() in desc_upper or w in desc_upper.lower())
            if hits >= min(2, len(nome_words)):
                match_pv = pv
                pv_usati.add(pv["id"])
                break
        
        row = {
            "id": match_pv["id"] if match_pv else None,
            "nome": match_pv["nome"] if match_pv else desc,
            "descrizione_fattura": desc,
            "cartoni_totali": info["cartoni_totali"],
            "peso_g": info["peso_g"],
            "pz_cartone": match_pv.get("pezzi_cartone") if match_pv else info["pz_cartone"],
            "prezzo_cartone": info["prezzo_cartone"],
            "costo_pezzo": match_pv.get("costo_produzione") if match_pv and match_pv.get("costo_produzione") else info["costo_pezzo"],
            "prezzo_vendita": match_pv.get("prezzo_vendita", 0) if match_pv else 0,
            "margine_pct": match_pv.get("margine_percentuale", 0) if match_pv else 0,
            "immagine_url": match_pv.get("immagine_url") if match_pv else None,
            "categoria": match_pv.get("categoria", "") if match_pv else "",
            "attivo": match_pv.get("attivo", True) if match_pv else True,
            "in_prodotti_vendita": match_pv is not None,
            "fonte": "acquaviva"
        }
        risultati.append(row)
    
    return {
        "totale": len(risultati),
        "con_prezzo": sum(1 for r in risultati if (r.get("prezzo_vendita") or 0) > 0),
        "prodotti": risultati
    }


@router.get("/magazzino-congelatore")
async def get_magazzino_congelatore():
    """
    Calcola il magazzino semilavorati (Acquaviva/Vandemoortele) in congelatore.
    
    Formula reale:
    - ENTRATE  = cartoni acquistati dalle fatture Vandemoortele × pezzi per cartone
                 (il n. pezzi per cartone si ricava da: peso_cartone_kg / peso_pezzo_g)
    - USCITE   = pezzi portati al banco ogni giorno (vendite_banco fonte=colazione, pezzi_prodotti)
    - Gli invenduti NON rientrano in congelatore (vengono scartati/consumati)
    - SALDO CONGELATORE = ENTRATE - USCITE
    
    Restituisce:
    - Totale pezzi in congelatore (entrate - uscite) per prodotto
    - Lista dettagliata per prodotto Vandemoortele
    """
    from app.routers.tracciabilita.server import db
    from datetime import datetime, timezone
    import re
    
    anno = datetime.now(timezone.utc).year
    data_inizio_anno = f"{anno}-01-01"
    oggi = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # ── 1. ENTRATE: solo dalle ultime 2 fatture Vandemoortele ──────────────────
    # Le fatture precedenti sono già state consumate completamente.
    # Solo i cartoni delle ultime 2 consegne sono fisicamente ancora in congelatore.
    tutte_fatture = await db.fatture.find(
        {"fornitore": {"$regex": "vandemoortele", "$options": "i"}},
        {"_id": 0, "prodotti": 1, "data_fattura": 1, "numero_fattura": 1}
    ).sort("data_fattura", -1).to_list(200)

    # Prendo solo le ultime 2
    fatture = tutte_fatture[:2]
    
    # Aggrega cartoni per descrizione
    entrate_desc = {}  # desc → {cartoni, peso_g, kg_cartone, prezzo_cartone}
    for fat in fatture:
        for p in fat.get("prodotti", []):
            desc = p.get("descrizione", "").strip()
            qty = float(p.get("quantita", 0) or 0)
            prezzo = float(p.get("prezzo", 0) or 0)
            if not desc or qty <= 0:
                continue
            
            # Estrai peso pezzo (es. 35G, 80G, 100G) dalla descrizione
            m_peso = re.search(r"(\d+\.?\d*)\s*G\b", desc.upper())
            peso_g = float(m_peso.group(1)) if m_peso else None
            
            # Estrai peso cartone in KG — prende l'ULTIMO valore KG plausibile (< 50kg)
            # Gestisce errori come "494KG" (ocr/typo di 4.94KG) e "3,84KG" (virgola)
            m_kg_all = re.findall(r"([\d]+[.,]?[\d]*)\s*KG", desc.upper())
            kg_cart = None
            for val in reversed(m_kg_all):
                v = float(val.replace(',', '.'))
                if 0.5 < v < 50:   # peso cartone realistico tra 0.5 e 50 kg
                    kg_cart = v
                    break
            # Se ancora None, prova a correggere valori anomali come 494 → 4.94
            if kg_cart is None and m_kg_all:
                v = float(m_kg_all[-1].replace(',', '.'))
                if v > 50:
                    kg_cart = round(v / 100, 2)
            
            # Calcola pezzi per cartone
            pz_cart = round(kg_cart * 1000 / peso_g) if kg_cart and peso_g and peso_g > 0 else None
            
            if desc not in entrate_desc:
                entrate_desc[desc] = {
                    "cartoni": 0,
                    "peso_g": peso_g,
                    "kg_cartone": kg_cart,
                    "pz_cartone": pz_cart,
                    "prezzo_cartone": prezzo,
                    "pz_totali": 0
                }
            entrate_desc[desc]["cartoni"] += qty
            if pz_cart:
                entrate_desc[desc]["pz_totali"] += int(qty * pz_cart)
    
    # ── 2. USCITE: pezzi portati al banco dalla data della penultima fattura ────
    # Solo le uscite successive alla consegna più vecchia tra le 2 in congelatore
    data_min_fattura = fatture[-1]["data_fattura"] if fatture else data_inizio_anno
    uscite = await db.vendite_banco.aggregate([
        {"$match": {"fonte": "colazione", "data": {"$gte": data_min_fattura}}},
        {"$group": {
            "_id": "$prodotto_nome",
            "pezzi_usciti": {"$sum": "$pezzi_prodotti"}
        }}
    ]).to_list(500)
    
    # Somma totale uscite
    totale_uscite = sum(u["pezzi_usciti"] for u in uscite)
    uscite_per_nome = {u["_id"]: u["pezzi_usciti"] for u in uscite}
    
    # ── 3. Costruisci risposta per prodotto ──────────────────────────────────
    totale_entrate = sum(e["pz_totali"] for e in entrate_desc.values())
    saldo_congelatore = max(0, totale_entrate - totale_uscite)
    
    prodotti_result = []
    for desc, info in sorted(entrate_desc.items(), key=lambda x: -x[1]["pz_totali"]):
        pezzi_entrati = info["pz_totali"]
        pz_cart = info.get("pz_cartone")
        
        # Fuzzy match uscite: mapping nome commerciale → sigla fattura
        MAPPING_NOMI = {
            "baby": ["baby"],
            "tappo": ["tappi"],
            "tappi": ["tappi"],
            "sfogliatella napoletana": ["napoletan"],
            "sfogliatella frolla": ["frolla"],
            "coda": ["coda"],
            "calise": ["cali stra"],
            "integrale miele": ["whml", "mltcer honey"],
            "multicereali": ["mltcer"],
            "frutti di bosco": ["mltcer ber", "fdb"],
            "ciambella": ["cmbll"],
            "arancia": ["orange"],
            "melagrana": ["pom"],
            "pistacchi": ["pstch"],
            "cannella": ["cin crm"],
            "mandorle": ["almonds", "doram"],
            "doramì": ["doram"],
            "dorama": ["doram"],
            "vegano": ["vgn"],
            "black": ["black"],
        }
        
        pezzi_usciti_prod = 0
        desc_lower = desc.lower()
        for nome_uscita, pz_usciti in uscite_per_nome.items():
            nome_lower = (nome_uscita or "").lower()
            matched = False
            for kw_nome, kw_lista_fattura in MAPPING_NOMI.items():
                if kw_nome in nome_lower:
                    for kw_f in kw_lista_fattura:
                        if kw_f in desc_lower:
                            matched = True
                            break
                if matched:
                    break
            if not matched:
                # Fallback: token comuni (≥ 2 parole chiave in comune)
                token_desc = set(desc_lower.split()[:5])
                token_nome = set(nome_lower.split()[:5])
                matched = len(token_desc & token_nome) >= 2
            if matched:
                pezzi_usciti_prod += pz_usciti
        
        saldo_prod = max(0, pezzi_entrati - pezzi_usciti_prod)
        
        prodotti_result.append({
            "descrizione_fattura": desc,
            "cartoni_acquistati": info["cartoni"],
            "pz_cartone": pz_cart,
            "peso_g": info.get("peso_g"),
            "pezzi_entrati": pezzi_entrati,
            "pezzi_usciti": pezzi_usciti_prod,
            "saldo": saldo_prod,
            "prezzo_cartone": info.get("prezzo_cartone", 0),
            "costo_pezzo": round(info.get("prezzo_cartone", 0) / pz_cart, 4) if pz_cart else 0
        })
    
    return {
        "anno": anno,
        "data_inizio": data_inizio_anno,
        "num_fatture_vandemoortele": len(fatture),
        "fatture_in_congelatore": [{"numero": f.get("numero_fattura"), "data": f.get("data_fattura")} for f in fatture],
        "totale_pezzi_entrati": totale_entrate,
        "totale_pezzi_usciti": totale_uscite,
        "saldo_congelatore": saldo_congelatore,
        "num_referenze": len(prodotti_result),
        # Riepilogo uscite per nome prodotto (dai vendite_banco)
        "uscite_per_prodotto": [{"nome": k, "pezzi": v} for k, v in sorted(uscite_per_nome.items(), key=lambda x: -x[1])],
        "prodotti": prodotti_result
    }


@router.post("/sync-prezzi")
@router.post("/sync-prezzi")
async def sync_prezzi_da_fatture(fonte: Optional[str] = Query(None)):
    """
    Sincronizza i prezzi di acquisto per tutti i prodotti semilavorati
    cercando nelle fatture dei fornitori (Acquaviva, Vandemoortele, Alpha).
    Restituisce quanti prodotti sono stati aggiornati con un prezzo trovato.
    """
    return await _sync_prezzi_core(fonte=fonte)


async def _sync_prezzi_core(fonte: Optional[str] = None) -> dict:
    """Logica effettiva sync prezzi — chiamabile da pipeline e da HTTP."""
    from app.routers.tracciabilita.server import db

    query_prod = {}
    if fonte:
        query_prod["fonte"] = fonte
    else:
        query_prod["fonte"] = {"$in": ["acquaviva", "vandemoortele", "alpha"]}

    prodotti = await db.acquaviva_prodotti.find(query_prod, {"_id": 0}).to_list(2000)

    # Carica tutte le righe prodotto dalle fatture Acquaviva/Vandemoortele/Alpha
    fatture_semi = await db.fatture.find(
        {"fornitore": {"$regex": "acquaviva|vandemoortele|alpha|progetto", "$options": "i"}},
        {"prodotti": 1, "fornitore": 1, "data_fattura": 1, "_id": 0}
    ).to_list(1000)

    # Costruisci mappa: nome_lower -> {prezzo, quantita}
    prezzi_map: dict = {}
    for f in fatture_semi:
        for p in (f.get("prodotti") or []):
            desc = (p.get("descrizione") or "").strip()
            if not desc:
                continue
            key = desc.lower()
            prezzo = float(p.get("prezzo") or 0)
            if prezzo > 0 and key not in prezzi_map:
                prezzi_map[key] = {"prezzo": prezzo, "quantita": float(p.get("quantita") or 1), "fornitore": f.get("fornitore", "")}

    def _match(nome: str) -> dict:
        nk = nome.lower().strip()
        if nk in prezzi_map:
            return prezzi_map[nk]
        # Primo token significativo (10+ chars)
        for dk, dv in prezzi_map.items():
            if len(nk) >= 6 and nk[:10] in dk:
                return dv
            if len(dk) >= 6 and dk[:10] in nk:
                return dv
        return {}

    aggiornati = 0
    non_trovati = 0
    for prod in prodotti:
        match = _match(prod.get("nome", ""))
        if not match:
            non_trovati += 1
            continue
        prezzo_fatt = match["prezzo"]
        pz = float(prod.get("pz_confezione") or match.get("quantita") or 1)

        # Per prodotti Alpha (Progetto Alpha S.R.L.S): il prezzo in fattura è già per pezzo
        # Per Acquaviva/Vandemoortele: il prezzo è per confezione → dividi per pz
        if prod.get("fonte") == "alpha":
            prezzo_sing = prezzo_fatt   # già prezzo al pezzo
            prezzo_conf = round(prezzo_fatt * pz, 4)
        else:
            prezzo_conf = prezzo_fatt
            prezzo_sing = round(prezzo_fatt / pz, 4) if pz > 0 else 0

        await db.acquaviva_prodotti.update_one(
            {"id": prod["id"]},
            {"$set": {
                "prezzo_acquisto_confezione": prezzo_conf,
                "prezzo_singolo": prezzo_sing,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        aggiornati += 1

    return {
        "aggiornati": aggiornati,
        "non_trovati": non_trovati,
        "totale": len(prodotti)
    }


@router.post("/import-alpha")
async def import_alpha_da_xml(payload: dict):
    """
    Importa prodotti PROGETTO ALPHA direttamente da file XML p7m.
    Riceve lista prodotti già parsati e crea i record nel catalogo.
    """
    from app.routers.tracciabilita.server import db
    prodotti_raw = payload.get("prodotti", [])
    if not prodotti_raw:
        return {"importati": 0, "msg": "Nessun prodotto fornito"}

    importati = 0
    aggiornati = 0
    for p in prodotti_raw:
        nome = (p.get("nome") or "").strip()
        if not nome:
            continue
        prezzo_unit = float(p.get("prezzo_unitario") or 0)
        qty = float(p.get("quantita") or 1)
        allergeni = rileva_allergeni(nome=nome, descrizione=p.get("descrizione") or "")

        doc = {
            "nome": nome,
            "categoria": "Senza Glutine",
            "grammi": 0,
            "pz_confezione": qty,
            "foto_url": "",
            "ingredienti_str": "",
            "descrizione": p.get("descrizione") or "",
            "allergeni": allergeni,
            "prezzo_acquisto_confezione": round(prezzo_unit * qty, 4),
            "prezzo_singolo": prezzo_unit,
            "prezzo_vendita": 0,
            "fonte": "alpha",
            "codice": f"ALPHA-{nome[:20].replace(' ','-').upper()}",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        esistente = await db.acquaviva_prodotti.find_one({"nome": nome, "fonte": "alpha"})
        if esistente:
            await db.acquaviva_prodotti.update_one({"nome": nome, "fonte": "alpha"}, {"$set": doc})
            aggiornati += 1
        else:
            doc["id"] = str(uuid.uuid4())
            doc["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.acquaviva_prodotti.insert_one(doc)
            importati += 1

    return {"importati": importati, "aggiornati": aggiornati, "totale": importati + aggiornati}
