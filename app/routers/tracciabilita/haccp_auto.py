"""
Router per gestione automatica dati HACCP.
Popola i dati nella struttura ESISTENTE del database (frigorifero_numero, temperature per mese/giorno).
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional
import uuid
import random

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/haccp-auto", tags=["HACCP Automazione"])

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Configurazione
NUM_FRIGORIFERI = 12
NUM_FREEZER = 6
TEMP_FRIGO_MIN = 0.0
TEMP_FRIGO_MAX = 4.0
TEMP_FREEZER_MIN = -22.0
TEMP_FREEZER_MAX = -18.0

AREE_SANIFICAZIONE = [
    "Cucina - Piano cottura", "Cucina - Piano lavoro", "Cucina - Pavimento",
    "Friggitrici", "Celle frigorifere", "Magazzino secco",
    "Bagni personale", "Spogliatoi", "Area rifiuti"
]


class PopulateResult(BaseModel):
    success: bool
    message: str
    days_populated: int
    date_from: str
    date_to: str


def genera_temperatura_frigo() -> float:
    """Genera temperatura frigo realistica (0-4°C)"""
    return round(random.uniform(TEMP_FRIGO_MIN, TEMP_FRIGO_MAX), 1)


def genera_temperatura_freezer() -> float:
    """Genera temperatura freezer realistica (-22 a -18°C)"""
    return round(random.uniform(TEMP_FREEZER_MIN, TEMP_FREEZER_MAX), 1)


@router.post("/popola-temperature", response_model=PopulateResult)
async def popola_temperature_storiche(
    data_inizio: str = "2024-01-01",
    data_fine: Optional[str] = None
):
    """
    Popola le temperature storiche nella struttura ESISTENTE del database.
    Aggiorna i documenti esistenti per ogni frigorifero/freezer.
    """
    try:
        start_date = datetime.strptime(data_inizio, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato data non valido. Usa YYYY-MM-DD")
    
    if data_fine:
        try:
            end_date = datetime.strptime(data_fine, "%Y-%m-%d")
        except ValueError:
            end_date = datetime.now()
    else:
        end_date = datetime.now()
    
    days_populated = 0
    current_date = start_date
    
    # Info azienda (prendi dai dati esistenti o usa default)
    azienda_info = await db.temperature_positive.find_one({}, {"_id": 0, "azienda": 1, "indirizzo": 1, "piva": 1})
    azienda = azienda_info.get("azienda", "Ceraldi Group S.R.L.") if azienda_info else "Ceraldi Group S.R.L."
    indirizzo = azienda_info.get("indirizzo", "Piazza Carità 14, 80134 Napoli (NA)") if azienda_info else ""
    piva = azienda_info.get("piva", "") if azienda_info else ""
    
    while current_date <= end_date:
        anno = current_date.year
        mese = current_date.month
        giorno = current_date.day
        mese_str = str(mese)
        giorno_str = str(giorno)
        
        # ==================== TEMPERATURE POSITIVE (Frigoriferi) ====================
        for frigo_num in range(1, NUM_FRIGORIFERI + 1):
            # Cerca documento esistente per questo anno/frigorifero
            doc = await db.temperature_positive.find_one({
                "anno": anno,
                "frigorifero_numero": frigo_num
            })
            
            if doc:
                # Aggiorna temperatura per questo giorno se non esiste
                temp_path = f"temperature.{mese_str}.{giorno_str}"
                existing_temp = doc.get("temperature", {}).get(mese_str, {}).get(giorno_str)
                
                if existing_temp is None:
                    await db.temperature_positive.update_one(
                        {"_id": doc["_id"]},
                        {"$set": {
                            temp_path: genera_temperatura_frigo(),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
            else:
                # Crea nuovo documento per questo anno/frigorifero
                temperature = {str(m): {} for m in range(1, 13)}
                temperature[mese_str][giorno_str] = genera_temperatura_frigo()
                
                await db.temperature_positive.insert_one({
                    "id": str(uuid.uuid4()),
                    "anno": anno,
                    "frigorifero_numero": frigo_num,
                    "frigorifero_nome": f"Frigorifero N°{frigo_num}",
                    "azienda": azienda,
                    "indirizzo": indirizzo,
                    "piva": piva,
                    "temperature": temperature,
                    "temp_min": TEMP_FRIGO_MIN,
                    "temp_max": TEMP_FRIGO_MAX,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
        
        # ==================== TEMPERATURE NEGATIVE (Congelatori) ====================
        for cong_num in range(1, NUM_FREEZER + 1):
            doc = await db.temperature_negative.find_one({
                "anno": anno,
                "congelatore_numero": cong_num
            })
            
            if doc:
                temp_path = f"temperature.{mese_str}.{giorno_str}"
                existing_temp = doc.get("temperature", {}).get(mese_str, {}).get(giorno_str)
                
                if existing_temp is None:
                    await db.temperature_negative.update_one(
                        {"_id": doc["_id"]},
                        {"$set": {
                            temp_path: genera_temperatura_freezer(),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
            else:
                temperature = {str(m): {} for m in range(1, 13)}
                temperature[mese_str][giorno_str] = genera_temperatura_freezer()
                
                await db.temperature_negative.insert_one({
                    "id": str(uuid.uuid4()),
                    "anno": anno,
                    "congelatore_numero": cong_num,
                    "congelatore_nome": f"Congelatore N°{cong_num}",
                    "azienda": azienda,
                    "indirizzo": indirizzo,
                    "piva": piva,
                    "temperature": temperature,
                    "temp_min": TEMP_FREEZER_MIN,
                    "temp_max": TEMP_FREEZER_MAX,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
        
        days_populated += 1
        current_date += timedelta(days=1)
    
    return PopulateResult(
        success=True,
        message=f"Temperature popolate per {days_populated} giorni",
        days_populated=days_populated,
        date_from=data_inizio,
        date_to=end_date.strftime("%Y-%m-%d")
    )


@router.post("/popola-sanificazione", response_model=PopulateResult)
async def popola_sanificazione_storica(
    data_inizio: str = "2024-01-01",
    data_fine: Optional[str] = None
):
    """Popola i record di sanificazione storici"""
    try:
        start_date = datetime.strptime(data_inizio, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato data non valido")
    
    end_date = datetime.strptime(data_fine, "%Y-%m-%d") if data_fine else datetime.now()
    
    days_populated = 0
    current_date = start_date
    
    while current_date <= end_date:
        anno = current_date.year
        mese = current_date.month
        
        # Cerca documento esistente per anno/mese
        doc = await db.sanificazione.find_one({"anno": anno, "mese": mese})
        
        giorno_str = str(current_date.day)
        
        if doc:
            # Aggiorna giorni se non esistono
            giorni = doc.get("giorni", {})
            if giorno_str not in giorni:
                giorni[giorno_str] = {
                    "eseguita": True,
                    "operatore": "Sistema automatico",
                    "ora": "07:00",
                    "note": ""
                }
                await db.sanificazione.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"giorni": giorni, "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
        else:
            # Crea nuovo documento
            giorni = {}
            giorni[giorno_str] = {
                "eseguita": True,
                "operatore": "Sistema automatico",
                "ora": "07:00",
                "note": ""
            }
            
            await db.sanificazione.insert_one({
                "id": str(uuid.uuid4()),
                "anno": anno,
                "mese": mese,
                "aree": AREE_SANIFICAZIONE,
                "giorni": giorni,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        days_populated += 1
        current_date += timedelta(days=1)
    
    return PopulateResult(
        success=True,
        message=f"Sanificazione popolata per {days_populated} giorni",
        days_populated=days_populated,
        date_from=data_inizio,
        date_to=end_date.strftime("%Y-%m-%d")
    )


@router.post("/popola-tutto", response_model=PopulateResult)
async def popola_tutti_dati_haccp(data_inizio: str = "2024-01-01"):
    """Popola TUTTI i dati HACCP storici (temperature + sanificazione)"""
    
    # Popola temperature
    result_temp = await popola_temperature_storiche(data_inizio)
    
    # Popola sanificazione
    result_san = await popola_sanificazione_storica(data_inizio)
    
    return PopulateResult(
        success=True,
        message=f"Popolati {result_temp.days_populated} giorni di temperature e {result_san.days_populated} giorni di sanificazione",
        days_populated=result_temp.days_populated,
        date_from=data_inizio,
        date_to=datetime.now().strftime("%Y-%m-%d")
    )


@router.get("/verifica-oggi")
async def verifica_e_popola_oggi():
    """
    Verifica se le temperature e la sanificazione di oggi sono già compilate.
    Se mancano, genera automaticamente (chiamato dal SupervisoreBadge all'apertura).
    """
    oggi        = datetime.now(timezone.utc)
    anno        = oggi.year
    mese_str    = str(oggi.month)
    giorno_str  = str(oggi.day)
    campo       = f"temperature.{mese_str}.{giorno_str}"

    pos_ok = await db.temperature_positive.find_one({"anno": anno, campo: {"$exists": True}})
    neg_ok = await db.temperature_negative.find_one({"anno": anno, campo: {"$exists": True}})

    # Verifica sanificazione (collection reale: sanificazione_schede)
    san_doc = await db.sanificazione_schede.find_one({"anno": anno, "mese": oggi.month})
    san_ok = False
    if san_doc:
        for _, giorni in san_doc.get("registrazioni", {}).items():
            if isinstance(giorni, dict) and giorni.get(giorno_str) in ("X", "x", True, "1"):
                san_ok = True
                break

    if pos_ok and neg_ok and san_ok:
        return {"ok": True, "message": "Tutto già presente per oggi", "generato": False}

    # Genera quello che manca
    data_str = oggi.strftime("%Y-%m-%d")
    generato = []

    if not pos_ok or not neg_ok:
        await popola_temperature_storiche(data_str, data_str)
        generato.append("temperature")

    if not san_ok and san_doc:
        # Auto-segna la sanificazione di oggi come "X" su tutte le attrezzature
        registrazioni = san_doc.get("registrazioni", {})
        if registrazioni:
            # Aggiorna ogni attrezzatura con il giorno di oggi
            reg_aggiornate = {}
            for attr, giorni in registrazioni.items():
                giorni_copy = dict(giorni) if isinstance(giorni, dict) else {}
                giorni_copy[giorno_str] = "X"
                reg_aggiornate[attr] = giorni_copy
            await db.sanificazione_schede.update_one(
                {"anno": anno, "mese": oggi.month},
                {"$set": {"registrazioni": reg_aggiornate}}
            )
            generato.append("sanificazione")
        else:
            # Scheda vuota — ricrea con popola_sanificazione_storica
            await popola_sanificazione_storica(data_str, data_str)
            generato.append("sanificazione")
    elif not san_ok:
        await popola_sanificazione_storica(data_str, data_str)
        generato.append("sanificazione")

    return {
        "ok": True,
        "message": f"Generati automaticamente: {', '.join(generato)} per {data_str}",
        "generato": True,
        "elementi": generato
    }


@router.post("/genera-oggi")
async def genera_dati_oggi():
    """Genera i dati HACCP per oggi"""
    oggi = datetime.now()
    data_str = oggi.strftime("%Y-%m-%d")
    
    await popola_temperature_storiche(data_str, data_str)
    await popola_sanificazione_storica(data_str, data_str)
    
    return {
        "success": True,
        "data": data_str,
        "message": "Dati di oggi generati"
    }


@router.get("/status")
async def get_status():
    """Verifica stato dei dati HACCP"""
    temp_pos = await db.temperature_positive.count_documents({})
    temp_neg = await db.temperature_negative.count_documents({})
    san = await db.sanificazione.count_documents({})
    
    # Verifica ultimo aggiornamento
    ultimo_temp = await db.temperature_positive.find_one(
        {},
        sort=[("updated_at", -1)]
    )
    
    return {
        "schede_frigoriferi": temp_pos,
        "schede_freezer": temp_neg,
        "schede_sanificazione": san,
        "ultimo_aggiornamento": ultimo_temp.get("updated_at") if ultimo_temp else None
    }
