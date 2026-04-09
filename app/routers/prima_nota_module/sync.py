"""
Prima Nota Module - Sincronizzazione e Import.
Sync corrispettivi, fatture, import CSV/batch.
"""
from fastapi import HTTPException, Query, Body
from typing import Dict
from datetime import datetime, timezone
import uuid

from app.database import Database, Collections
from .common import (
    COLLECTION_PRIMA_NOTA_CASSA, COLLECTION_PRIMA_NOTA_BANCA
)


# Tipi documento fatture attive (vendite - ENTRATE)
TIPI_FATTURA_ATTIVA = ["TD24", "TD25", "TD26", "TD27"]
TIPI_NOTA_CREDITO = ["TD04", "TD08"]


def determina_tipo_movimento_fattura(fattura: Dict) -> tuple:
    """Determina tipo movimento (entrata/uscita) e categoria dalla fattura."""
    tipo_doc = fattura.get("tipo_documento", "TD01").upper()
    supplier_vat = fattura.get("supplier_vat") or fattura.get("cedente_piva") or ""
    
    is_nota_credito = tipo_doc in TIPI_NOTA_CREDITO
    is_fattura_attiva = tipo_doc in TIPI_FATTURA_ATTIVA
    
    if is_nota_credito:
        return ("entrata", "Nota credito fornitore", "Nota credito")
    elif is_fattura_attiva:
        return ("entrata", "Incasso cliente", "Incasso fattura")
    else:
        return ("uscita", "Pagamento fornitore", "Pagamento fattura")


async def registra_pagamento_fattura(
    fattura: Dict,
    metodo_pagamento: str,
    importo_cassa: float = 0,
    importo_banca: float = 0
) -> Dict:
    """Registra automaticamente il pagamento di una fattura."""
    db = Database.get_db()
    
    now = datetime.now(timezone.utc).isoformat()
    data_fattura = fattura.get("invoice_date") or fattura.get("data_fattura") or now[:10]
    importo_totale = fattura.get("total_amount") or fattura.get("importo_totale") or 0
    numero_fattura = fattura.get("invoice_number") or fattura.get("numero_fattura") or "N/A"
    fornitore = fattura.get("supplier_name") or fattura.get("cedente_denominazione") or "Fornitore"
    fornitore_piva = fattura.get("supplier_vat") or fattura.get("cedente_piva") or ""
    
    tipo_movimento, categoria, desc_prefisso = determina_tipo_movimento_fattura(fattura)
    
    risultato = {"cassa": None, "banca": None, "tipo_movimento": tipo_movimento}
    descrizione_base = f"{desc_prefisso} {numero_fattura} - {fornitore[:40]}"
    
    movimento_base = {
        "data": data_fattura,
        "tipo": tipo_movimento,
        "categoria": categoria,
        "riferimento": numero_fattura,
        "fornitore_piva": fornitore_piva,
        "fattura_id": fattura.get("id") or fattura.get("invoice_key"),
        "tipo_documento": fattura.get("tipo_documento"),
        "source": "fattura_pagata",
        "created_at": now
    }
    
    if metodo_pagamento.lower() in ["cassa", "contanti"]:
        mov = {**movimento_base, "id": str(uuid.uuid4()), "importo": importo_totale, "descrizione": descrizione_base}
        await db[COLLECTION_PRIMA_NOTA_CASSA].insert_one(mov.copy())
        risultato["cassa"] = mov["id"]
        
    elif metodo_pagamento.lower() in ["banca", "bonifico", "assegno", "riba", "carta", "sepa", "mav", "rav", "rid", "f24"]:
        mov = {**movimento_base, "id": str(uuid.uuid4()), "importo": importo_totale, "descrizione": descrizione_base}
        await db[COLLECTION_PRIMA_NOTA_BANCA].insert_one(mov.copy())
        risultato["banca"] = mov["id"]
        
    elif metodo_pagamento.lower() == "misto":
        if importo_cassa > 0:
            mov = {**movimento_base, "id": str(uuid.uuid4()), "importo": importo_cassa, "descrizione": f"{descrizione_base} (contanti)"}
            await db[COLLECTION_PRIMA_NOTA_CASSA].insert_one(mov.copy())
            risultato["cassa"] = mov["id"]
        if importo_banca > 0:
            mov = {**movimento_base, "id": str(uuid.uuid4()), "importo": importo_banca, "descrizione": f"{descrizione_base} (bonifico)"}
            await db[COLLECTION_PRIMA_NOTA_BANCA].insert_one(mov.copy())
            risultato["banca"] = mov["id"]
    
    return risultato


