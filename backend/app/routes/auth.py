import sqlite3
import secrets
import logging

from fastapi import APIRouter, Depends, HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app import auth_store
from app.config import settings
from app.dependencies import get_current_user
from app.schemas import AuthTokenResponse, CurrentUserResponse, GoogleAuthRequest, LoginRequest, RegisterRequest
from app.security import create_access_token, hash_password, verify_password


router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


@router.post("/register", response_model=AuthTokenResponse)
def register(payload: RegisterRequest):
    if not settings.password_auth_enabled:
        raise HTTPException(status_code=403, detail="Password auth is disabled. Use Google login.")

    existing = auth_store.get_user_by_email(payload.email)
    if existing is not None:
        raise HTTPException(status_code=409, detail="Email is already registered.")

    try:
        user = auth_store.create_user(
            email=payload.email,
            password_hash=hash_password(payload.password),
            starting_credits=settings.starting_credits,
        )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Email is already registered.")

    token = create_access_token(str(user.id))
    return AuthTokenResponse(
        access_token=token,
        credits_remaining=user.credits_remaining,
        email=user.email,
    )


@router.post("/login", response_model=AuthTokenResponse)
def login(payload: LoginRequest):
    if not settings.password_auth_enabled:
        raise HTTPException(status_code=403, detail="Password auth is disabled. Use Google login.")

    user = auth_store.get_user_by_email(payload.email)
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token(str(user.id))
    return AuthTokenResponse(
        access_token=token,
        credits_remaining=user.credits_remaining,
        email=user.email,
    )


@router.post("/google", response_model=AuthTokenResponse)
def google_auth(payload: GoogleAuthRequest):
    if not settings.google_client_id:
        raise HTTPException(status_code=500, detail="Google login is not configured on server.")

    try:
        token_data = google_id_token.verify_oauth2_token(
            payload.id_token,
            google_requests.Request(),
            settings.google_client_id,
        )
    except Exception as exc:
        logger.warning("Google token verification failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid Google token.")

    email = str(token_data.get("email", "")).lower()
    email_verified = bool(token_data.get("email_verified"))
    if not email or not email_verified:
        raise HTTPException(status_code=401, detail="Google account email is not verified.")

    try:
        user = auth_store.get_user_by_email(email)
        if user is None:
            try:
                user = auth_store.create_user(
                    email=email,
                    password_hash=hash_password(secrets.token_urlsafe(32)),
                    starting_credits=settings.starting_credits,
                )
            except sqlite3.IntegrityError:
                user = auth_store.get_user_by_email(email)

        if user is None:
            raise HTTPException(status_code=500, detail="Failed to create or fetch Google user account.")

        token = create_access_token(str(user.id))
        return AuthTokenResponse(
            access_token=token,
            credits_remaining=user.credits_remaining,
            email=user.email,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unexpected Google auth error")
        raise HTTPException(status_code=500, detail=f"Google auth failed: {exc}")


@router.get("/me", response_model=CurrentUserResponse)
def me(current_user=Depends(get_current_user)):
    return CurrentUserResponse(
        user_id=current_user.id,
        email=current_user.email,
        credits_remaining=current_user.credits_remaining,
    )
