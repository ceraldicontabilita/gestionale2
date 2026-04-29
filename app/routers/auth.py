"""
Authentication router.
Handles user registration, login, Google OAuth, and profile management.
"""
from fastapi import APIRouter, Depends, status, HTTPException, Request
from fastapi.responses import RedirectResponse
from typing import Dict, Any, Optional
from urllib.parse import urlencode
import logging
import os
import httpx

from app.database import Database, Collections
from app.repositories import UserRepository
from app.services import AuthService
from app.models import UserRegister, UserLogin, TokenResponse, PasswordChange
from app.utils.dependencies import get_current_user, get_current_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "/api/auth/google/callback")


def _allowed_emails() -> set[str]:
    raw = os.environ.get("ALLOWED_EMAILS", "ceraldigroupsrl@gmail.com")
    return {email.strip().lower() for email in raw.split(",") if email.strip()}


def _ensure_email_allowed(email: str) -> None:
    allowed = _allowed_emails()
    normalized = (email or "").strip().lower()
    if allowed and normalized not in allowed:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Accesso non autorizzato per {email}. "
                "Questo gestionale e riservato. Contatta l'amministratore."
            ),
        )


async def get_auth_service() -> AuthService:
    """Get auth service with injected dependencies."""
    db = Database.get_db()
    user_repo = UserRepository(db[Collections.USERS])
    return AuthService(user_repo)


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new user",
    description="Create a new user account and return JWT token",
)
async def register(
    user_data: UserRegister,
    auth_service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    logger.info(f"Registration request: {user_data.email}")
    return await auth_service.register(user_data)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="User login",
    description="Authenticate user and return JWT token",
)
async def login(
    credentials: UserLogin,
    auth_service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    logger.info(f"Login request: {credentials.email}")
    _ensure_email_allowed(credentials.email)
    return await auth_service.login(credentials)


@router.get(
    "/google",
    summary="Inizia login Google",
    description="Redirect a Google per autenticazione OAuth",
)
async def google_login(request: Request):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=501,
            detail="Google OAuth non configurato. Imposta GOOGLE_CLIENT_ID nelle variabili d'ambiente.",
        )

    redirect_uri = GOOGLE_REDIRECT_URI
    if not redirect_uri.startswith("http"):
        base_url = str(request.base_url).rstrip("/")
        redirect_uri = f"{base_url}{GOOGLE_REDIRECT_URI}"

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return RedirectResponse(url=auth_url)


