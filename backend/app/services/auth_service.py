from __future__ import annotations

import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy import text

from app.core.config import get_settings
from app.database import SessionLocal

settings = get_settings()
password_hasher = PasswordHasher()


class AuthServiceError(RuntimeError):
    """Raised when auth operations cannot complete."""


class AuthService:
    def __init__(self) -> None:
        self._refresh_tokens: dict[str, str] = {}
        self._password_reset_tokens: dict[str, dict[str, Any]] = {}
        self._users_by_username: dict[str, dict[str, Any]] = {}
        self._users_by_email: dict[str, dict[str, Any]] = {}
        self._contact_requests: dict[tuple[str, str], dict[str, Any]] = {}

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    def validate_full_name(self, full_name: str) -> str:
        cleaned = full_name.strip()
        if len(cleaned) < 2:
            raise ValueError("Full name must be at least 2 characters long.")
        return cleaned

    def validate_username(self, username: str) -> str:
        cleaned = username.strip().replace("@", "")
        if not re.fullmatch(r"[a-zA-Z0-9_]{3,24}", cleaned):
            raise ValueError("Username must be 3-24 characters and contain only letters, numbers, or underscores.")
        return cleaned

    def validate_email(self, email: str | None) -> str | None:
        if email is None:
            return None
        cleaned = email.strip()
        if not cleaned:
            return None
        if not re.fullmatch(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$", cleaned):
            raise ValueError("Please provide a valid email address.")
        return cleaned.lower()

    def validate_password(self, password: str) -> str:
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not re.search(r"[a-z]", password):
            raise ValueError("Password must include at least one lowercase letter.")
        if not re.search(r"[A-Z]", password):
            raise ValueError("Password must include at least one uppercase letter.")
        if not re.search(r"\d", password):
            raise ValueError("Password must include at least one number.")
        if not re.search(r"[^A-Za-z0-9]", password):
            raise ValueError("Password must include at least one special character.")
        return password

    def _serialize_user(self, user: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": str(user["id"]),
            "fullName": user.get("full_name") or user.get("fullName") or "",
            "username": user.get("username") or "",
            "email": user.get("email") or None,
            "avatarPath": user.get("avatar_path") or user.get("avatarPath"),
            "avatarUrl": user.get("avatar_url") or user.get("avatarUrl"),
            "about": user.get("about") or "Hey there! I am using ChatSphere.",
            "status": user.get("status") or "offline",
            "lastSeen": user.get("last_seen") or user.get("lastSeen") or self._now().isoformat(),
            "createdAt": user.get("created_at") or user.get("createdAt") or self._now().isoformat(),
            "updatedAt": user.get("updated_at") or user.get("updatedAt") or self._now().isoformat(),
        }

    def _create_token(self, user_id: str, expires_seconds: int, token_type: str = "access") -> str:
        issued_at = self._now()
        payload = {
            "sub": user_id,
            "iat": int(issued_at.timestamp()),
            "exp": int((issued_at + timedelta(seconds=expires_seconds)).timestamp()),
            "type": token_type,
        }
        return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    def _create_refresh_token(self, user_id: str) -> str:
        refresh_token = secrets.token_urlsafe(32)
        self._refresh_tokens[refresh_token] = str(user_id)
        return refresh_token

    def _get_user_record(self, username: str) -> dict[str, Any] | None:
        if SessionLocal is not None:
            try:
                with SessionLocal() as session:
                    row = session.execute(
                        text(
                            "SELECT * FROM public.profiles WHERE lower(username) = lower(:username) LIMIT 1"
                        ),
                        {"username": username},
                    ).mappings().first()
                    if row:
                        return {
                            "id": str(row["id"]),
                            "full_name": row.get("full_name"),
                            "username": row.get("username"),
                            "email": row.get("email"),
                            "password_hash": row.get("password_hash"),
                            "avatar_path": row.get("avatar_path"),
                            "avatar_url": row.get("avatar_url"),
                            "about": row.get("about") or "Hey there! I am using ChatSphere.",
                            "status": "offline",
                            "last_seen": row.get("last_seen_at") or self._now().isoformat(),
                            "created_at": row.get("created_at") or self._now().isoformat(),
                            "updated_at": row.get("updated_at") or self._now().isoformat(),
                        }
            except Exception:
                pass
        return self._users_by_username.get(username.lower())

    def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        if SessionLocal is not None:
            try:
                with SessionLocal() as session:
                    row = session.execute(
                        text("SELECT * FROM public.profiles WHERE id = :user_id LIMIT 1"),
                        {"user_id": user_id},
                    ).mappings().first()
                    if row:
                        return {
                            "id": str(row["id"]),
                            "full_name": row.get("full_name"),
                            "username": row.get("username"),
                            "email": row.get("email"),
                            "password_hash": row.get("password_hash"),
                            "avatar_path": row.get("avatar_path"),
                            "avatar_url": row.get("avatar_url"),
                            "about": row.get("about") or "Hey there! I am using ChatSphere.",
                            "status": "offline",
                            "last_seen": row.get("last_seen_at") or self._now().isoformat(),
                            "created_at": row.get("created_at") or self._now().isoformat(),
                            "updated_at": row.get("updated_at") or self._now().isoformat(),
                        }
            except Exception:
                pass

        for user in self._users_by_username.values():
            if str(user["id"]) == str(user_id):
                return user
        return None

    def get_user_by_email(self, email: str | None) -> dict[str, Any] | None:
        normalized = self.validate_email(email)
        if not normalized:
            return None
        if SessionLocal is not None:
            try:
                with SessionLocal() as session:
                    row = session.execute(
                        text("SELECT * FROM public.profiles WHERE lower(email) = lower(:email) LIMIT 1"),
                        {"email": normalized},
                    ).mappings().first()
                    if row:
                        return {
                            "id": str(row["id"]),
                            "full_name": row.get("full_name"),
                            "username": row.get("username"),
                            "email": row.get("email"),
                            "password_hash": row.get("password_hash"),
                            "avatar_path": row.get("avatar_path"),
                            "avatar_url": row.get("avatar_url"),
                            "about": row.get("about") or "Hey there! I am using ChatSphere.",
                            "status": "offline",
                            "last_seen": row.get("last_seen_at") or self._now().isoformat(),
                            "created_at": row.get("created_at") or self._now().isoformat(),
                            "updated_at": row.get("updated_at") or self._now().isoformat(),
                        }
            except Exception:
                pass
        return self._users_by_email.get(normalized)

    def register(self, payload: dict[str, str]) -> dict[str, Any]:
        full_name = self.validate_full_name(payload["full_name"])
        username = self.validate_username(payload["username"])
        email = self.validate_email(payload.get("email"))
        password = self.validate_password(payload["password"])
        confirm_password = payload.get("confirm_password", "")
        if password != confirm_password:
            raise ValueError("Passwords do not match.")

        if self._get_user_record(username) is not None:
            raise ValueError("A user with this username already exists.")
        if email and self.get_user_by_email(email) is not None:
            raise ValueError("A user with this email already exists.")

        user_id = str(uuid.uuid4())
        password_hash = password_hasher.hash(password)
        user = {
            "id": user_id,
            "full_name": full_name,
            "username": username,
            "email": email,
            "password_hash": password_hash,
            "avatar_path": None,
            "avatar_url": None,
            "about": "Hey there! I am using ChatSphere.",
            "status": "offline",
            "last_seen": self._now().isoformat(),
            "created_at": self._now().isoformat(),
            "updated_at": self._now().isoformat(),
        }

        if SessionLocal is not None:
            try:
                with SessionLocal() as session:
                    session.execute(
                        text(
                            """
                            INSERT INTO public.profiles (
                                id, username, full_name, email, password_hash, avatar_url, about, last_seen_at, created_at, updated_at
                            ) VALUES (:id, :username, :full_name, :email, :password_hash, :avatar_url, :about, NOW(), NOW(), NOW())
                            """
                        ),
                        {
                            "id": user_id,
                            "username": username,
                            "full_name": full_name,
                            "email": email,
                            "password_hash": password_hash,
                            "avatar_url": None,
                            "about": "Hey there! I am using ChatSphere.",
                        },
                    )
                    session.commit()
            except Exception:
                pass

        self._users_by_username[username.lower()] = user
        if email:
            self._users_by_email[email.lower()] = user

        token = self._create_token(user_id, settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
        refresh_token = self._create_refresh_token(user_id)

        return {
            "message": "Registration successful.",
            "user": self._serialize_user(user),
            "access_token": token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }

    def login(self, username: str, password: str) -> dict[str, Any]:
        clean_username = self.validate_username(username)
        user = self._get_user_record(clean_username)
        if user is None:
            raise AuthServiceError("Invalid username or password.")

        stored_hash = user.get("password_hash")
        if not stored_hash:
            raise AuthServiceError("Invalid username or password.")

        try:
            password_hasher.verify(stored_hash, password)
        except VerifyMismatchError as exc:
            raise AuthServiceError("Invalid username or password.") from exc

        access_token = self._create_token(str(user["id"]), settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
        refresh_token = self._create_refresh_token(str(user["id"]))
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": self._serialize_user(user),
        }

    def forgot_password(self, email: str | None) -> dict[str, Any]:
        normalized_email = self.validate_email(email)
        user = self.get_user_by_email(normalized_email)
        if user is None:
            return {"message": "If an account exists for that email address, we have sent a password reset link."}

        reset_token = secrets.token_urlsafe(32)
        self._password_reset_tokens[reset_token] = {
            "user_id": str(user["id"]),
            "expires_at": self._now() + timedelta(minutes=15),
        }
        return {
            "message": "If an account exists for that email address, we have sent a password reset link.",
            "reset_token": reset_token,
        }

    def reset_password(self, token: str, password: str, confirm_password: str) -> dict[str, Any]:
        record = self._password_reset_tokens.get(token)
        if record is None:
            raise AuthServiceError("Invalid or expired reset token.")

        expires_at = record.get("expires_at")
        if not isinstance(expires_at, datetime) or expires_at <= self._now():
            self._password_reset_tokens.pop(token, None)
            raise AuthServiceError("Invalid or expired reset token.")

        new_password = self.validate_password(password)
        if new_password != confirm_password:
            raise ValueError("Passwords do not match.")

        user_id = str(record["user_id"])
        user = self.get_user_by_id(user_id)
        if user is None:
            raise AuthServiceError("User profile not found for password reset.")

        user["password_hash"] = password_hasher.hash(new_password)
        self._password_reset_tokens.pop(token, None)

        if SessionLocal is not None:
            try:
                with SessionLocal() as session:
                    session.execute(
                        text("UPDATE public.profiles SET password_hash = :password_hash, updated_at = NOW() WHERE id = :user_id"),
                        {"password_hash": user["password_hash"], "user_id": user_id},
                    )
                    session.commit()
            except Exception:
                pass

        return {"message": "Password reset successful."}

    def refresh_access_token(self, refresh_token: str) -> str:
        user_id = self._refresh_tokens.get(refresh_token)
        if not user_id:
            raise AuthServiceError("Invalid or expired refresh token.")
        return self._create_token(str(user_id), settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)

    def logout(self, refresh_token: str | None) -> None:
        if refresh_token:
            self._refresh_tokens.pop(refresh_token, None)

    def _serialize_contact_request(self, request: dict[str, Any]) -> dict[str, Any]:
        sender_id = str(request.get("sender_id") or request.get("senderId") or "")
        recipient_id = str(request.get("recipient_id") or request.get("recipientId") or "")
        status = str(request.get("status") or "pending")
        return {
            "id": str(request.get("id") or f"{sender_id}:{recipient_id}"),
            "senderId": sender_id,
            "recipientId": recipient_id,
            "status": status,
            "createdAt": request.get("created_at") or request.get("createdAt") or self._now().isoformat(),
            "updatedAt": request.get("updated_at") or request.get("updatedAt") or self._now().isoformat(),
            "sender": self.get_user_by_id(sender_id),
            "recipient": self.get_user_by_id(recipient_id),
        }

    def get_contact_request(self, sender_id: str, recipient_id: str) -> dict[str, Any] | None:
        sender_id = str(sender_id)
        recipient_id = str(recipient_id)
        if SessionLocal is not None:
            try:
                with SessionLocal() as session:
                    row = session.execute(
                        text(
                            "SELECT * FROM public.contact_requests WHERE sender_id = :sender_id AND recipient_id = :recipient_id LIMIT 1"
                        ),
                        {"sender_id": sender_id, "recipient_id": recipient_id},
                    ).mappings().first()
                    if row is not None:
                        return self._serialize_contact_request({
                            "id": row.get("id"),
                            "sender_id": row.get("sender_id"),
                            "recipient_id": row.get("recipient_id"),
                            "status": row.get("status") or "pending",
                            "created_at": row.get("created_at"),
                            "updated_at": row.get("updated_at"),
                        })
            except Exception:
                pass

        direct = self._contact_requests.get((sender_id, recipient_id))
        if direct is not None:
            return direct
        reverse = self._contact_requests.get((recipient_id, sender_id))
        if reverse is not None:
            return reverse
        return None

    def get_contact_status(self, user_id: str, target_user_id: str) -> str:
        if user_id == target_user_id:
            return "self"

        request = self.get_contact_request(user_id, target_user_id)
        if request is None:
            return "none"

        if request.get("status") == "accepted":
            return "accepted"
        if request.get("senderId") == user_id:
            return "pending_outgoing"
        if request.get("recipientId") == user_id:
            return "pending_incoming"
        return str(request.get("status") or "pending")

    def send_contact_request(self, sender_id: str, recipient_id: str) -> dict[str, Any]:
        sender_id = str(sender_id)
        recipient_id = str(recipient_id)
        if sender_id == recipient_id:
            raise ValueError("You cannot send a contact request to yourself.")
        if self.get_user_by_id(recipient_id) is None:
            raise ValueError("The target user could not be found.")

        existing = self.get_contact_request(sender_id, recipient_id)
        if existing is not None:
            status = str(existing.get("status") or "pending")
            if status == "accepted":
                return {"status": "accepted", "message": "You are already connected."}
            if status == "pending" and str(existing.get("senderId") or existing.get("sender_id")) == sender_id:
                return {"status": "pending", "message": "Contact request already sent."}
            if status == "pending":
                return {"status": "pending", "message": "This user already sent you a request."}
            if status == "rejected":
                existing["status"] = "pending"
                existing["updatedAt"] = self._now().isoformat()
                if SessionLocal is not None:
                    try:
                        with SessionLocal() as session:
                            session.execute(
                                text(
                                    "INSERT INTO public.contact_requests (sender_id, recipient_id, status, created_at, updated_at) "
                                    "VALUES (:sender_id, :recipient_id, :status, NOW(), NOW()) "
                                    "ON CONFLICT (sender_id, recipient_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()"
                                ),
                                {"sender_id": sender_id, "recipient_id": recipient_id, "status": "pending"},
                            )
                            session.commit()
                    except Exception:
                        pass
                self._contact_requests[(sender_id, recipient_id)] = existing
                return {"status": "pending", "message": "Contact request resent."}

        contact_request = {
            "id": f"{sender_id}:{recipient_id}",
            "sender_id": sender_id,
            "recipient_id": recipient_id,
            "status": "pending",
            "created_at": self._now().isoformat(),
            "updated_at": self._now().isoformat(),
        }

        if SessionLocal is not None:
            try:
                with SessionLocal() as session:
                    session.execute(
                        text(
                            "INSERT INTO public.contact_requests (sender_id, recipient_id, status, created_at, updated_at) "
                            "VALUES (:sender_id, :recipient_id, :status, NOW(), NOW()) "
                            "ON CONFLICT (sender_id, recipient_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()"
                        ),
                        {"sender_id": sender_id, "recipient_id": recipient_id, "status": "pending"},
                    )
                    session.commit()
            except Exception:
                pass

        self._contact_requests[(sender_id, recipient_id)] = self._serialize_contact_request(contact_request)
        return {"status": "pending", "message": "Contact request sent."}

    def get_contact_requests_for_user(self, user_id: str) -> list[dict[str, Any]]:
        user_id = str(user_id)
        records: list[dict[str, Any]] = []
        if SessionLocal is not None:
            try:
                with SessionLocal() as session:
                    rows = session.execute(
                        text(
                            "SELECT * FROM public.contact_requests WHERE sender_id = :user_id OR recipient_id = :user_id ORDER BY created_at DESC"
                        ),
                        {"user_id": user_id},
                    ).mappings().all()
                    for row in rows:
                        records.append(self._serialize_contact_request({
                            "id": row.get("id"),
                            "sender_id": row.get("sender_id"),
                            "recipient_id": row.get("recipient_id"),
                            "status": row.get("status") or "pending",
                            "created_at": row.get("created_at"),
                            "updated_at": row.get("updated_at"),
                        }))
                    return records
            except Exception:
                pass

        for request in self._contact_requests.values():
            sender_id = str(request.get("senderId") or request.get("sender_id") or "")
            recipient_id = str(request.get("recipientId") or request.get("recipient_id") or "")
            if sender_id == user_id or recipient_id == user_id:
                records.append(self._serialize_contact_request(request))
        return records

    def get_accepted_contacts(self, user_id: str) -> list[str]:
        contact_ids: list[str] = []
        for request in self.get_contact_requests_for_user(user_id):
            status = str(request.get("status") or "pending")
            if status != "accepted":
                continue
            sender_id = str(request.get("senderId") or "")
            recipient_id = str(request.get("recipientId") or "")
            other_user_id = recipient_id if sender_id == user_id else sender_id
            if other_user_id and other_user_id != user_id:
                contact_ids.append(other_user_id)
        return sorted(set(contact_ids))

    def respond_to_contact_request(self, recipient_id: str, sender_id: str, status: str) -> dict[str, Any]:
        recipient_id = str(recipient_id)
        sender_id = str(sender_id)
        normalized_status = str(status).lower()
        if normalized_status not in {"accepted", "rejected"}:
            raise ValueError("Status must be accepted or rejected.")

        request = self.get_contact_request(sender_id, recipient_id)
        if request is None:
            raise ValueError("No contact request was found for this user.")

        request["status"] = normalized_status
        request["updatedAt"] = self._now().isoformat()

        if SessionLocal is not None:
            try:
                with SessionLocal() as session:
                    session.execute(
                        text(
                            "UPDATE public.contact_requests SET status = :status, updated_at = NOW() "
                            "WHERE sender_id = :sender_id AND recipient_id = :recipient_id"
                        ),
                        {"status": normalized_status, "sender_id": sender_id, "recipient_id": recipient_id},
                    )
                    session.commit()
            except Exception:
                pass

        self._contact_requests[(sender_id, recipient_id)] = request
        return {"status": normalized_status, "message": f"Contact request {normalized_status}."}

    def decode_user_from_token(self, token: str) -> str:
        try:
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        except jwt.PyJWTError as exc:  # pragma: no cover - security guard
            raise AuthServiceError("Invalid or expired access token.") from exc

        user_id = payload.get("sub")
        if not user_id:
            raise AuthServiceError("Access token is missing a user identifier.")
        return str(user_id)


auth_service = AuthService()
