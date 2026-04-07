"""
Verbali — Upload PDF verbali CdS/bollo, parse, salva.
Collection: verbali
Prefix: /api/verbali
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from typing import Optional
import logging

from app.database import get_database
from app.parsers.verbale import parse_verbale_pdf

router = APIRouter()
logger = logging.getLogger(__name__)


def _oid(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


@router.get("")
async def lista_verbali(
    tipo: Optional[str] = None, skip: int = 0, limit: int = 100,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    filtro = {}
    if tipo:
        filtro["tipo"] = tipo
    cursor = db["verbali"].find(filtro).sort("created_at", -1).skip(skip).limit(limit)
    result = [_oid(doc) async for doc in cursor]
    return {"items": result, "totale": await db["verbali"].count_documents(filtro)}


@router.post("/upload-pdf")
async def upload_verbale(file: UploadFile = File(...), db: AsyncIOMotorDatabase = Depends(get_database)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Solo PDF")
    content = await file.read()
    try:
        parsed = parse_verbale_pdf(pdf_bytes=content)
    except Exception as e:
        raise HTTPException(400, f"Errore parsing: {e}")

    doc = {**parsed, "pdf_filename": file.filename, "stato": "da_pagare", "created_at": datetime.utcnow()}
    result = await db["verbali"].insert_one(doc)
    return {"ok": True, "_id": str(result.inserted_id), "parsed": parsed}


@router.get("/{verb_id}")
async def get_verbale(verb_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    doc = await db["verbali"].find_one({"_id": ObjectId(verb_id)})
    if not doc:
        raise HTTPException(404, "Verbale non trovato")
    return _oid(doc)
