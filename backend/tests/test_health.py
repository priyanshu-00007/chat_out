from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app

client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "message": "ChatSphere backend is running",
    }


def test_swagger_docs_available() -> None:
    response = client.get("/docs")
    assert response.status_code == 200


def test_not_found_uses_structured_error_handler() -> None:
    response = client.get("/api/v1/nonexistent")
    assert response.status_code == 404
    payload = response.json()
    assert payload["error"] is True
    assert payload["status_code"] == 404
    assert "detail" in payload


def test_cors_allows_react_frontend_origin() -> None:
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_database_url_normalization_and_production_otp_guard() -> None:
    settings = Settings(
        DATABASE_URL="postgresql://user:pass@localhost:5432/postgres",
        ENVIRONMENT="production",
        DEV_OTP_MODE=True,
    )
    assert settings.DATABASE_URL.startswith("postgresql+psycopg://")
    assert settings.DEV_OTP_MODE is False
