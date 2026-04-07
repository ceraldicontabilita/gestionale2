"""
Estratto Conto — Upload CSV BPM, parse, salva movimenti.
Collection: estratto_conto_movimenti
Prefix: /api/estratto-conto
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from typing import Optional
import logging

from app.database import get_database
from app.parsers.estratto_conto_csv import parse_estratto_conto_csv

router = APIRouter()
logger = logging.getLogger(__name__)
COLL = "estratto_conto_movimenti"


def _oid(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


@router.post("/upload-csv")
async def upload_estratto_conto(file: UploadFile = File(...), db: AsyncIOMotorDatabase = Depends(get_database)):
    """Upload CSV estratto conto BPM, parsa e salva movimenti."""
    content = await file.read()
    # Prova UTF-8, poi latin-1
    for enc in ("utf-8", "latin-1", "cp1252"):
        try:
            csv_str = content.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise HTTPException(400, "Encoding non riconosciuto")

    parsed = parse_estratto_conto_csv(csv_str)
    if parsed.get("errore"):
        raise HTTPException(400, parsed["errore"])

    movimenti = parsed["movimenti"]
    importati = 0
    duplicati = 0

    for mov in movimenti:
        existing = await db[COLL].find_one({"chiave": mov["chiave"]})
        if existing:
            duplicati += 1
            continue
        mov["filename"] = file.filename
        mov["imported_at"] = datetime.utcnow()
        await db[COLL].insert_one(mov)
        importati += 1

    return {
        "ok": True,
        "importati": importati,
        "duplicati": duplicati,
        "totale_entrate": parsed["totale_entrate"],
        "totale_uscite": parsed["totale_uscite"],
        "saldo_netto": parsed["saldo_netto"],
    }


@router.get("")
async def lista_movimenti(
    data_da: Optional[str] = None, data_a: Optional[str] = None,
    categoria: Optional[str] = None,
    riconciliato: Optional[bool] = None,
    skip: int = 0, limit: int = 100,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    filtro = {}
    if data_da:
        filtro.setdefault("data_operazione", {})["$gte"] = data_da
    if data_a:
        filtro.setdefault("data_operazione", {})["$lte"] = data_a
    if categoria:
        filtro["categoria"] = categoria
    if riconciliato is not None:
        filtro["riconciliato"] = riconciliato

    cursor = db[COLL].find(filtro).sort("data_operazione", -1).skip(skip).limit(limit)
    items = [_oid(doc) async for doc in cursor]
    totale = await db[COLL].count_documents(filtro)
    return {"items": items, "totale": totale}


@router.get("/saldo")
async def saldo_banca(db: AsyncIOMotorDatabase = Depends(get_database)):
    pipeline = [
        {"$group": {"_id": None, "saldo": {"$sum": "$importo"},
                     "entrate": {"$sum": {"$cond": [{"$gt": ["$importo", 0]}, "$importo", 0]}},
                     "uscite": {"$sum": {"$cond": [{"$lt": ["$importo", 0]}, {"$abs": "$importo"}, 0]}},
                     "n_movimenti": {"$sum": 1}}}
    ]
    agg = await db[COLL].aggregate(pipeline).to_list(1)
    r = agg[0] if agg else {}
    return {
        "saldo": round(r.get("saldo", 0), 2),
        "entrate": round(r.get("entrate", 0), 2),
        "uscite": round(r.get("uscite", 0), 2),
        "n_movimenti": r.get("n_movimenti", 0),
    }