async def registra_fattura_prima_nota(
    fattura_id: str = Body(...),
    metodo_pagamento: str = Body(None),
    importo_cassa: float = Body(0),
    importo_banca: float = Body(0)
) -> Dict:
    """Registra manualmente il pagamento di una fattura."""
    db = Database.get_db()
    
    fattura = await db[Collections.INVOICES].find_one(
        {"$or": [{"id": fattura_id}, {"invoice_key": fattura_id}]}
    )
    
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    
    if not metodo_pagamento:
        fornitore_piva = fattura.get("supplier_vat") or fattura.get("cedente_piva")
        if fornitore_piva:
            fornitore = await db[Collections.SUPPLIERS].find_one({"partita_iva": fornitore_piva}, {"_id": 0})
            if fornitore:
                metodo_fornitore = (fornitore.get("metodo_pagamento") or "").lower()
                metodo_pagamento = "cassa" if metodo_fornitore in ["contanti", "cassa", "cash"] else "banca"
            else:
                metodo_pagamento = "banca"
        else:
            metodo_pagamento = "banca"
    
    risultato = await registra_pagamento_fattura(
        fattura=fattura,
        metodo_pagamento=metodo_pagamento,
        importo_cassa=importo_cassa,
        importo_banca=importo_banca
    )
    
    await db[Collections.INVOICES].update_one(
        {"_id": fattura["_id"]},
        {"$set": {
            "pagato": True,
            "data_pagamento": datetime.now(timezone.utc).isoformat()[:10],
            "metodo_pagamento": metodo_pagamento,
            "prima_nota_cassa_id": risultato.get("cassa"),
            "prima_nota_banca_id": risultato.get("banca")
        }}
    )
    
    return {
        "message": "Pagamento registrato",
        "prima_nota_cassa": risultato.get("cassa"),
        "prima_nota_banca": risultato.get("banca")
    }


async def sync_corrispettivi_to_prima_nota() -> Dict:
    """Rimossa la logica rebuild — i corrispettivi non vengono più ricostruiti in Prima Nota Cassa."""
    return {"message": "Funzione rimossa", "ok": True}


async def sync_corrispettivi_anno(anno: int = Query(...)) -> Dict:
    """Rimossa la logica rebuild — i corrispettivi non vengono più sincronizzati in Prima Nota Cassa."""
    return {"message": "Funzione rimossa", "anno": anno, "ok": True}


