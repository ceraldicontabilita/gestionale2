"""
Fatture Passive — Upload XML, parse, salva in DB.
Collection: fatture_passive
Prefix: /api/fatture
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from typing import Optional
import logging

from app.database import get_database
from app.parsers.fattura_xml import parse_fattura_xml

router = APIRouter()
logger = logging.getLogger(__name__)


def _oid(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


@router.get("")
async def lista_fatture(
    anno: Optional[int] = None, fornitore: Optional[str] = None,
    skip: int = 0, limit: int = 100,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    filtro = {}
    if anno:
        filtro["anno"] = anno
    if fornitore:
        filtro["$or"] = [
            {"fornitore_denominazione": {"$regex": fornitore, "$options": "i"}},
            {"fornitore_piva": fornitore},
        ]
    cursor = db["fatture_passive"].find(filtro).sort("data", -1).skip(skip).limit(limit)
    result = [_oid(doc) async for doc in cursor]
    totale = await db["fatture_passive"].count_documents(filtro)
    return {"items": result, "totale": totale}


@router.get("/stats")
async def stats_fatture(anno: int = 2026, db: AsyncIOMotorDatabase = Depends(get_database)):
    pipeline = [
        {"$match": {"anno": anno}},
        {"$group": {"_id": None, "imponibile": {"$sum": "$imponibile"}, "iva": {"$sum": "$iva"},
                    "totale": {"$sum": "$importo_totale"}, "count": {"$sum": 1}}}
    ]
    agg = await db["fatture_passive"].aggregate(pipeline).to_list(1)
    return agg[0] if agg else {"imponibile": 0, "iva": 0, "totale": 0, "count": 0}


@router.post("/upload-xml")
async def upload_fattura_xml(file: UploadFile = File(...), db: AsyncIOMotorDatabase = Depends(get_database)):
    content = await file.read()
    xml_str = content.decode("utf-8", errors="ignore")
    try:
        fatture = parse_fattura_xml(xml_str)
    except Exception as e:
        raise HTTPException(400, f"Errore parsing XML: {e}")
    if not fatture:
        raise HTTPException(400, "Nessuna fattura trovata nel file")

    inserite, duplicate = 0, 0
    for f in fatture:
        if await db["fatture_passive"].find_one({"dedup_key": f["dedup_key"]}):
            duplicate += 1
            continue
        doc = {
            "fornitore_denominazione": f["cedente"].get("denominazione", ""),
            "fornitore_piva": f["cedente"].get("partita_iva", ""),
            "numero": f["numero"], "data": f["data"],
            "anno": int(f["data"][:4]) if f["data"] and len(f["data"]) >= 4 else 0,
            "tipo_documento": f["tipo_documento"],
            "importo_totale": f["importo_totale"], "imponibile": f["imponibile"], "iva": f["iva"],
            "causale": f["causale"], "linee": f["linee"],
            "riepilogo_iva": f["riepilogo_iva"], "pagamenti": f["pagamenti"],
            "dedup_key": f["dedup_key"], "stato": "da_confermare",
            "xml_filename": file.filename, "created_at": datetime.utcnow(),
        }
        await db["fatture_passive"].insert_one(doc)
        inserite += 1
        if f["cedente"].get("partita_iva"):
            await db["fornitori"].update_one(
                {"partita_iva": f["cedente"]["partita_iva"]},
                {"$set": {"denominazione": f["cedente"]["denominazione"],
                          "partita_iva": f["cedente"]["partita_iva"], "updated_at": datetime.utcnow()},
                 "$setOnInsert": {"created_at": datetime.utcnow()}}, upsert=True)

    return {"ok": True, "inserite": inserite, "duplicate": duplicate, "totale_file": len(fatture)}


@router.get("/{fatt_id}")
async def get_fattura(fatt_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    doc = await db["fatture_passive"].find_one({"_id": ObjectId(fatt_id)})
    if not doc:
        raise HTTPException(404, "Fattura non trovata")
    return _oid(doc)