@router.get(
    "/google/callback",
    summary="Callback Google OAuth",
    description="Gestisce il ritorno da Google dopo l'autenticazione",
)
async def google_callback(
    request: Request,
    code: Optional[str] = None,
    error: Optional[str] = None,
    auth_service: AuthService = Depends(get_auth_service),
):
    if error:
        raise HTTPException(status_code=400, detail=f"Google auth error: {error}")

    if not code:
        raise HTTPException(status_code=400, detail="Codice di autorizzazione mancante")

    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=501, detail="Google OAuth non configurato")

    redirect_uri = GOOGLE_REDIRECT_URI
    if not redirect_uri.startswith("http"):
        base_url = str(request.base_url).rstrip("/")
        redirect_uri = f"{base_url}{GOOGLE_REDIRECT_URI}"

    try:
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                },
            )

            if token_response.status_code != 200:
                logger.error(f"Google token error: {token_response.text}")
                raise HTTPException(status_code=400, detail="Errore nello scambio del token")

            token_data = token_response.json()
            access_token = token_data.get("access_token")

            user_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )

            if user_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Errore nel recupero info utente")

            google_user = user_response.json()

    except httpx.RequestError as e:
        logger.error(f"Google OAuth request error: {e}")
        raise HTTPException(status_code=500, detail="Errore di connessione con Google")

    email = google_user.get("email")
    name = google_user.get("name", "")
    google_id = google_user.get("id")
    picture = google_user.get("picture", "")

    if not email:
        raise HTTPException(status_code=400, detail="Email non disponibile da Google")

    _ensure_email_allowed(email)

    db = Database.get_db()
    users_collection = db[Collections.USERS]

    existing_user = await users_collection.find_one({"email": email})

    if existing_user:
        await users_collection.update_one(
            {"email": email},
            {
                "$set": {
                    "google_id": google_id,
                    "picture": picture,
                    "name": name or existing_user.get("name", ""),
                    "auth_provider": "google",
                }
            },
        )
        user_id = str(existing_user["_id"])
    else:
        from datetime import datetime, timezone

        new_user = {
            "email": email,
            "name": name,
            "google_id": google_id,
            "picture": picture,
            "auth_provider": "google",
            "password_hash": None,
            "role": "user",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

        result = await users_collection.insert_one(new_user)
        user_id = str(result.inserted_id)
        logger.info(f"Nuovo utente Google creato: {email}")

    from app.services.auth_service import create_access_token

    jwt_token = create_access_token(data={"sub": user_id, "email": email, "provider": "google"})

    frontend_url = os.getenv("FRONTEND_URL", "")
    if frontend_url:
        return RedirectResponse(url=f"{frontend_url}/auth/callback?{urlencode({'token': jwt_token})}")

    return {
        "access_token": jwt_token,
        "token_type": "bearer",
        "user": {
            "email": email,
            "name": name,
            "picture": picture,
        },
    }


@router.get(
    "/profile",
    response_model=Dict[str, Any],
    summary="Get user profile",
    description="Get current user profile information",
)
async def get_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> Dict[str, Any]:
    user_id = current_user["user_id"]
    return await auth_service.get_user_profile(user_id)


@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
    summary="Change password",
    description="Change current user password",
)
async def change_password(
    password_data: PasswordChange,
    current_user: Dict[str, Any] = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> Dict[str, str]:
    user_id = current_user["user_id"]

    await auth_service.change_password(
        user_id=user_id,
        old_password=password_data.old_password,
        new_password=password_data.new_password,
    )

    return {"message": "Password changed successfully"}


@router.post(
    "/users/{user_id}/deactivate",
    status_code=status.HTTP_200_OK,
    summary="Deactivate user (Admin only)",
    description="Deactivate a user account",
)
async def deactivate_user(
    user_id: str,
    admin_user: Dict[str, Any] = Depends(get_current_admin_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> Dict[str, str]:
    logger.warning(f"Admin {admin_user['user_id']} deactivating user: {user_id}")
    await auth_service.deactivate_user(user_id)
    return {"message": f"User {user_id} deactivated successfully"}


@router.post(
    "/users/{user_id}/activate",
    status_code=status.HTTP_200_OK,
    summary="Activate user (Admin only)",
    description="Activate a user account",
)
async def activate_user(
    user_id: str,
    admin_user: Dict[str, Any] = Depends(get_current_admin_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> Dict[str, str]:
    logger.info(f"Admin {admin_user['user_id']} activating user: {user_id}")
    await auth_service.activate_user(user_id)
    return {"message": f"User {user_id} activated successfully"}


@router.get(
    "/verify",
    response_model=Dict[str, Any],
    summary="Verify JWT token",
    description="Verify JWT token validity and return user data",
)
async def verify_token(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    return {"valid": True, "user": current_user}


@router.post(
    "/setup",
    summary="Initial admin setup",
    description="Create the first admin user. Only works if no users exist.",
)
async def initial_setup(
    user_data: UserRegister,
    auth_service: AuthService = Depends(get_auth_service),
) -> Dict[str, Any]:
    db = Database.get_db()

    count = await db[Collections.USERS].count_documents({})
    if count > 0:
        raise HTTPException(
            status_code=403,
            detail="Setup gia completato. Utenti esistenti nel database.",
        )

    result = await auth_service.register(user_data)

    await db[Collections.USERS].update_one(
        {"email": user_data.email},
        {"$set": {"role": "admin"}},
    )

    logger.info(f"Setup iniziale completato: admin {user_data.email}")

    return {
        "success": True,
        "message": "Admin creato con successo",
        "access_token": result.access_token,
    }
