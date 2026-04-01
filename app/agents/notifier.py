import uuid
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)


async def crea_segnalazione(
    db,
    agente: str,
    tipo: str,
    titolo: str,
    descrizione: str,
    azione: str = None,
    dati: dict = None,
    scadenza: str = None
):
    segnalazione = {
        "id": str(uuid.uuid4()),
        "agente": agente,
        "tipo": tipo,
        "titolo": titolo,
        "descrizione": descrizione,
        "azione_suggerita": azione,
        "dati_riferimento": dati or {},
        "letta": False,
        "risolta": False,
        "scadenza": scadenza,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db["agenti_segnalazioni"].insert_one(segnalazione)

    # Telegram se urgente
    if tipo in ["urgente", "anomalia"]:
        try:
            from app.services.telegram_notifications import invia_messaggio
            await invia_messaggio(f"🚨 {titolo}\n{descrizione[:200]}")
        except Exception:
            pass

    return segnalazione["id"]
