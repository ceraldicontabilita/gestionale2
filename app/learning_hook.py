"""
Learning Hook — Ceraldi ERP
===========================
Funzione helper che tutti i router possono chiamare per registrare eventi
nel sistema di apprendimento, senza accoppiamento diretto.

Uso:
    from app.learning_hook import registra_evento_learning
    await registra_evento_learning(db, tipo="f24_importato", modulo="f24",
                                    payload={"importo": 1234.56, "codice": "1001"})
"""

from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime

AZIENDA_ID = "b0295759-35ce-4b34-a6b4-f01b883234ad"


async def registra_evento_learning(
    db: AsyncIOMotorDatabase,
    tipo: str,
    modulo: str,
    payload: dict,
    utente: str = "system",
):
    """
    Registra un evento nel sistema di apprendimento.
    Non solleva eccezioni — fallisce silenziosamente per non bloccare il flusso principale.
    """
    try:
        evento = {
            "tipo": tipo,
            "modulo": modulo,
            "payload": payload,
            "utente": utente,
            "azienda_id": AZIENDA_ID,
            "timestamp": datetime.utcnow(),
            "elaborato": False,
        }
        # Z-score sull'importo se disponibile
        if "importo" in payload:
            importo = float(payload["importo"])
            stats = await db["learning_pattern"].find_one({"tipo": tipo, "modulo": modulo})
            if stats and stats.get("std", 0) > 0:
                z = abs(importo - stats["media"]) / stats["std"]
                evento["anomalia_score"] = round(z, 2)
                if z > 3.0:
                    evento["anomalia_flag"] = True
                    await db["learning_anomalie"].insert_one({
                        "tipo_evento": tipo, "modulo": modulo,
                        "importo": importo, "z_score": z,
                        "media_storica": stats["media"],
                        "stato": "da_verificare",
                        "confidence": min(round(z / 5, 2), 1.0),
                        "timestamp": datetime.utcnow(),
                        "payload": payload,
                    })

        await db["learning_events"].insert_one(evento)

        # Aggiorna rolling stats
        if "importo" in payload:
            importo = float(payload["importo"])
            key = {"tipo": tipo, "modulo": modulo}
            existing = await db["learning_pattern"].find_one(key)
            if existing:
                n = existing.get("n", 0) + 1
                old_media = existing.get("media", importo)
                new_media = old_media + (importo - old_media) / n
                old_m2 = existing.get("m2", 0)
                new_m2 = old_m2 + (importo - old_media) * (importo - new_media)
                std = (new_m2 / n) ** 0.5 if n > 1 else 0
                await db["learning_pattern"].update_one(key, {"$set": {
                    "n": n, "media": round(new_media, 2), "std": round(std, 2),
                    "m2": new_m2, "updated_at": datetime.utcnow(),
                }})
            else:
                await db["learning_pattern"].insert_one({
                    **key, "n": 1, "media": importo, "std": 0, "m2": 0,
                    "created_at": datetime.utcnow(),
                })
    except Exception:
        pass  # Il learning non deve mai bloccare il flusso principale
