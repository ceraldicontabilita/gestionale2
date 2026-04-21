"""
Invio notifiche WhatsApp tramite Meta Cloud API.

Usa variabili d'ambiente:
  - WHATSAPP_API_TOKEN: Bearer token dell'app Meta
  - WHATSAPP_PHONE_NUMBER_ID: ID del numero WhatsApp Business
  - WHATSAPP_RECIPIENT_1, WHATSAPP_RECIPIENT_2: numeri destinatari
    (formato internazionale senza '+', es. '393331234567')

Fornisce:
  - send_whatsapp_message(text, to=None): invia testo libero al destinatario
    predefinito o a un numero specifico. Ritorna dict con esito.
  - send_whatsapp_to_all(text): invia a WHATSAPP_RECIPIENT_1 e RECIPIENT_2.
  - get_whatsapp_config_status(): stato configurazione (per la UI/diagnostica).

IMPORTANTE (Meta Cloud API):
  - Per inviare messaggi di testo LIBERO, il destinatario deve aver scritto
    alla business entro le ultime 24h. Altrimenti serve un Template approvato.
  - Se il messaggio di testo fallisce con error code 131047 (24h window expired),
    la funzione prova in automatico il fallback via template 'hello_world'
    (template di default di Meta, sempre approvato).
"""
from __future__ import annotations

import os
import logging
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)

META_GRAPH_API_VERSION = "v21.0"


def _env(key: str) -> str:
    return (os.environ.get(key) or "").strip()


def get_whatsapp_config_status() -> Dict[str, Any]:
    """Stato configurazione WhatsApp Meta Cloud API."""
    token = _env("WHATSAPP_API_TOKEN")
    phone_id = _env("WHATSAPP_PHONE_NUMBER_ID")
    r1 = _env("WHATSAPP_RECIPIENT_1")
    r2 = _env("WHATSAPP_RECIPIENT_2")
    configured = bool(token and phone_id and (r1 or r2))
    return {
        "configured": configured,
        "has_token": bool(token),
        "has_phone_number_id": bool(phone_id),
        "recipients": [r for r in [r1, r2] if r],
        "recipient_count": sum(1 for r in [r1, r2] if r),
        "api_version": META_GRAPH_API_VERSION,
    }


async def send_whatsapp_message(text: str, to: Optional[str] = None) -> Dict[str, Any]:
    """
    Invia un messaggio di testo.

    Args:
        text: contenuto del messaggio (max ~4096 caratteri)
        to: numero destinatario in formato internazionale senza '+'.
            Se None, usa WHATSAPP_RECIPIENT_1.

    Ritorna:
        {"success": bool, "to": str, "message_id": str|None, "error": str|None,
         "fallback_template": bool}
    """
    token = _env("WHATSAPP_API_TOKEN")
    phone_id = _env("WHATSAPP_PHONE_NUMBER_ID")
    recipient = to or _env("WHATSAPP_RECIPIENT_1")

    if not token or not phone_id:
        return {"success": False, "to": recipient, "error": "WhatsApp non configurato (manca token o phone_number_id)"}
    if not recipient:
        return {"success": False, "to": None, "error": "Nessun destinatario"}

    url = f"https://graph.facebook.com/{META_GRAPH_API_VERSION}/{phone_id}/messages"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "text",
        "text": {"preview_url": False, "body": text[:4096]},
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(url, json=payload, headers=headers)
            data = r.json() if r.content else {}
            if r.status_code == 200 and data.get("messages"):
                mid = data["messages"][0].get("id")
                logger.info(f"[WhatsApp] ✓ inviato a {recipient} — id={mid}")
                return {"success": True, "to": recipient, "message_id": mid,
                        "error": None, "fallback_template": False}
            # Errore 131047 = window 24h scaduta → prova template hello_world
            err = data.get("error", {})
            code = err.get("code")
            msg = err.get("message") or str(data)
            if code == 131047:
                logger.warning("[WhatsApp] 24h expired, tento fallback template hello_world")
                tpl = await _send_template(recipient, "hello_world", lang="en_US", token=token, phone_id=phone_id)
                tpl["fallback_template"] = True
                return tpl
            logger.warning(f"[WhatsApp] ✗ errore {r.status_code}: {msg}")
            return {"success": False, "to": recipient, "message_id": None,
                    "error": msg, "fallback_template": False, "meta_code": code}
    except Exception as e:
        logger.error(f"[WhatsApp] eccezione: {e}")
        return {"success": False, "to": recipient, "error": str(e)}


async def _send_template(
    to: str, template_name: str, lang: str = "it",
    *, token: str, phone_id: str,
    components: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Invia un messaggio via template Meta-approvato."""
    url = f"https://graph.facebook.com/{META_GRAPH_API_VERSION}/{phone_id}/messages"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload: Dict[str, Any] = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {"name": template_name, "language": {"code": lang}},
    }
    if components:
        payload["template"]["components"] = components

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(url, json=payload, headers=headers)
            data = r.json() if r.content else {}
            if r.status_code == 200 and data.get("messages"):
                return {"success": True, "to": to, "message_id": data["messages"][0].get("id"), "error": None}
            err = data.get("error", {})
            return {"success": False, "to": to, "error": err.get("message") or str(data),
                    "meta_code": err.get("code")}
    except Exception as e:
        return {"success": False, "to": to, "error": str(e)}


async def send_whatsapp_to_all(text: str) -> Dict[str, Any]:
    """Invia il messaggio a tutti i WHATSAPP_RECIPIENT_* configurati."""
    r1 = _env("WHATSAPP_RECIPIENT_1")
    r2 = _env("WHATSAPP_RECIPIENT_2")
    recipients = [r for r in [r1, r2] if r]
    if not recipients:
        return {"success": False, "sent": 0, "error": "Nessun destinatario configurato"}

    results = []
    success_count = 0
    for r in recipients:
        res = await send_whatsapp_message(text, to=r)
        results.append(res)
        if res.get("success"):
            success_count += 1
    return {"success": success_count > 0, "sent": success_count,
            "total": len(recipients), "results": results}
