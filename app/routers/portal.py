"""Portal router - Portal/invitation functionality + Portale Dipendenti."""
from fastapi import APIRouter, Depends, status, HTTPException, Request
from typing import Dict, Any
import logging
import uuid
import hashlib
import base64
import random
import string
from datetime import datetime, timezone, timedelta

from app.utils.dependencies import get_current_user
from app.database import Database

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/login-password",
    summary="Login with password"
)
async def login_password(
    data: Dict[str, Any]
) -> Dict[str, Any]:
    """Portal login with password."""
    return {"message": "Login successful", "token": ""}


@router.post(
    "/forgot",
    summary="Forgot password"
)
async def forgot_password(
    data: Dict[str, Any]
) -> Dict[str, str]:
    """Request password reset."""
    return {"message": "Reset email sent if account exists"}


@router.post(
    "/reset-password",
    summary="Reset password"
)
async def reset_password(
    data: Dict[str, Any]
) -> Dict[str, str]:
    """Reset password with token."""
    return {"message": "Password reset successful"}


@router.post(
    "/register-from-invite",
    status_code=status.HTTP_201_CREATED,
    summary="Register from invitation"
)
async def register_from_invite(
    data: Dict[str, Any]
) -> Dict[str, str]:
    """Register new user from invitation."""
    return {"message": "Registration successful"}


