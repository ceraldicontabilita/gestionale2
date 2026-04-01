"""Router Agenti AI — segnalazioni, stato, gestione."""
from fastapi import APIRouter, Query
from typing import Optional
from datetime import datetime, timezone

from app.database import Database

router = APIRouter(prefix="/agenti", tags=["Agenti AI"])


@router.get("/segnalazioni")
async def get_segnalazioni(
    non_lette: bool = Query(False),
    tipo: Optional[str] = Query(None),
    limit: int = Query(50)
):
    """Restituisce le segnalazioni degli agenti AI."""
    db = Database.get_db()
    query = {}
    if non_lette:
        query["letta"] = False
    if tipo:
        query["tipo"] = tipo
    segnalazioni = await db["agenti_segnalazioni"].find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return {"segnalazioni": segnalazioni, "totale": len(segnalazioni)}


@router.get("/segnalazioni/count")
async def get_count_non_lette():
    """Contatore badge segnalazioni non lette."""
    db = Database.get_db()
    count = await db["agenti_segnalazioni"].count_documents({"letta": False})
    return {"non_lette": count}


@router.put("/segnalazioni/{sid}/letta")
async def segna_letta(sid: str):
    """Segna una segnalazione come letta."""
    db = Database.get_db()
    await db["agenti_segnalazioni"].update_one(
        {"id": sid},
        {"$set": {"letta": True, "letta_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "ok"}


@router.put("/segnalazioni/{sid}/risolta")
async def segna_risolta(sid: str):
    """Segna una segnalazione come risolta."""
    db = Database.get_db()
    await db["agenti_segnalazioni"].update_one(
        {"id": sid},
        {"$set": {"risolta": True, "risolta_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "ok"}


@router.get("/stato")
async def get_stato_agenti():
    """Stato di tutti gli agenti AI."""
    db = Database.get_db()
    stati = await db["agenti_stato"].find({}, {"_id": 0}).to_list(20)
    return {"agenti": stati}


@router.post("/run")
async def run_agenti_manuale():
    """Esegue manualmente tutti gli agenti AI."""
    db = Database.get_db()
    try:
        from app.agents.orchestrator import run_agenti
        await run_agenti(db)
        return {"status": "ok", "message": "Agenti eseguiti con successo"}
    except Exception as e:
        return {"status": "errore", "error": str(e)}
