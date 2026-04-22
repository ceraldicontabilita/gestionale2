"""
Router Riconciliazione Stats — Gestionale Ceraldi Group
========================================================
Endpoint statistiche per la dashboard relazionale.
"""
from fastapi import APIRouter
from typing import Dict, Any
import logging

from app.database import Database

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/riconciliazione", tags=["Riconciliazione"])

COLL_MATCH = "riconciliazioni_match"


@router.get("/stats")
async def stats_riconciliazione() -> Dict[str, Any]:
    """Statistiche match raggruppate per stato."""
    db = Database.get_db()

    pipeline = [
        {"$group": {
            "_id": "$stato",
            "count": {"$sum": 1},
            "totale": {"$sum": "$importo_riconciliato"}
        }},
        {"$sort": {"count": -1}}
    ]

    result = {}
    async for doc in db[COLL_MATCH].aggregate(pipeline):
        if doc["_id"]:
            result[doc["_id"]] = {
                "count": doc["count"],
                "totale": round(doc["totale"], 2)
            }

    return result
