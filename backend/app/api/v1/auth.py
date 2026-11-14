from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from app.services.auth_service import AuthServiceError, auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    username: str = Field(..., min_length=3, max_length=24)
    email: str | None = Field(default=None, max_length=320)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=24)
    password: str = Field(..., min_length=8, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: str | None = Field(default=None, max_length=320)


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=512)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., min_length=10)


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class UserResponse(BaseModel):
    id: str
    fullName: str
    username: str
    email: str | None = None
    avatarPath: str | None = None
    avatarUrl: str | None = None
    about: str
    status: str = "offline"
    lastSeen: str
    createdAt: str
    updatedAt: str

    model_config = ConfigDict(populate_by_name=True)


class AuthTokensResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class RegisterResponse(BaseModel):
    message: str
    user: UserResponse
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"


class GenericResponse(BaseModel):
    message: str
    reset_token: str | None = None


@router.post("/register", response_model=RegisterResponse)
async def register(payload: RegisterRequest) -> RegisterResponse:
    try:
        response = auth_service.register(payload.model_dump())
        return RegisterResponse(**response)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except AuthServiceError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/login", response_model=AuthTokensResponse)
async def login(payload: LoginRequest) -> AuthTokensResponse:
    try:
        response = auth_service.login(payload.username, payload.password)
        return AuthTokensResponse(**response)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except AuthServiceError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/forgot-password", response_model=GenericResponse)
async def forgot_password(payload: ForgotPasswordRequest) -> GenericResponse:
    try:
        response = auth_service.forgot_password(payload.email)
        return GenericResponse(**response)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except AuthServiceError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/reset-password", response_model=GenericResponse)
async def reset_password(payload: ResetPasswordRequest) -> GenericResponse:
    try:
        response = auth_service.reset_password(
            payload.token,
            payload.password,
            payload.confirm_password,
        )
        return GenericResponse(**response)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except AuthServiceError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/refresh")
async def refresh(payload: RefreshTokenRequest) -> dict[str, str]:
    try:
        access_token = auth_service.refresh_access_token(payload.refresh_token)
        return {"access_token": access_token, "token_type": "bearer"}
    except AuthServiceError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/logout")
async def logout(payload: LogoutRequest) -> dict[str, str]:
    try:
        auth_service.logout(payload.refresh_token)
        return {"message": "Logged out successfully."}
    except AuthServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/me", response_model=UserResponse)
async def get_current_user(authorization: str | None = Header(default=None, alias="Authorization")) -> UserResponse:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    token = authorization.split(" ", 1)[1].strip()
    try:
        user_id = auth_service.decode_user_from_token(token)
    except AuthServiceError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    user = auth_service.get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")

    return UserResponse(**auth_service._serialize_user(user))
