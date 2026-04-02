"""
Router Cucina — Ricette
"""
from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, List
from datetime import datetime, timezone
import uuid

from app.database import Database
from app.utils.error_handler import handle_errors

router = APIRouter(prefix="/cucina", tags=["Cucina Ricette"])


@router.get("/ricette")
@handle_errors
async def list_ricette(skip: int = 0, limit: int = 1000) -> List[Dict[str, Any]]:
    """Lista tutte le ricette."""
    db = Database.get_db()
    return await db["ricette"].find({}, {"_id": 0}).sort("nome", 1).skip(skip).limit(limit).to_list(limit)


@router.get("/ricette/stats")
@handle_errors
async def get_ricette_stats() -> Dict[str, Any]:
    """Statistiche ricette: totale e da approvare."""
    db = Database.get_db()
    totale = await db["ricette"].count_documents({})
    da_approvare = await db["ricette"].count_documents({"approvata": False})
    return {"totale": totale, "da_approvare": da_approvare}


@router.get("/ricette/{ricetta_id}")
@handle_errors
async def get_ricetta(ricetta_id: str) -> Dict[str, Any]:
    """Singola ricetta per ID."""
    db = Database.get_db()
    doc = await db["ricette"].find_one({"id": ricetta_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Ricetta non trovata")
    return doc


@router.post("/ricette")
@handle_errors
async def create_ricetta(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Crea una nuova ricetta."""
    db = Database.get_db()
    ricetta = {
        "id": str(uuid.uuid4()),
        "nome": data.get("nome", ""),
        "reparto": data.get("reparto", ""),
        "porzioni": data.get("porzioni", 1),
        "ingredienti": data.get("ingredienti", []),
        "food_cost": data.get("food_cost", 0.0),
        "approvata": data.get("approvata", False),
        "note": data.get("note", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db["ricette"].insert_one(ricetta)
    ricetta.pop("_id", None)
    return ricetta


@router.put("/ricette/{ricetta_id}")
@handle_errors
async def update_ricetta(ricetta_id: str, data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Aggiorna una ricetta esistente."""
    db = Database.get_db()
    data.pop("_id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db["ricette"].update_one({"id": ricetta_id}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ricetta non trovata")
    updated = await db["ricette"].find_one({"id": ricetta_id}, {"_id": 0})
    return updated


@router.delete("/ricette/{ricetta_id}")
@handle_errors
async def delete_ricetta(ricetta_id: str) -> Dict[str, Any]:
    """Elimina una ricetta."""
    db = Database.get_db()
    result = await db["ricette"].delete_one({"id": ricetta_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ricetta non trovata")
    return {"success": True, "id": ricetta_id}