async def sync_fatture_pagate(anno: int = Query(...)) -> Dict:
    """Sincronizza fatture pagate nella Prima Nota."""
    db = Database.get_db()
    
    date_start = f"{anno}-01-01"
    date_end = f"{anno}-12-31"
    
    fatture = await db["invoices"].find(
        {"invoice_date": {"$gte": date_start, "$lte": date_end}, "stato_pagamento": "pagata"},
        {"_id": 0}
    ).to_list(10000)
    
    if not fatture:
        return {"message": "Nessuna fattura pagata trovata", "importati": 0}
    
    existing_cassa = await db[COLLECTION_PRIMA_NOTA_CASSA].find(
        {"categoria": "Fatture", "data": {"$gte": date_start, "$lte": date_end}},
        {"riferimento": 1, "_id": 0}
    ).to_list(10000)
    existing_banca = await db[COLLECTION_PRIMA_NOTA_BANCA].find(
        {"categoria": "Fatture", "data": {"$gte": date_start, "$lte": date_end}},
        {"riferimento": 1, "_id": 0}
    ).to_list(10000)
    existing_refs = set(e.get("riferimento") for e in existing_cassa + existing_banca if e.get("riferimento"))
    
    importati_cassa = 0
    importati_banca = 0
    totale_cassa = 0
    totale_banca = 0
    
    for fatt in fatture:
        ref = f"FATT-{fatt.get('id', '')}"
        
        if ref in existing_refs:
            continue
        
        totale = float(fatt.get("total_amount", 0) or 0)
        if totale <= 0:
            continue
        
        metodo = fatt.get("metodo_pagamento", "bonifico").lower()
        fornitore = fatt.get("supplier_name") or fatt.get("cedente_denominazione", "Fornitore")
        
        movimento = {
            "id": str(uuid.uuid4()),
            "data": fatt.get("invoice_date") or fatt.get("data_pagamento"),
            "tipo": "uscita",
            "importo": totale,
            "descrizione": f"Fattura {fatt.get('numero', '')} - {fornitore[:30]}",
            "categoria": "Fatture",
            "riferimento": ref,
            "source": "sync_fatture",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        if metodo in ["contanti", "cassa"]:
            await db[COLLECTION_PRIMA_NOTA_CASSA].insert_one(movimento.copy())
            importati_cassa += 1
            totale_cassa += totale
        else:
            await db[COLLECTION_PRIMA_NOTA_BANCA].insert_one(movimento.copy())
            importati_banca += 1
            totale_banca += totale
    
    return {
        "message": "Sincronizzazione completata",
        "importati_cassa": importati_cassa,
        "importati_banca": importati_banca,
        "totale_cassa": round(totale_cassa, 2),
        "totale_banca": round(totale_banca, 2),
        "fatture_pagate_anno": len(fatture)
    }


async def get_corrispettivi_sync_status() -> Dict:
    """Verifica stato sincronizzazione corrispettivi."""
    db = Database.get_db()
    
    total_corrispettivi = await db["corrispettivi"].count_documents({})
    synced = await db[COLLECTION_PRIMA_NOTA_CASSA].count_documents({"corrispettivo_id": {"$exists": True, "$ne": None}})
    
    pipeline = [{"$group": {"_id": None, "totale": {"$sum": "$totale"}}}]
    totals = await db["corrispettivi"].aggregate(pipeline).to_list(1)
    
    pipeline_pn = [
        {"$match": {"categoria": "Corrispettivi", "tipo": "entrata"}},
        {"$group": {"_id": None, "totale": {"$sum": "$importo"}}}
    ]
    totals_pn = await db[COLLECTION_PRIMA_NOTA_CASSA].aggregate(pipeline_pn).to_list(1)
    
    return {
        "corrispettivi_totali": total_corrispettivi,
        "corrispettivi_sincronizzati": synced,
        "da_sincronizzare": total_corrispettivi - synced,
        "totale_corrispettivi_euro": totals[0].get("totale", 0) if totals else 0,
        "totale_in_prima_nota_euro": totals_pn[0].get("totale", 0) if totals_pn else 0
    }


async def import_prima_nota_batch(data: Dict = Body(...)) -> Dict:
    """Importa batch di movimenti."""
    db = Database.get_db()
    
    created_cassa = 0
    created_banca = 0
    errors = []
    
    for mov in data.get("cassa", []):
        try:
            movimento = {
                "id": str(uuid.uuid4()),
                "data": mov["data"],
                "tipo": mov["tipo"],
                "importo": float(mov["importo"]),
                "descrizione": mov.get("descrizione", ""),
                "categoria": mov.get("categoria", "Altro"),
                "riferimento": mov.get("riferimento"),
                "fornitore_piva": mov.get("fornitore_piva"),
                "fattura_id": mov.get("fattura_id"),
                "source": mov.get("source", "excel_import"),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db[COLLECTION_PRIMA_NOTA_CASSA].insert_one(movimento.copy())
            created_cassa += 1
        except Exception as e:
            errors.append(f"Cassa: {str(e)}")
    
    for mov in data.get("banca", []):
        try:
            movimento = {
                "id": str(uuid.uuid4()),
                "data": mov["data"],
                "tipo": mov["tipo"],
                "importo": float(mov["importo"]),
                "descrizione": mov.get("descrizione", ""),
                "categoria": mov.get("categoria", "Altro"),
                "riferimento": mov.get("riferimento"),
                "fornitore_piva": mov.get("fornitore_piva"),
                "fattura_id": mov.get("fattura_id"),
                "source": mov.get("source", "excel_import"),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db[COLLECTION_PRIMA_NOTA_BANCA].insert_one(movimento.copy())
            created_banca += 1
        except Exception as e:
            errors.append(f"Banca: {str(e)}")
    
    return {
        "message": "Import completato",
        "cassa_created": created_cassa,
        "banca_created": created_banca,
        "errors": errors[:10]
    }


async def create_movimento_generico(data: Dict = Body(...)) -> Dict:
    """Crea un movimento Prima Nota generico (cassa o banca)."""
    db = Database.get_db()
    
    tipo_nota = data.get("tipo", "banca")
    tipo_movimento = data.get("tipo_movimento", "entrata")
    
    required = ["data", "importo", "descrizione"]
    for field in required:
        if field not in data:
            raise HTTPException(status_code=400, detail=f"Campo obbligatorio mancante: {field}")
    
    movimento = {
        "id": str(uuid.uuid4()),
        "data": data["data"],
        "tipo": tipo_movimento,
        "importo": float(data["importo"]),
        "descrizione": data["descrizione"],
        "categoria": data.get("categoria", "Altro"),
        "riferimento": data.get("riferimento"),
        "fornitore_piva": data.get("fornitore_piva"),
        "fonte": data.get("fonte", "manual_entry"),
        "riconciliato": data.get("riconciliato", False),
        "note": data.get("note"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    collection = COLLECTION_PRIMA_NOTA_BANCA if tipo_nota == "banca" else COLLECTION_PRIMA_NOTA_CASSA
    await db[collection].insert_one(movimento.copy())
    
    return {"message": f"Movimento {tipo_nota} creato", "id": movimento["id"]}


async def collega_fatture_movimenti() -> Dict:
    """Collega automaticamente fatture ai movimenti."""
    db = Database.get_db()
    
    collegati = 0
    
    for coll in [COLLECTION_PRIMA_NOTA_CASSA, COLLECTION_PRIMA_NOTA_BANCA]:
        cursor = db[coll].find({
            "numero_fattura": {"$exists": True, "$ne": None, "$ne": ""},
            "fattura_id": {"$in": [None, ""]}
        })
        
        async for mov in cursor:
            numero_fattura = mov.get("numero_fattura", "")
            if not numero_fattura:
                continue
            
            fattura = await db["invoices"].find_one({
                "$or": [
                    {"numero": numero_fattura},
                    {"invoice_number": numero_fattura},
                    {"numero_fattura": numero_fattura}
                ]
            }, {"_id": 0, "id": 1})
            
            if fattura:
                await db[coll].update_one(
                    {"id": mov["id"]},
                    {"$set": {"fattura_id": fattura["id"]}}
                )
                collegati += 1
    
    return {"success": True, "movimenti_collegati": collegati}