@router.post(
    "/send-invites",
    summary="Send invitations"
)
async def send_invites(
    data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Send portal invitations."""
    return {"message": "Invitations sent", "sent_count": 0}


# ===== PORTALE DIPENDENTI =====

@router.post("/collega-google")
async def collega_google_dipendente(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Collega un Google Account a un dipendente tramite codice di invito.
    Il dipendente accede con Google e inserisce il codice ricevuto via email.
    """
    db = Database.get_db()
    email_google = data.get("email_google", "").lower().strip()
    codice_invito = data.get("codice_invito", "").strip().upper()

    if not email_google or not codice_invito:
        raise HTTPException(400, "Email Google e codice invito obbligatori")

    invito = await db["portal_inviti"].find_one({
        "codice": codice_invito,
        "usato": {"$ne": True},
        "scadenza": {"$gte": datetime.now(timezone.utc).isoformat()}
    })
    if not invito:
        raise HTTPException(400, "Codice invito non valido o scaduto")

    await db["employees"].update_one(
        {"id": invito["dipendente_id"]},
        {"$set": {
            "google_email": email_google,
            "portale_registrato": True,
            "portale_primo_accesso": datetime.now(timezone.utc).isoformat()
        }}
    )
    await db["portal_inviti"].update_one(
        {"codice": codice_invito},
        {"$set": {
            "usato": True,
            "usato_at": datetime.now(timezone.utc).isoformat(),
            "google_email": email_google
        }}
    )
    return {"message": "Account collegato con successo"}


@router.post("/genera-invito/{dipendente_id}")
async def genera_invito_dipendente(dipendente_id: str) -> Dict[str, Any]:
    """
    Genera codice invito per un dipendente.
    Chiamato dal datore dopo aver creato l'anagrafica.
    """
    db = Database.get_db()
    dip = await db["employees"].find_one({"id": dipendente_id}, {"_id": 0})
    if not dip:
        raise HTTPException(404, "Dipendente non trovato")

    codice = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
    scadenza = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

    await db["portal_inviti"].insert_one({
        "id": str(uuid.uuid4()),
        "dipendente_id": dipendente_id,
        "dipendente_nome": dip.get("nome_completo", ""),
        "codice": codice,
        "scadenza": scadenza,
        "usato": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    email = dip.get("email", "")
    email_inviata = False
    if email:
        try:
            from app.services.email_sender import invia_email
            await invia_email(
                to=email,
                subject="Accesso al portale dipendenti Ceraldi Group",
                body=(
                    f"Ciao {dip.get('nome_completo', '')},\n\n"
                    f"Puoi accedere al tuo spazio personale sul gestionale.\n\n"
                    f"Codice di accesso: {codice}\n"
                    f"Il codice scade il {scadenza[:10]}.\n\n"
                    f"Accedi con il tuo account Google e inserisci questo codice."
                )
            )
            email_inviata = True
        except Exception as e:
            logger.warning(f"Email invito non inviata: {e}")

    await db["employees"].update_one(
        {"id": dipendente_id},
        {"$set": {
            "portale_invitato": True,
            "portale_invito_inviato": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"codice": codice, "scadenza": scadenza, "email_inviata": email_inviata}


@router.get("/portale/cedolini")
async def get_miei_cedolini(current_user=Depends(get_current_user)):
    """Cedolini del dipendente loggato (filtrati per google_email)."""
    db = Database.get_db()
    dip = await db["employees"].find_one(
        {"google_email": current_user["email"]}, {"_id": 0}
    )
    if not dip:
        raise HTTPException(403, "Utente non collegato a nessun dipendente")
    cedolini = await db["cedolini"].find(
        {"$or": [
            {"dipendente_id": dip["id"]},
            {"codice_fiscale": dip.get("codice_fiscale")}
        ]},
        {"_id": 0, "pdf_data": 0}
    ).sort([("anno", -1), ("mese", -1)]).to_list(36)
    return cedolini


@router.get("/portale/cedolini/{cedolino_id}/pdf")
async def scarica_mio_cedolino(cedolino_id: str, current_user=Depends(get_current_user)):
    """Scarica il PDF di un cedolino (solo il proprio)."""
    from fastapi.responses import Response
    db = Database.get_db()
    dip = await db["employees"].find_one({"google_email": current_user["email"]})
    if not dip:
        raise HTTPException(403, "Accesso negato")
    cedolino = await db["cedolini"].find_one({
        "id": cedolino_id,
        "$or": [
            {"dipendente_id": dip["id"]},
            {"codice_fiscale": dip.get("codice_fiscale")}
        ]
    })
    if not cedolino:
        raise HTTPException(404, "Cedolino non trovato o non autorizzato")
    pdf_bytes = base64.b64decode(cedolino["pdf_data"])
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=cedolino_{cedolino_id}.pdf"}
    )


@router.get("/portale/contratti")
async def get_miei_contratti(current_user=Depends(get_current_user)):
    """Contratti del dipendente loggato."""
    db = Database.get_db()
    dip = await db["employees"].find_one(
        {"google_email": current_user["email"]}, {"_id": 0}
    )
    if not dip:
        raise HTTPException(403, "Accesso negato")
    contratti = await db["employee_contracts"].find(
        {"dipendente_id": dip["id"]},
        {"_id": 0, "pdf_data": 0}
    ).to_list(20)
    return contratti


@router.post("/portale/firma/{documento_id}")
async def firma_documento(
    documento_id: str,
    request: Request,
    current_user=Depends(get_current_user)
):
    """
    Firma elettronica semplice FES (legalmente valida art.3 eIDAS).
    Registra: timestamp + IP + email + hash documento.
    """
    db = Database.get_db()
    dip = await db["employees"].find_one(
        {"google_email": current_user["email"]}, {"_id": 0}
    )
    if not dip:
        raise HTTPException(403, "Accesso negato")

    doc = await db["employee_contracts"].find_one({"id": documento_id})
    if not doc or doc.get("dipendente_id") != dip["id"]:
        raise HTTPException(404, "Documento non trovato")

    pdf_b64 = doc.get("pdf_data", "")
    pdf_bytes = base64.b64decode(pdf_b64) if pdf_b64 else b""
    hash_doc = hashlib.sha256(pdf_bytes).hexdigest()

    firma = {
        "id": str(uuid.uuid4()),
        "dipendente_id": dip["id"],
        "dipendente_email": current_user["email"],
        "dipendente_nome": dip.get("nome_completo", ""),
        "documento_id": documento_id,
        "documento_tipo": doc.get("tipo", ""),
        "hash_documento": hash_doc,
        "firma_timestamp": datetime.now(timezone.utc).isoformat(),
        "firma_ip": request.client.host if request.client else "N/D",
        "firma_user_agent": request.headers.get("user-agent", "")[:200],
        "accettazione_testuale": "Ho letto e accetto il documento",
        "valida": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db["documenti_firmati"].insert_one(firma)

    await db["employee_contracts"].update_one(
        {"id": documento_id},
        {"$set": {
            "firmato": True,
            "firma_id": firma["id"],
            "firmato_at": firma["firma_timestamp"],
            "firma_ip": firma["firma_ip"]
        }}
    )

    await db["agenti_segnalazioni"].insert_one({
        "id": str(uuid.uuid4()),
        "agente": "PortaleDipendente",
        "tipo": "info",
        "titolo": f"Documento firmato — {dip.get('nome_completo', '')}",
        "descrizione": f"{dip.get('nome_completo', '')} ha firmato: {doc.get('tipo', '')}.",
        "letta": False,
        "risolta": False,
        "dati_riferimento": {"dipendente_id": dip["id"], "documento_id": documento_id},
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    return {"message": "Documento firmato con successo", "firma_id": firma["id"]}
