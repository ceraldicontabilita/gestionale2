"""
Presenze — Upload PDF foglio presenze Aut.301, parse, salva.
Collection: presenze
Prefix: /api/presenze

Ogni documento rappresenta un mese di presenze per un dipendente.
Struttura: codice_fiscale + mese + anno (upsert idempotente).
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from typing import Optional
import logging

from app.database import get_database
from app.parsers.presenze_zucchetti import parse_presenze_pdf

router = APIRouter()
logger = logging.getLogger(__name__)
COLL = "presenze"


def _oid(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


@router.post("/upload-pdf")
async def upload_presenze_pdf(
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Upload PDF foglio presenze Aut.301, parsa e salva."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Solo PDF")

    content = await file.read()

    try:
        pres = parse_presenze_pdf(pdf_bytes=content)
    except Exception as e:
        raise HTTPException(400, f"Errore parsing PDF: {e}")

    if pres is None:
        raise HTTPException(400, "Nessun foglio presenze trovato nel PDF (verifica che sia un Aut.301)")

    cf   = pres.get("codice_fiscale", "")
    mese = pres.get("mese", 0)
    anno = pres.get("anno", 0)

    if not cf or not mese or not anno:
        raise HTTPException(400, f"Dati incompleti: CF={cf} mese={mese} anno={anno}")

    pres["filename"]    = file.filename
    pres["imported_at"] = datetime.utcnow()

    result = await db[COLL].update_one(
        {"codice_fiscale": cf, "mese": mese, "anno": anno},
        {"$set": pres, "$setOnInsert": {"created_at": datetime.utcnow()}},
        upsert=True,
    )

    # Aggiorna dipendente: cessazione se rilevata
    if cf and pres.get("cessato") and pres.get("data_cessazione"):
        await db["dipendenti"].update_one(
            {"codice_fiscale": cf},
            {"$set": {
                "stato": "cessato",
                "data_cessazione": pres["data_cessazione"],
                "updated_at": datetime.utcnow(),
            }}
        )

    return {
        "ok": True,
        "stato": "importato" if result.upserted_id else "aggiornato",
        "codice_fiscale": cf,
        "dipendente": f"{pres.get('cognome', '')} {pres.get('nome', '')}".strip(),
        "periodo": pres.get("periodo_label", f"{mese}/{anno}"),
        "n_giorni": len(pres.get("giorni", [])),
        "totali": pres.get("totali", {}),
        "legenda": pres.get("legenda", {}),
        "cessato": pres.get("cessato", False),
    }


@router.get("")
async def lista_presenze(
    codice_fiscale: Optional[str] = None,
    anno: Optional[int] = None,
    mese: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    filtro = {}
    if codice_fiscale:
        filtro["codice_fiscale"] = codice_fiscale
    if anno:
        filtro["anno"] = anno
    if mese:
        filtro["mese"] = mese

    cursor = db[COLL].find(
        filtro,
        # Non restituire l'array giorni nella lista (pesante)
        {"giorni": 0}
    ).sort([("anno", -1), ("mese", -1)]).skip(skip).limit(limit)

    items  = [_oid(doc) async for doc in cursor]
    totale = await db[COLL].count_documents(filtro)
    return {"items": items, "totale": totale}


@router.get("/riepilogo/{codice_fiscale}")
async def riepilogo_presenze(
    codice_fiscale: str,
    anno: Optional[int] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Riepilogo presenze per dipendente, raggruppato per mese.
    Mostra ore ordinarie, ferie, malattia, assenze ecc.
    """
    filtro = {"codice_fiscale": codice_fiscale}
    if anno:
        filtro["anno"] = anno

    cursor = db[COLL].find(filtro, {"giorni": 0}).sort([("anno", 1), ("mese", 1)])
    mesi = [_oid(doc) async for doc in cursor]

    if not mesi:
        return {"codice_fiscale": codice_fiscale, "mesi": [], "totale_annuale": {}}

    # Aggrega totale annuale
    totale_annuale: dict = {}
    for m in mesi:
        for k, v in m.get("totali", {}).items():
            totale_annuale[k] = round(totale_annuale.get(k, 0) + v, 2)

    # Legenda unificata
    legenda: dict = {}
    for m in mesi:
        legenda.update(m.get("legenda", {}))

    return {
        "codice_fiscale": codice_fiscale,
        "nome": f"{mesi[0].get('cognome', '')} {mesi[0].get('nome', '')}".strip(),
        "anno": anno,
        "mesi": [
            {
                "mese": m["mese"],
                "anno": m["anno"],
                "periodo_label": m.get("periodo_label", ""),
                "totali": m.get("totali", {}),
                "cessato": m.get("cessato", False),
            }
            for m in mesi
        ],
        "totale_annuale": totale_annuale,
        "legenda": legenda,
    }


@router.get("/dettaglio/{codice_fiscale}/{anno}/{mese}")
async def dettaglio_presenze(
    codice_fiscale: str,
    anno: int,
    mese: int,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Dettaglio giornaliero presenze per dipendente/mese."""
    doc = await db[COLL].find_one(
        {"codice_fiscale": codice_fiscale, "anno": anno, "mese": mese}
    )
    if not doc:
        raise HTTPException(404, f"Presenze non trovate per {codice_fiscale} {mese}/{anno}")
    return _oid(doc)
