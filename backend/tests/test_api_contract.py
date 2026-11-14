from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_cors_preflight_for_auth_route() -> None:
    response = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "POST" in response.headers.get("access-control-allow-methods", "")


def test_register_login_and_me_flow() -> None:
    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Alex Morgan",
            "username": "alexmorgan",
            "email": "alex@example.com",
            "password": "SecurePass!123",
            "confirm_password": "SecurePass!123",
        },
        headers={"Origin": "http://localhost:5173"},
    )

    assert register_response.status_code == 200, register_response.text
    payload = register_response.json()
    assert payload["message"] == "Registration successful."
    assert payload["user"]["username"] == "alexmorgan"

    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "alexmorgan", "password": "SecurePass!123"},
        headers={"Origin": "http://localhost:5173"},
    )

    assert login_response.status_code == 200, login_response.text
    tokens = login_response.json()
    assert tokens["token_type"] == "bearer"
    assert tokens["user"]["username"] == "alexmorgan"

    me_response = client.get(
        "/api/v1/auth/me",
        headers={
            "Origin": "http://localhost:5173",
            "Authorization": f"Bearer {tokens['access_token']}",
        },
    )

    assert me_response.status_code == 200, me_response.text
    assert me_response.json()["username"] == "alexmorgan"


def test_username_search_accepts_leading_at_symbol() -> None:
    alice = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Alice Archer",
            "username": "alicearcher",
            "email": "alicearcher@example.com",
            "password": "StrongPass!123",
            "confirm_password": "StrongPass!123",
        },
        headers={"Origin": "http://localhost:5173"},
    )
    assert alice.status_code == 200, alice.text

    bob = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Bob Stone",
            "username": "bobstone",
            "email": "bobstone@example.com",
            "password": "StrongPass!456",
            "confirm_password": "StrongPass!456",
        },
        headers={"Origin": "http://localhost:5173"},
    )
    assert bob.status_code == 200, bob.text

    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "alicearcher", "password": "StrongPass!123"},
        headers={"Origin": "http://localhost:5173"},
    )
    assert login_response.status_code == 200, login_response.text
    token = login_response.json()["access_token"]

    search_response = client.get(
        "/api/v1/users/search",
        params={"q": "@bobstone"},
        headers={
            "Origin": "http://localhost:5173",
            "Authorization": f"Bearer {token}",
        },
    )

    assert search_response.status_code == 200, search_response.text
    assert any(item["username"] == "bobstone" for item in search_response.json())


def test_register_rejects_duplicate_username() -> None:
    first = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Existing User",
            "username": "existing_user",
            "password": "StrongPass!123",
            "confirm_password": "StrongPass!123",
        },
        headers={"Origin": "http://localhost:5173"},
    )
    assert first.status_code == 200, first.text

    second = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Another User",
            "username": "existing_user",
            "password": "StrongPass!456",
            "confirm_password": "StrongPass!456",
        },
        headers={"Origin": "http://localhost:5173"},
    )

    assert second.status_code == 400
    assert "already exists" in second.json()["detail"].lower()


def test_password_reset_is_generic_and_supports_token_reset() -> None:
    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Reset User",
            "username": "reset_user",
            "email": "reset@example.com",
            "password": "ResetPass!123",
            "confirm_password": "ResetPass!123",
        },
        headers={"Origin": "http://localhost:5173"},
    )
    assert register_response.status_code == 200, register_response.text

    forgot_response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "reset@example.com"},
        headers={"Origin": "http://localhost:5173"},
    )
    assert forgot_response.status_code == 200
    assert "If an account exists" in forgot_response.json()["message"]

    reset_token = forgot_response.json().get("reset_token")
    assert reset_token is not None

    reset_response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": reset_token, "password": "NewResetPass!456", "confirm_password": "NewResetPass!456"},
        headers={"Origin": "http://localhost:5173"},
    )

    assert reset_response.status_code == 200
    assert reset_response.json()["message"] == "Password reset successful."

    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "reset_user", "password": "NewResetPass!456"},
        headers={"Origin": "http://localhost:5173"},
    )
    assert login_response.status_code == 200


def test_protected_route_requires_jwt() -> None:
    response = client.get(
        "/api/v1/auth/me",
        headers={"Origin": "http://localhost:5173"},
    )

    assert response.status_code == 401
    assert "Authentication required" in response.json()["detail"]


def test_contact_request_flow_creates_pending_and_accepts_it() -> None:
    alice = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Alice Jones",
            "username": "alicejones",
            "email": "alice@example.com",
            "password": "StrongPass!123",
            "confirm_password": "StrongPass!123",
        },
        headers={"Origin": "http://localhost:5173"},
    )
    bob = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Bob Smith",
            "username": "bobsmith",
            "email": "bob@example.com",
            "password": "StrongPass!456",
            "confirm_password": "StrongPass!456",
        },
        headers={"Origin": "http://localhost:5173"},
    )

    assert alice.status_code == 200, alice.text
    assert bob.status_code == 200, bob.text

    alice_token = alice.json()["access_token"]
    bob_token = bob.json()["access_token"]

    request_resp = client.post(
        "/api/v1/users/contacts/request",
        json={"target_user_id": bob.json()["user"]["id"]},
        headers={
            "Origin": "http://localhost:5173",
            "Authorization": f"Bearer {alice_token}",
        },
    )
    assert request_resp.status_code == 200, request_resp.text
    assert request_resp.json()["status"] == "pending"

    list_resp = client.get(
        "/api/v1/users/contact-requests",
        headers={
            "Origin": "http://localhost:5173",
            "Authorization": f"Bearer {bob_token}",
        },
    )
    assert list_resp.status_code == 200, list_resp.text
    assert any(item["status"] == "pending" for item in list_resp.json())

    accept_resp = client.post(
        f"/api/v1/users/contacts/request/{alice.json()['user']['id']}/respond",
        json={"status": "accepted"},
        headers={
            "Origin": "http://localhost:5173",
            "Authorization": f"Bearer {bob_token}",
        },
    )
    assert accept_resp.status_code == 200, accept_resp.text
    assert accept_resp.json()["status"] == "accepted"

    contacts_resp = client.get(
        "/api/v1/users/contacts",
        headers={
            "Origin": "http://localhost:5173",
            "Authorization": f"Bearer {alice_token}",
        },
    )
    assert contacts_resp.status_code == 200, contacts_resp.text
    assert any(item["id"] == bob.json()["user"]["id"] for item in contacts_resp.json())
