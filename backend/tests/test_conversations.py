from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth_service import auth_service

client = TestClient(app)


def test_authenticated_user_can_fetch_conversations() -> None:
    token = auth_service._create_token(str(uuid4()), 1800)
    response = client.get(
        "/api/v1/chats",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert isinstance(response.json(), list)
