"""
Router Cucina — Ordini Fornitori (modulo cucina)
"""
from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, List
from datetime import datetime, timezone
import uuid

from app.database import Database
from app.utils.error_handler import handle_errors

router = APIRouter(prefix="/cucina/ordini-fornitori", tags=["Cucina Ordini Fornitori"])


@router.get("/prodotti-suggeriti")
@handle_errors
async def prodotti_suggeriti() -> List[Dict[str, Any]]:
    """Prodotti suggeriti per un ordine, basati su acquisti recenti."""
    db = Database.get_db()
    pipeline = [
        {"$group": {
            "_id": "$descrizione",
            "fornitore": {"$last": "$fornitore"},
            "ultimo_prezzo": {"$last": "$prezzo_unitario"},
            "unita": {"$last": "$unita_misura"},
            "n_acquisti": {"$sum": 1},
        }},
        {"$project": {
            "_id": 0,
            "nome": "$_id",
            "fornitore": 1,
            "ultimo_prezzo": {"$round": ["$ultimo_prezzo", 2]},
            "unita": 1,
            "n_acquisti": 1,
        }},
        {"$sort": {"n_acquisti": -1}},
        {"$limit": 200}
    ]
    try:
        return await db["acquisti_prodotti"].aggregate(pipeline).to_list(200)
    except Exception:
        return []


@router.get("/bozze")
@handle_errors
async def list_bozze() -> List[Dict[str, Any]]:
    """Lista bozze ordini cucina."""
    db = Database.get_db()
    return await db["ordini_fornitori"].find(
        {"stato": "bozza", "source": {"$in": ["cucina", "gestionale"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)


@router.get("/bozze/count")
@handle_errors
async def count_bozze() -> Dict[str, Any]:
    """Numero bozze ordini in attesa."""
    db = Database.get_db()
    count = await db["ordini_fornitori"].count_documents({"stato": "bozza"})
    return {"count": count}


@router.post("")
@handle_errors
async def create_ordine(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Crea un nuovo ordine cucina."""
    db = Database.get_db()
    last = await db["ordini_fornitori"].find_one({}, {"order_number": 1}, sort=[("order_number", -1)])
    try:
        new_num = int(last["order_number"]) + 1 if last and last.get("order_number") else 1
    except (ValueError, TypeError):
        new_num = 1
    items = data.get("items", data.get("prodotti", []))
    total = sum(
        float(i.get("unit_price", i.get("prezzo", 0)) or 0) * float(i.get("quantity", i.get("quantita", 1)) or 1)
        for i in items
    )
    ordine = {
        "id": str(uuid.uuid4()),
        "order_number": new_num,
        "source": "cucina",
        "stato": "bozza",
        "fornitore": data.get("fornitore", ""),
        "fornitore_id": data.get("fornitore_id", ""),
        "items": items,
        "totale": round(total, 2),
        "note": data.get("note", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db["ordini_fornitori"].insert_one(ordine)
    ordine.pop("_id", None)
    return ordine


@router.post("/{ordine_id}/invia")
@handle_errors
async def invia_ordine(ordine_id: str) -> Dict[str, Any]:
    """Marca un ordine come inviato."""
    db = Database.get_db()
    result = await db["ordini_fornitori"].update_one(
        {"id": ordine_id},
        {"$set": {"stato": "inviato", "inviato_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    updated = await db["ordini_fornitori"].find_one({"id": ordine_id}, {"_id": 0})
    return updated
