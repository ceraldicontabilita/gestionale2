"""
Gestione Veicoli Noleggio
API per la gestione dei veicoli aziendali a noleggio
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime, timezone
from pydantic import BaseModel
from ..database import get_database

router = APIRouter(prefix="/api/noleggio-auto", tags=["Veicoli Noleggio"])

class VeicoloCreate(BaseModel):
    targa: str
    marca: Optional[str] = None
    modello: Optional[str] = None
    anno: Optional[int] = None
    data_scadenza_noleggio: Optional[str] = None
    note: Optional[str] = None
    stato: Optional[str] = "attivo"  # attivo, manutenzione, fermo

class VeicoloUpdate(BaseModel):
    marca: Optional[str] = None
    modello: Optional[str] = None
    anno: Optional[int] = None
    data_scadenza_noleggio: Optional[str] = None
    note: Optional[str] = None
    stato: Optional[str] = None

COLLECTION = "veicoli_noleggio"


def utc_now_iso() -> str:
    """Timestamp ISO timezone-aware coerente con il resto dell'app."""
    return datetime.now(timezone.utc).isoformat()


@router.get("/veicoli")
async def get_veicoli(db=Depends(get_database)):
    """Lista tutti i veicoli a noleggio"""
    veicoli = await db[COLLECTION].find({}, {"_id": 0}).sort("targa", 1).to_list(100)
    
    if not veicoli:
        veicoli = await db["veicoli"].find({}, {"_id": 0}).sort("targa", 1).to_list(100)
    
    return {"veicoli": veicoli, "count": len(veicoli)}

@router.get("/veicoli/{targa}")
async def get_veicolo(targa: str, db=Depends(get_database)):
    """Dettaglio singolo veicolo"""
    veicolo = await db[COLLECTION].find_one({"targa": targa.upper()}, {"_id": 0})
    if not veicolo:
        raise HTTPException(status_code=404, detail="Veicolo non trovato")
    return veicolo

@router.post("/veicoli")
async def create_veicolo(veicolo: VeicoloCreate, db=Depends(get_database)):
    """Crea un nuovo veicolo"""
    targa = veicolo.targa.upper().strip()
    
    existing = await db[COLLECTION].find_one({"targa": targa})
    if existing:
        raise HTTPException(status_code=400, detail="Veicolo con questa targa già esistente")
    
    now = utc_now_iso()
    doc = {
        "targa": targa,
        "marca": veicolo.marca,
        "modello": veicolo.modello,
        "anno": veicolo.anno,
        "data_scadenza_noleggio": veicolo.data_scadenza_noleggio,
        "note": veicolo.note,
        "stato": veicolo.stato or "attivo",
        "created_at": now,
        "updated_at": now,
    }
    
    await db[COLLECTION].insert_one(doc)
    return {"success": True, "message": "Veicolo creato", "targa": targa}

@router.put("/veicoli/{targa}")
async def update_veicolo(targa: str, veicolo: VeicoloUpdate, db=Depends(get_database)):
    """Aggiorna un veicolo esistente"""
    targa = targa.upper().strip()
    
    existing = await db[COLLECTION].find_one({"targa": targa})
    if not existing:
        raise HTTPException(status_code=404, detail="Veicolo non trovato")
    
    update_data = {k: v for k, v in veicolo.dict().items() if v is not None}
    update_data["updated_at"] = utc_now_iso()
    
    await db[COLLECTION].update_one({"targa": targa}, {"$set": update_data})
    return {"success": True, "message": "Veicolo aggiornato"}

@router.delete("/veicoli/{targa}")
async def delete_veicolo(targa: str, db=Depends(get_database)):
    """Elimina un veicolo"""
    targa = targa.upper().strip()
    
    result = await db[COLLECTION].delete_one({"targa": targa})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Veicolo non trovato")
    
    return {"success": True, "message": "Veicolo eliminato"}

@router.get("/stats")
async def get_stats(db=Depends(get_database)):
    """Statistiche veicoli"""
    total = await db[COLLECTION].count_documents({})
    attivi = await db[COLLECTION].count_documents({"stato": "attivo"})
    manutenzione = await db[COLLECTION].count_documents({"stato": "manutenzione"})
    fermi = await db[COLLECTION].count_documents({"stato": "fermo"})
    
    return {
        "totale": total,
        "attivi": attivi,
        "in_manutenzione": manutenzione,
        "fermi": fermi
    }
