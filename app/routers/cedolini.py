"""
Cedolini — Upload PDF buste paga, parse, salva, riconcilia.
Collection: cedolini
Prefix: /api/cedolini
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from typing import Optional
import logging

from app.database import get_database
from app.parsers.cedolino_zucchetti import parse_cedolini_pdf

router = APIRouter()
logger = logging.getLogger(__name__)
COLL = "cedolini"


def _oid(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


@router.post("/upload-pdf")
async def upload_cedolini_pdf(file: UploadFile = File(...), db: AsyncIOMotorDatabase = Depends(get_database)):
    """Upload PDF cedolini multi-dipendente, parsa e salva."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Solo PDF")

    content = await file.read()
    cedolini = parse_cedolini_pdf(pdf_bytes=content)

    if not cedolini:
        raise HTTPException(400, "Nessun cedolino trovato nel PDF")

    risultati = []
    for ced in cedolini:
        cf = ced.get("codice_fiscale", "")
        mese = ced.get("mese")
        anno = ced.get("anno")

        if not cf or not mese or not anno:
            risultati.append({"stato": "incompleto", "codice_fiscale": cf, "mese": mese, "anno": anno})
            continue

        # Upsert per CF+mese+anno (non duplica mai)
        ced["filename"] = file.filename
        ced["imported_at"] = datetime.utcnow()
        ced["riconciliato"] = False

        result = await db[COLL].update_one(
            {"codice_fiscale": cf, "mese": mese, "anno": anno},
            {"$set": ced, "$setOnInsert": {"created_at": datetime.utcnow()}},
            upsert=True,
        )

        # Aggiorna/crea dipendente
        if cf:
            update = {"updated_at": datetime.utcnow(), "ultimo_cedolino": f"{mese}/{anno}"}
            if ced.get("netto"):
                update["ultimo_netto"] = ced["netto"]
            if ced.get("iban"):
                update["iban_cedolino"] = ced["iban"]

            await db["dipendenti"].update_one(
                {"codice_fiscale": cf},
                {"$set": update,
                 "$setOnInsert": {
                     "nome": ced.get("nome", ""),
                     "cognome": ced.get("cognome", ""),
                     "codice_fiscale": cf,
                     "stato": "attivo",
                     "created_at": datetime.utcnow(),
                 }},
                upsert=True,
            )

        risultati.append({
            "stato": "importato" if result.upserted_id else "aggiornato",
            "codice_fiscale": cf,
            "dipendente": f"{ced.get('cognome', '')} {ced.get('nome', '')}",
            "mese": mese, "anno": anno,
            "netto": ced.get("netto"),
        })

    return {"ok": True, "cedolini": risultati,
            "n_importati": sum(1 for r in risultati if r["stato"] in ("importato", "aggiornato"))}


@router.get("")
async def lista_cedolini(
    anno: Optional[int] = None, mese: Optional[int] = None,
    skip: int = 0, limit: int = 50,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    filtro = {}
    if anno:
        filtro["anno"] = anno
    if mese:
        filtro["mese"] = mese
    cursor = db[COLL].find(filtro).sort([("anno", -1), ("mese", -1), ("cognome", 1)]).skip(skip).limit(limit)
    items = [_oid(doc) async for doc in cursor]
    totale = await db[COLL].count_documents(filtro)
    return {"items": items, "totale": totale}


@router.post("/riconcilia")
async def riconcilia_cedolini(db: AsyncIOMotorDatabase = Depends(get_database)):
    """Riconcilia cedolini con movimenti estratto conto (stipendi)."""
    non_ric = await db[COLL].find({"riconciliato": False, "netto": {"$gt": 0}}).to_list(500)
    riconciliati = 0

    for ced in non_ric:
        netto = ced["netto"]
        nome = f"{ced.get('cognome', '')} {ced.get('nome', '')}".upper()

        # Cerca in estratto_conto_movimenti: stipendio con importo uguale ±2€
        mov = await db["estratto_conto_movimenti"].find_one({
            "categoria": "stipendio",
            "riconciliato": False,
            "importo": {"$gte": -(netto + 2), "$lte": -(netto - 2)},
        })

        if mov:
            await db[COLL].update_one(
                {"_id": ced["_id"]},
                {"$set": {"riconciliato": True, "movimento_id": str(mov["_id"])}}
            )
            await db["estratto_conto_movimenti"].update_one(
                {"_id": mov["_id"]},
                {"$set": {"riconciliato": True, "cedolino_cf": ced.get("codice_fiscale")}}
            )
            riconciliati += 1

    return {"ok": True, "riconciliati": riconciliati, "totale_non_riconciliati": len(non_ric) - riconciliati}
