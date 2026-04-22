"""Missioni router — Gestione missioni e trasferte dipendenti.

Espone:
  - /api/missioni                GET/POST
  - /api/missioni/{id}           GET/PUT/DELETE
  - /api/missioni/{id}/approva   POST
  - /api/missioni/{id}/rifiuta   POST

Schema Mongo — collezione "missioni":
  { id, dipendente_id, destinazione, data_inizio, data_fine, scopo,
    rimborso, stato, note_approvazione, approvata_da, approvata_at, created_at }

Stati: in_attesa | approvata | rifiutata | completata
"""
from fastapi import APIRouter, Body, Depends, HTTPException, status
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from uuid import uuid4
import logging

from app.database import Database
from app.utils.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

STATI_VALIDI = {"in_attesa", "approvata", "rifiutata", "completata"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in doc.items() if k != "_id"}


# =========================================================================
# CRUD
# =========================================================================

@router.get("", summary="Elenco missioni")
async def list_missioni(
    dipendente_id: Optional[str] = None,
    stato: Optional[str] = None,
    anno: Optional[int] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    db = Database.get_db()
    q: Dict[str, Any] = {}
    if dipendente_id:
        q["dipendente_id"] = dipendente_id
    if stato:
        q["stato"] = stato
    if anno:
        q["data_inizio"] = {"$regex": f"^{anno}"}
    items = await db["missioni"].find(q, {"_id": 0}).sort("data_inizio", -1).to_list(500)
    return items


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Crea nuova missione",
)
async def create_missione(
    data: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    required = ["dipendente_id", "destinazione", "data_inizio", "data_fine", "scopo"]
    missing = [k for k in required if not data.get(k)]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Campi obbligatori mancanti: {', '.join(missing)}",
        )

    try:
        rimborso = float(data.get("rimborso", 0) or 0)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="rimborso non numerico")

    doc = {
        "id": str(uuid4()),
        "dipendente_id": data["dipendente_id"],
        "destinazione": data["destinazione"].strip(),
        "data_inizio": data["data_inizio"],
        "data_fine": data["data_fine"],
        "scopo": data["scopo"].strip(),
        "rimborso": rimborso,
        "stato": data.get("stato", "in_attesa"),
        "note_approvazione": None,
        "approvata_da": None,
        "approvata_at": None,
        "created_at": _now(),
    }
    if doc["stato"] not in STATI_VALIDI:
        raise HTTPException(status_code=400, detail=f"stato non valido: {doc['stato']}")

    db = Database.get_db()
    await db["missioni"].insert_one(doc.copy())
    logger.info("Missione creata: %s -> %s", doc["id"], doc["destinazione"])
    return _clean(doc)


@router.get("/{missione_id}", summary="Dettaglio missione")
async def get_missione(
    missione_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    db = Database.get_db()
    item = await db["missioni"].find_one({"id": missione_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Missione non trovata")
    return item


@router.put("/{missione_id}", summary="Modifica missione")
async def update_missione(
    missione_id: str,
    data: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, str]:
    db = Database.get_db()
    update: Dict[str, Any] = {}
    for key in ("destinazione", "data_inizio", "data_fine", "scopo", "stato"):
        if data.get(key) is not None:
            update[key] = data[key]
    if "rimborso" in data:
        try:
            update["rimborso"] = float(data["rimborso"] or 0)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="rimborso non numerico")
    if update.get("stato") and update["stato"] not in STATI_VALIDI:
        raise HTTPException(status_code=400, detail=f"stato non valido: {update['stato']}")
    if not update:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")

    res = await db["missioni"].update_one({"id": missione_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Missione non trovata")
    return {"message": "Missione aggiornata"}


@router.delete("/{missione_id}", summary="Elimina missione")
async def delete_missione(
    missione_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, str]:
    db = Database.get_db()
    res = await db["missioni"].delete_one({"id": missione_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Missione non trovata")
    return {"message": "Missione eliminata"}


# =========================================================================
# WORKFLOW APPROVAZIONE
# =========================================================================

@router.post("/{missione_id}/approva", summary="Approva missione")
async def approva_missione(
    missione_id: str,
    data: Dict[str, Any] = Body(default={}),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, str]:
    db = Database.get_db()
    res = await db["missioni"].update_one(
        {"id": missione_id},
        {
            "$set": {
                "stato": "approvata",
                "note_approvazione": data.get("note", ""),
                "approvata_da": current_user.get("email") or current_user.get("id"),
                "approvata_at": _now(),
            }
        },
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Missione non trovata")
    return {"message": "Missione approvata"}


@router.post("/{missione_id}/rifiuta", summary="Rifiuta missione")
async def rifiuta_missione(
    missione_id: str,
    data: Dict[str, Any] = Body(default={}),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, str]:
    db = Database.get_db()
    res = await db["missioni"].update_one(
        {"id": missione_id},
        {
            "$set": {
                "stato": "rifiutata",
                "note_approvazione": data.get("note", ""),
                "approvata_da": current_user.get("email") or current_user.get("id"),
                "approvata_at": _now(),
            }
        },
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Missione non trovata")
    return {"message": "Missione rifiutata"}
