"""
Router per Colazione Acquaviva.
Gestisce il template giornaliero dei prodotti che escono al banco mattina.
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel
import uuid

router = APIRouter(prefix="/colazione-acquaviva", tags=["colazione"])


class ColazioneItem(BaseModel):
    prodotto_id: str
    prodotto_nome: str
    pezzi: int
    foto_url: Optional[str] = None
    categoria: Optional[str] = None
    prezzo_vendita: Optional[float] = 0.0
    attivo: bool = True  # spuntato per la registrazione


class ColazioneTemplate(BaseModel):
    nome: str = "Colazione Acquaviva"
    items: List[ColazioneItem] = []
    note: Optional[str] = None


# ── GET template attivo ────────────────────────────────────────────────────────
@router.get("")
async def get_colazione(request: object = None):
    from app.routers.tracciabilita.server import db
    doc = await db.colazione_template.find_one({"nome": "Colazione Acquaviva"}, {"_id": 0})
    if not doc:
        return {"nome": "Colazione Acquaviva", "items": [], "note": None, "ultima_modifica": None}
    return doc


# ── PUT: salva/aggiorna il template ───────────────────────────────────────────
@router.put("")
async def salva_colazione(template: ColazioneTemplate):
    from app.routers.tracciabilita.server import db
    now = datetime.now(timezone.utc).isoformat()
    doc = template.dict()
    doc["ultima_modifica"] = now
    await db.colazione_template.update_one(
        {"nome": "Colazione Acquaviva"},
        {"$set": doc},
        upsert=True
    )
    return {"success": True, "ultima_modifica": now}


# ── POST: registra tutti gli item attivi come vendita al banco ────────────────
@router.post("/registra")
async def registra_colazione(data: dict = None):
    """
    Registra tutti gli item attivi del template come:
    1. Vendita al banco (vendite_banco)
    2. Produzione giornaliera (produzioni) — per storico e food cost
    3. Lotto tracciabilità (lotti) — per la tracciabilità HACCP
    """
    from app.routers.tracciabilita.server import db

    doc = await db.colazione_template.find_one({"nome": "Colazione Acquaviva"}, {"_id": 0})
    if not doc or not doc.get("items"):
        raise HTTPException(status_code=404, detail="Nessun template colazione trovato")

    items_attivi = [i for i in doc["items"] if i.get("attivo", True) and i.get("pezzi", 0) > 0]
    if not items_attivi:
        raise HTTPException(status_code=400, detail="Nessun prodotto attivo nel template")

    oggi = datetime.now(timezone.utc).isoformat().split("T")[0]
    ora_now = datetime.now(timezone.utc).isoformat()
    registrati = []
    errori = []

    for item in items_attivi:
        try:
            prod_id   = item["prodotto_id"]
            prod_nome = item["prodotto_nome"]
            pezzi     = item["pezzi"]
            prezzo    = item.get("prezzo_vendita", 0) or 0

            # ── 1. Vendita al banco ────────────────────────────────────────────
            record_banco = {
                "id": str(uuid.uuid4()),
                "prodotto_id": prod_id,
                "prodotto_nome": prod_nome,
                "reparto": "pasticceria",
                "pezzi_prodotti": pezzi,
                "pezzi_venduti": 0,
                "foto_url": item.get("foto_url"),
                "data": oggi,
                "fonte": "colazione",
                "stato": "aperto",
                "created_at": ora_now
            }
            await db.vendite_banco.insert_one(record_banco)
            record_banco.pop("_id", None)

            # ── 2. Produzione (storico produzioni) ─────────────────────────────
            # Cerca la ricetta collegata per food cost
            ricetta = await db.ricette.find_one(
                {"nome": {"$regex": prod_nome, "$options": "i"}},
                {"_id": 0, "id": 1, "costo_totale": 1, "pezzi_produzione": 1}
            )
            costo_totale_prod = 0.0
            if ricetta:
                ct  = ricetta.get("costo_totale") or 0
                pzr = ricetta.get("pezzi_produzione") or 1
                costo_totale_prod = round((ct / pzr) * pezzi, 2)

            produzione_id = str(uuid.uuid4())
            await db.produzioni.insert_one({
                "id": produzione_id,
                "ricetta_nome": prod_nome,
                "ricetta_id": (ricetta or {}).get("id", prod_id),
                "quantita": pezzi,
                "unita": "pz",
                "costo_produzione": costo_totale_prod,
                "data": oggi,
                "fonte": "colazione",
                "reparto": "pasticceria",
                "created_at": ora_now
            })

            # ── 3. Lotto tracciabilità ─────────────────────────────────────────
            lotto_id = f"COL-{oggi.replace('-','')}-{prod_nome[:6].upper().replace(' ','')}"
            await db.lotti.update_one(
                {"lotto_id": lotto_id},
                {"$set": {
                    "lotto_id": lotto_id,
                    "prodotto_nome": prod_nome,
                    "prodotto_id": prod_id,
                    "quantita": pezzi,
                    "unita": "pz",
                    "data_produzione": oggi,
                    "reparto": "pasticceria",
                    "fonte": "colazione",
                    "produzione_id": produzione_id,
                    "created_at": ora_now
                }},
                upsert=True
            )

            # ── 4. Aggiorna contatore Acquaviva ────────────────────────────────
            await db.acquaviva_prodotti.update_one(
                {"id": prod_id},
                {"$inc": {"pezzi_messi_in_vendita_totale": pezzi}}
            )

            registrati.append({
                "nome": prod_nome,
                "pezzi": pezzi,
                "prezzo_unitario": prezzo,
                "valore_totale": round(prezzo * pezzi, 2),
                "lotto_id": lotto_id
            })
        except Exception as e:
            errori.append({"nome": item.get("prodotto_nome"), "errore": str(e)})

    valore_totale = sum(r["valore_totale"] for r in registrati)
    pezzi_totali  = sum(r["pezzi"] for r in registrati)

    # Log colazione
    await db.colazione_log.insert_one({
        "id": str(uuid.uuid4()),
        "data": oggi,
        "registrati": registrati,
        "errori": errori,
        "valore_totale": valore_totale,
        "pezzi_totali": pezzi_totali,
        "created_at": ora_now
    })

    return {
        "success": True,
        "data": oggi,
        "prodotti_registrati": len(registrati),
        "pezzi_totali": pezzi_totali,
        "valore_totale": valore_totale,
        "registrati": registrati,
        "errori": errori
    }


# ── GET: storico colazioni registrate ─────────────────────────────────────────
@router.get("/storico")
async def get_storico_colazioni(limit: int = 30):
    from app.routers.tracciabilita.server import db
    docs = await db.colazione_log.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return docs


# ── GET: prodotti disponibili per colazione (tutti Acquaviva visibili) ─────────
@router.get("/prodotti-disponibili")
async def get_prodotti_disponibili():
    from app.routers.tracciabilita.server import db
    prodotti = await db.prodotti_vendita.find(
        {"fonte": {"$regex": "acquaviva", "$options": "i"}, "visibile_tablet": True},
        {"_id": 0, "id": 1, "nome": 1, "foto_url": 1, "categoria": 1,
         "prezzo_vendita": 1, "pezzi_cartone": 1, "codice_prodotto": 1}
    ).sort("nome", 1).to_list(1000)

    # Arricchisci con foto da acquaviva_prodotti (dove risiedono le immagini)
    if prodotti:
        codici = [p.get("codice_prodotto") for p in prodotti if p.get("codice_prodotto")]
        acq_prods = await db.acquaviva_prodotti.find(
            {"codice": {"$in": codici}, "foto_url": {"$exists": True}},
            {"_id": 0, "codice": 1, "foto_url": 1, "categoria": 1}
        ).to_list(2000)
        foto_map = {ap["codice"]: ap.get("foto_url") for ap in acq_prods if ap.get("foto_url")}
        cat_map = {ap["codice"]: ap.get("categoria") for ap in acq_prods if ap.get("categoria")}
        for p in prodotti:
            cod = p.get("codice_prodotto")
            if cod and not p.get("foto_url") and cod in foto_map:
                p["foto_url"] = foto_map[cod]
            if cod and not p.get("categoria") and cod in cat_map:
                p["categoria"] = cat_map[cod]

    return prodotti
