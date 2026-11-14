from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, File, Form, Header, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.database import SessionLocal
from app.services.auth_service import AuthServiceError, auth_service

router = APIRouter(tags=["Chat"])


class DirectConversationRequest(BaseModel):
    participant_id: str = Field(..., min_length=1)


class UpdateMembershipPreferencesRequest(BaseModel):
    is_muted: bool | None = None
    is_archived: bool | None = None


class SendMessageRequest(BaseModel):
    conversation_id: str = Field(..., min_length=1)
    content: str = ""
    message_type: str = "text"
    attachment_ids: list[str] = Field(default_factory=list)


class UpdateProfileRequest(BaseModel):
    full_name: str | None = None
    username: str | None = None
    about: str | None = None
    avatar_url: str | None = None


class ContactRequestPayload(BaseModel):
    target_user_id: str = Field(..., min_length=1)


class RespondContactRequestPayload(BaseModel):
    status: str = Field(..., min_length=1)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_user_id(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    token = authorization.split(" ", 1)[1].strip()
    try:
        return auth_service.decode_user_from_token(token)
    except AuthServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


def _run_query(query: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    if SessionLocal is None:
        return []
    params = params or {}
    with SessionLocal() as session:
        result = session.execute(text(query), params)
        return result.mappings().all()


def _normalize_row_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _serialize_user_row(user_row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(user_row.get("id") or ""),
        "fullName": user_row.get("full_name") or user_row.get("fullName") or "",
        "username": user_row.get("username") or "",
        "email": user_row.get("email") or None,
        "avatarPath": user_row.get("avatar_path") or user_row.get("avatarPath"),
        "avatarUrl": user_row.get("avatar_url") or user_row.get("avatarUrl"),
        "about": user_row.get("about") or "Hey there! I am using ChatSphere.",
        "status": user_row.get("status") or "offline",
        "lastSeen": user_row.get("last_seen_at")
        or user_row.get("lastSeen")
        or _now_iso(),
        "createdAt": user_row.get("created_at") or user_row.get("createdAt") or _now_iso(),
        "updatedAt": user_row.get("updated_at") or user_row.get("updatedAt") or _now_iso(),
    }


def _with_contact_status(current_user_id: str, user_row: dict[str, Any]) -> dict[str, Any]:
    serialized_user = _serialize_user_row(user_row)
    serialized_user["contactStatus"] = auth_service.get_contact_status(
        current_user_id,
        str(serialized_user.get("id") or ""),
    )
    return serialized_user


def _serialize_member_row(member_row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(member_row.get("member_id") or member_row.get("id") or ""),
        "conversationId": str(member_row.get("conversation_id") or ""),
        "userId": str(member_row.get("user_id") or ""),
        "role": member_row.get("role") or "member",
        "isMuted": bool(member_row.get("is_muted") or False),
        "isArchived": bool(member_row.get("is_archived") or False),
        "joinedAt": _normalize_row_value(member_row.get("joined_at")) or _now_iso(),
        "lastReadAt": _normalize_row_value(member_row.get("last_read_at")) or _now_iso(),
    }


def _get_last_message_for_conversation(conversation_id: str) -> dict[str, Any] | None:
    rows = _run_query(
        """
        SELECT id, conversation_id, sender_id, content, message_type, created_at, updated_at
        FROM public.messages
        WHERE conversation_id = :conversation_id AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
        """,
        {"conversation_id": conversation_id},
    )
    if not rows:
        return None
    row = rows[0]
    return {
        "id": str(row["id"]),
        "conversationId": str(row["conversation_id"]),
        "senderId": str(row["sender_id"]),
        "content": row.get("content") or "",
        "messageType": row.get("message_type") or "text",
        "timestamp": _normalize_row_value(row.get("created_at")) or _now_iso(),
        "updatedAt": _normalize_row_value(row.get("updated_at")) or _now_iso(),
        "status": "sent",
        "isSystem": (row.get("message_type") or "text") == "system",
    }


def _serialize_conversation_row(
    conversation_row: dict[str, Any],
    current_user_id: str,
) -> dict[str, Any]:
    conversation_id = str(conversation_row.get("id") or "")
    member_rows = _run_query(
        """
        SELECT cm.id as member_id, cm.conversation_id, cm.user_id, cm.role,
               cm.is_muted, cm.is_archived, cm.joined_at, cm.last_read_at
        FROM public.conversation_members cm
        WHERE cm.conversation_id = :conversation_id
        ORDER BY cm.joined_at ASC
        """,
        {"conversation_id": conversation_id},
    )
    members = [_serialize_member_row(member) for member in member_rows]
    participant_ids = [str(member["userId"]) for member in members]
    admin_ids = [str(member["userId"]) for member in members if member["role"] == "admin"]
    membership = next((member for member in members if member["userId"] == current_user_id), None)
    if membership is None:
        membership = {
            "id": "",
            "conversationId": conversation_id,
            "userId": current_user_id,
            "role": "member",
            "isMuted": False,
            "isArchived": False,
            "joinedAt": _now_iso(),
            "lastReadAt": _now_iso(),
        }

    unread_count = 0
    if SessionLocal is not None:
        read_row = next(
            (
                item
                for item in member_rows
                if str(item.get("user_id")) == current_user_id
            ),
            None,
        )
        if read_row is not None:
            last_read_at = read_row.get("last_read_at")
            count_row = _run_query(
                """
                SELECT COUNT(*) AS unread_count
                FROM public.messages
                WHERE conversation_id = :conversation_id
                  AND deleted_at IS NULL
                  AND created_at > :last_read_at
                """,
                {"conversation_id": conversation_id, "last_read_at": last_read_at or _now_iso()},
            )
            unread_count = int((count_row[0].get("unread_count") if count_row else 0) or 0)

    conversation = {
        "id": conversation_id,
        "type": conversation_row.get("type") or "direct",
        "name": conversation_row.get("name"),
        "description": conversation_row.get("description"),
        "avatarPath": conversation_row.get("avatar_url"),
        "avatarUrl": conversation_row.get("avatar_url"),
        "createdBy": str(conversation_row.get("created_by") or current_user_id),
        "participantIds": participant_ids,
        "adminIds": admin_ids,
        "members": members,
        "lastMessage": _get_last_message_for_conversation(conversation_id),
        "unreadCount": unread_count,
        "isMuted": bool(membership.get("isMuted") or False),
        "isArchived": bool(membership.get("isArchived") or False),
        "updatedAt": _normalize_row_value(conversation_row.get("updated_at"))
        or _normalize_row_value(conversation_row.get("created_at"))
        or _now_iso(),
        "typingUserIds": [],
    }
    return conversation


@router.get("/chats", response_model=list[dict[str, Any]])
async def get_chats(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> list[dict[str, Any]]:
    current_user_id = _ensure_user_id(authorization)
    if SessionLocal is None:
        return []

    rows = _run_query(
        """
        SELECT c.id, c.type, c.name, c.description, c.avatar_url, c.created_by,
               c.created_at, c.updated_at
        FROM public.conversations c
        JOIN public.conversation_members cm ON cm.conversation_id = c.id
        WHERE cm.user_id = :user_id
        ORDER BY c.updated_at DESC, c.created_at DESC
        """,
        {"user_id": current_user_id},
    )
    return [
        _serialize_conversation_row(row, current_user_id)
        for row in rows
    ]


@router.get("/chats/{conversation_id}", response_model=dict[str, Any])
async def get_chat_by_id(
    conversation_id: str,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    current_user_id = _ensure_user_id(authorization)
    if SessionLocal is None:
        return {
            "id": conversation_id,
            "type": "direct",
            "name": None,
            "description": None,
            "avatarPath": None,
            "avatarUrl": None,
            "createdBy": current_user_id,
            "participantIds": [current_user_id],
            "adminIds": [current_user_id],
            "members": [],
            "lastMessage": None,
            "unreadCount": 0,
            "isMuted": False,
            "isArchived": False,
            "updatedAt": _now_iso(),
            "typingUserIds": [],
        }

    rows = _run_query(
        """
        SELECT c.id, c.type, c.name, c.description, c.avatar_url, c.created_by,
               c.created_at, c.updated_at
        FROM public.conversations c
        JOIN public.conversation_members cm ON cm.conversation_id = c.id
        WHERE c.id = :conversation_id AND cm.user_id = :user_id
        LIMIT 1
        """,
        {"conversation_id": conversation_id, "user_id": current_user_id},
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return _serialize_conversation_row(rows[0], current_user_id)


@router.post("/chats", response_model=dict[str, Any])
async def create_or_get_direct_chat(
    payload: DirectConversationRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    current_user_id = _ensure_user_id(authorization)
    target_user_id = str(payload.participant_id).strip()
    if not target_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Participant user ID is required.")
    if target_user_id == current_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot start a conversation with yourself.")

    if SessionLocal is None:
        return {
            "id": f"direct-{current_user_id}-{target_user_id}",
            "type": "direct",
            "name": None,
            "description": None,
            "avatarPath": None,
            "avatarUrl": None,
            "createdBy": current_user_id,
            "participantIds": [current_user_id, target_user_id],
            "adminIds": [current_user_id],
            "members": [],
            "lastMessage": None,
            "unreadCount": 0,
            "isMuted": False,
            "isArchived": False,
            "updatedAt": _now_iso(),
            "typingUserIds": [],
        }

    with SessionLocal() as session:
        pair_key = (
            f"{min(current_user_id, target_user_id)}:{max(current_user_id, target_user_id)}"
        )
        existing = session.execute(
            text(
                "SELECT id FROM public.conversations WHERE direct_key = :direct_key LIMIT 1"
            ),
            {"direct_key": pair_key},
        ).mappings().first()

        if existing:
            conversation_id = str(existing["id"])
        else:
            conversation_id = str(
                session.execute(
                    text(
                        "INSERT INTO public.conversations (type, direct_key, created_by, created_at, updated_at) "
                        "VALUES (:type, :direct_key, :created_by, NOW(), NOW()) RETURNING id"
                    ),
                    {
                        "type": "direct",
                        "direct_key": pair_key,
                        "created_by": current_user_id,
                    },
                ).scalar_one()
            )

        session.execute(
            text(
                "INSERT INTO public.conversation_members (conversation_id, user_id, role, joined_at, last_read_at) "
                "VALUES (:conversation_id, :user_id, :role, NOW(), NOW()) "
                "ON CONFLICT (conversation_id, user_id) DO NOTHING"
            ),
            {"conversation_id": conversation_id, "user_id": current_user_id, "role": "member"},
        )
        session.execute(
            text(
                "INSERT INTO public.conversation_members (conversation_id, user_id, role, joined_at, last_read_at) "
                "VALUES (:conversation_id, :user_id, :role, NOW(), NOW()) "
                "ON CONFLICT (conversation_id, user_id) DO NOTHING"
            ),
            {"conversation_id": conversation_id, "user_id": target_user_id, "role": "member"},
        )
        session.commit()

    return get_chat_by_id(conversation_id, authorization)


@router.post("/groups", response_model=dict[str, Any])
async def create_group_chat(
    name: str = Form(...),
    description: str | None = Form(default=None),
    participant_ids: list[str] = Form(default_factory=list),
    avatar: UploadFile | None = File(default=None),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    current_user_id = _ensure_user_id(authorization)
    cleaned_name = name.strip()
    if len(cleaned_name) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Group name must be at least 2 characters long.")

    if SessionLocal is None:
        return {
            "id": f"group-{current_user_id}-{int(datetime.now(timezone.utc).timestamp())}",
            "type": "group",
            "name": cleaned_name,
            "description": description.strip() if description else None,
            "avatarPath": None,
            "avatarUrl": None,
            "createdBy": current_user_id,
            "participantIds": list(dict.fromkeys([current_user_id, *participant_ids])),
            "adminIds": [current_user_id],
            "members": [],
            "lastMessage": None,
            "unreadCount": 0,
            "isMuted": False,
            "isArchived": False,
            "updatedAt": _now_iso(),
            "typingUserIds": [],
        }

    participant_set = {current_user_id, *[item for item in participant_ids if item]}
    with SessionLocal() as session:
        result = session.execute(
            text(
                "INSERT INTO public.conversations (type, name, description, avatar_url, created_by, created_at, updated_at) "
                "VALUES (:type, :name, :description, :avatar_url, :created_by, NOW(), NOW()) RETURNING id"
            ),
            {
                "type": "group",
                "name": cleaned_name,
                "description": description.strip() if description else None,
                "avatar_url": None,
                "created_by": current_user_id,
            },
        )
        conversation_id = str(result.scalar_one())

        session.execute(
            text(
                "INSERT INTO public.conversation_members (conversation_id, user_id, role, joined_at, last_read_at) "
                "VALUES (:conversation_id, :user_id, :role, NOW(), NOW()) "
                "ON CONFLICT (conversation_id, user_id) DO NOTHING"
            ),
            {"conversation_id": conversation_id, "user_id": current_user_id, "role": "admin"},
        )
        for participant_id in sorted(participant_set):
            if participant_id == current_user_id:
                continue
            session.execute(
                text(
                    "INSERT INTO public.conversation_members (conversation_id, user_id, role, joined_at, last_read_at) "
                    "VALUES (:conversation_id, :user_id, :role, NOW(), NOW()) "
                    "ON CONFLICT (conversation_id, user_id) DO NOTHING"
                ),
                {"conversation_id": conversation_id, "user_id": participant_id, "role": "member"},
            )
        session.execute(
            text(
                "INSERT INTO public.messages (conversation_id, sender_id, content, message_type, created_at, updated_at) "
                "VALUES (:conversation_id, :sender_id, :content, :message_type, NOW(), NOW())"
            ),
            {
                "conversation_id": conversation_id,
                "sender_id": current_user_id,
                "content": f'Group "{cleaned_name}" created',
                "message_type": "system",
            },
        )
        session.commit()

    return get_chat_by_id(conversation_id, authorization)


@router.put("/chats/{conversation_id}/preferences", response_model=dict[str, Any])
async def update_conversation_preferences(
    conversation_id: str,
    payload: UpdateMembershipPreferencesRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    current_user_id = _ensure_user_id(authorization)
    if SessionLocal is None:
        return {"message": "Preferences updated."}

    with SessionLocal() as session:
        updates: list[str] = []
        params: dict[str, Any] = {"conversation_id": conversation_id, "user_id": current_user_id}
        if payload.is_muted is not None:
            updates.append("is_muted = :is_muted")
            params["is_muted"] = payload.is_muted
        if payload.is_archived is not None:
            updates.append("is_archived = :is_archived")
            params["is_archived"] = payload.is_archived
        if not updates:
            return {"message": "No preference changes supplied."}

        session.execute(
            text(
                f"UPDATE public.conversation_members SET {', '.join(updates)} "
                "WHERE conversation_id = :conversation_id AND user_id = :user_id"
            ),
            params,
        )
        session.commit()

    return {"message": "Preferences updated."}


@router.post("/chats/{conversation_id}/read", response_model=dict[str, str])
async def mark_conversation_as_read(
    conversation_id: str,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, str]:
    current_user_id = _ensure_user_id(authorization)
    if SessionLocal is None:
        return {"last_read_at": _now_iso()}

    with SessionLocal() as session:
        session.execute(
            text(
                "UPDATE public.conversation_members SET last_read_at = NOW() "
                "WHERE conversation_id = :conversation_id AND user_id = :user_id"
            ),
            {"conversation_id": conversation_id, "user_id": current_user_id},
        )
        session.commit()
    return {"last_read_at": _now_iso()}


@router.get("/users/contacts", response_model=list[dict[str, Any]])
async def get_contacts(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> list[dict[str, Any]]:
    current_user_id = _ensure_user_id(authorization)
    accepted_contact_ids = auth_service.get_accepted_contacts(current_user_id)
    if not accepted_contact_ids:
        return []

    if SessionLocal is not None:
        rows = _run_query(
            """
            SELECT id, username, full_name, email, avatar_url, about, last_seen_at,
                   created_at, updated_at
            FROM public.profiles
            WHERE id = ANY(:contact_ids)
            ORDER BY lower(username) ASC
            """,
            {"contact_ids": accepted_contact_ids},
        )
        return [_with_contact_status(current_user_id, row) for row in rows]

    return [
        _with_contact_status(current_user_id, auth_service.get_user_by_id(contact_id) or {})
        for contact_id in accepted_contact_ids
        if auth_service.get_user_by_id(contact_id)
    ]


@router.get("/users/contact-requests", response_model=list[dict[str, Any]])
async def get_contact_requests(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> list[dict[str, Any]]:
    current_user_id = _ensure_user_id(authorization)
    return auth_service.get_contact_requests_for_user(current_user_id)


@router.post("/users/contacts/request", response_model=dict[str, Any])
async def create_contact_request(
    payload: ContactRequestPayload,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    current_user_id = _ensure_user_id(authorization)
    try:
        result = auth_service.send_contact_request(current_user_id, payload.target_user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {
        "status": result.get("status") or "pending",
        "message": result.get("message") or "Contact request sent.",
        "targetUserId": payload.target_user_id,
    }


@router.post("/users/contacts/request/{target_user_id}/respond", response_model=dict[str, Any])
async def respond_to_contact_request(
    target_user_id: str,
    payload: RespondContactRequestPayload,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    current_user_id = _ensure_user_id(authorization)
    normalized_status = payload.status.strip().lower()
    if normalized_status not in {"accepted", "rejected"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be either 'accepted' or 'rejected'.",
        )

    try:
        result = auth_service.respond_to_contact_request(current_user_id, target_user_id, normalized_status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {
        "status": result.get("status") or normalized_status,
        "message": result.get("message") or f"Contact request {normalized_status}.",
        "targetUserId": target_user_id,
    }


@router.get("/users/search", response_model=list[dict[str, Any]])
async def search_users(
    q: str = Query(default="", min_length=0),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> list[dict[str, Any]]:
    current_user_id = _ensure_user_id(authorization)
    search_term = q.strip().lstrip("@").strip()
    if not search_term:
        return []
    if SessionLocal is None:
        profiles = []
        for user in auth_service._users_by_username.values():
            user_id = str(user.get("id") or "")
            if user_id == current_user_id:
                continue
            haystack = f"{user.get('full_name') or ''} {user.get('username') or ''} {user.get('email') or ''}".lower()
            if search_term.lower() in haystack:
                profiles.append(user)
        return [_with_contact_status(current_user_id, row) for row in profiles]

    rows = _run_query(
        """
        SELECT id, username, full_name, email, avatar_url, about, last_seen_at,
               created_at, updated_at
        FROM public.profiles
        WHERE id <> :current_user_id
          AND (
             lower(username) LIKE lower(:term)
             OR lower(full_name) LIKE lower(:term)
             OR lower(email) LIKE lower(:term)
          )
        ORDER BY lower(username) ASC
        LIMIT 25
        """,
        {"current_user_id": current_user_id, "term": f"%{search_term}%"},
    )
    return [_with_contact_status(current_user_id, row) for row in rows]


@router.get("/users/{user_id}", response_model=dict[str, Any])
async def get_user_by_id(
    user_id: str,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    _ensure_user_id(authorization)
    if SessionLocal is None:
        return {
            "id": user_id,
            "fullName": "",
            "username": "",
            "email": None,
            "avatarPath": None,
            "avatarUrl": None,
            "about": "Hey there! I am using ChatSphere.",
            "status": "offline",
            "lastSeen": _now_iso(),
            "createdAt": _now_iso(),
            "updatedAt": _now_iso(),
        }

    rows = _run_query(
        """
        SELECT id, username, full_name, email, avatar_url, about, last_seen_at,
               created_at, updated_at
        FROM public.profiles
        WHERE id = :user_id
        LIMIT 1
        """,
        {"user_id": user_id},
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return _serialize_user_row(rows[0])


@router.put("/users/profile", response_model=dict[str, Any])
async def update_profile(
    payload: UpdateProfileRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    current_user_id = _ensure_user_id(authorization)
    if SessionLocal is None:
        user = auth_service.get_user_by_id(current_user_id) or {
            "id": current_user_id,
            "full_name": "",
            "username": "",
            "email": None,
            "avatar_url": payload.avatar_url,
            "about": payload.about or "Hey there! I am using ChatSphere.",
            "last_seen_at": _now_iso(),
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        return _serialize_user_row(user)

    updates: list[str] = []
    params: dict[str, Any] = {"user_id": current_user_id}
    if payload.full_name is not None:
        updates.append("full_name = :full_name")
        params["full_name"] = payload.full_name.strip()
    if payload.username is not None:
        updates.append("username = :username")
        params["username"] = payload.username.strip().replace("@", "")
    if payload.about is not None:
        updates.append("about = :about")
        params["about"] = payload.about.strip()
    if payload.avatar_url is not None:
        updates.append("avatar_url = :avatar_url")
        params["avatar_url"] = payload.avatar_url

    if not updates:
        existing = _run_query(
            """
            SELECT id, username, full_name, email, avatar_url, about, last_seen_at,
                   created_at, updated_at
            FROM public.profiles
            WHERE id = :user_id
            LIMIT 1
            """,
            {"user_id": current_user_id},
        )
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")
        return _serialize_user_row(existing[0])

    with SessionLocal() as session:
        session.execute(
            text(
                f"UPDATE public.profiles SET {', '.join(updates)}, updated_at = NOW() WHERE id = :user_id"
            ),
            params,
        )
        session.commit()

    rows = _run_query(
        """
        SELECT id, username, full_name, email, avatar_url, about, last_seen_at,
               created_at, updated_at
        FROM public.profiles
        WHERE id = :user_id
        LIMIT 1
        """,
        {"user_id": current_user_id},
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")
    return _serialize_user_row(rows[0])


@router.get("/messages/{conversation_id}", response_model=list[dict[str, Any]])
async def get_messages_for_conversation(
    conversation_id: str,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> list[dict[str, Any]]:
    current_user_id = _ensure_user_id(authorization)
    if SessionLocal is None:
        return []

    membership_result = _run_query(
        """
        SELECT 1
        FROM public.conversation_members
        WHERE conversation_id = :conversation_id AND user_id = :user_id
        LIMIT 1
        """,
        {"conversation_id": conversation_id, "user_id": current_user_id},
    )
    if not membership_result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    rows = _run_query(
        """
        SELECT id, conversation_id, sender_id, content, message_type, created_at, updated_at
        FROM public.messages
        WHERE conversation_id = :conversation_id AND deleted_at IS NULL
        ORDER BY created_at ASC
        """,
        {"conversation_id": conversation_id},
    )
    return [
        {
            "id": str(row["id"]),
            "conversationId": str(row["conversation_id"]),
            "senderId": str(row["sender_id"]),
            "content": row.get("content") or "",
            "messageType": row.get("message_type") or "text",
            "timestamp": _normalize_row_value(row.get("created_at")) or _now_iso(),
            "updatedAt": _normalize_row_value(row.get("updated_at")) or _now_iso(),
            "status": "sent",
            "isSystem": (row.get("message_type") or "text") == "system",
        }
        for row in rows
    ]


@router.post("/messages", response_model=dict[str, Any])
async def send_message(
    payload: SendMessageRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    current_user_id = _ensure_user_id(authorization)
    if SessionLocal is None:
        return {
            "id": f"local-{datetime.now(timezone.utc).timestamp()}",
            "conversationId": payload.conversation_id,
            "senderId": current_user_id,
            "content": payload.content,
            "messageType": payload.message_type or "text",
            "timestamp": _now_iso(),
            "updatedAt": _now_iso(),
            "status": "sent",
            "isSystem": False,
        }

    membership_result = _run_query(
        """
        SELECT 1
        FROM public.conversation_members
        WHERE conversation_id = :conversation_id AND user_id = :user_id
        LIMIT 1
        """,
        {"conversation_id": payload.conversation_id, "user_id": current_user_id},
    )
    if not membership_result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    with SessionLocal() as session:
        result = session.execute(
            text(
                "INSERT INTO public.messages (conversation_id, sender_id, content, message_type, created_at, updated_at) "
                "VALUES (:conversation_id, :sender_id, :content, :message_type, NOW(), NOW()) RETURNING id, created_at, updated_at"
            ),
            {
                "conversation_id": payload.conversation_id,
                "sender_id": current_user_id,
                "content": payload.content or "",
                "message_type": payload.message_type or "text",
            },
        )
        row = result.mappings().first()
        session.commit()

    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create message.")

    return {
        "id": str(row["id"]),
        "conversationId": payload.conversation_id,
        "senderId": current_user_id,
        "content": payload.content or "",
        "messageType": payload.message_type or "text",
        "timestamp": _normalize_row_value(row.get("created_at")) or _now_iso(),
        "updatedAt": _normalize_row_value(row.get("updated_at")) or _now_iso(),
        "status": "sent",
        "isSystem": (payload.message_type or "text") == "system",
    }


@router.post("/messages/{message_id}/read", response_model=dict[str, str])
async def mark_message_as_read(
    message_id: str,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, str]:
    _ensure_user_id(authorization)
    return {"message": message_id}
