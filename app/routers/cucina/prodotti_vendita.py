"""
Router Cucina — Prodotti Vendita
"""
from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, List
from datetime import datetime, timezone
import uuid

from app.database import Database
from app.utils.error_handler import handle_errors

router = APIRouter(prefix="/cucina/prodotti-vendita", tags=["Cucina Prodotti Vendita"])


@router.get("/lista")
@handle_errors
async def list_prodotti(skip: int = 0, limit: int = 1000) -> List[Dict[str, Any]]:
    """Lista prodotti in vendita."""
    db = Database.get_db()
    return await db["prodotti_vendita"].find({}, {"_id": 0}).sort("nome", 1).skip(skip).limit(limit).to_list(limit)


@router.post("")
@handle_errors
async def create_prodotto(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Crea un nuovo prodotto vendita."""
    db = Database.get_db()
    prodotto = {
        "id": str(uuid.uuid4()),
        "nome": data.get("nome", ""),
        "categoria": data.get("categoria", ""),
        "prezzo_netto": float(data.get("prezzo_netto", 0) or 0),
        "aliquota_iva": float(data.get("aliquota_iva", 10) or 10),
        "costo_produzione": float(data.get("costo_produzione", 0) or 0),
        "margine": float(data.get("margine", 0) or 0),
        "attivo": data.get("attivo", True),
        "note": data.get("note", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db["prodotti_vendita"].insert_one(prodotto)
    prodotto.pop("_id", None)
    return prodotto


@router.put("/{prodotto_id}")
@handle_errors
async def update_prodotto(prodotto_id: str, data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Aggiorna un prodotto vendita."""
    db = Database.get_db()
    data.pop("_id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db["prodotti_vendita"].update_one({"id": prodotto_id}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    updated = await db["prodotti_vendita"].find_one({"id": prodotto_id}, {"_id": 0})
    return updated


@router.delete("/{prodotto_id}")
@handle_errors
async def delete_prodotto(prodotto_id: str) -> Dict[str, Any]:
    """Elimina un prodotto vendita."""
    db = Database.get_db()
    result = await db["prodotti_vendita"].delete_one({"id": prodotto_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    return {"success": True, "id": prodotto_id}
