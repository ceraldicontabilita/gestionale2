"""
Router Chat Intelligente — Endpoint per domande in linguaggio naturale.
"""
import logging
from typing import Dict, Any

from fastapi import APIRouter, Body

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["Chat Intelligente"])


@router.post("/ask")
async def chat_ask(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """
    Risponde a domande in linguaggio naturale sui dati aziendali.
    Per ora restituisce un messaggio informativo.
    """
    domanda = data.get("question", data.get("domanda", ""))

    return {
        "risposta": f"Hai chiesto: '{domanda}'. La funzionalita di chat AI e in fase di attivazione. "
                    "Per ora consulta le sezioni specifiche del gestionale per trovare le informazioni che cerchi.",
        "status": "placeholder",
    }
