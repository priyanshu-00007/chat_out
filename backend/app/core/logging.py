import logging
import sys

from app.core.config import get_settings


def configure_logging() -> logging.Logger:
    """Configure structured application logging without leaking secrets or OTP values."""
    settings = get_settings()
    level = logging.DEBUG if settings.DEBUG and settings.ENVIRONMENT == "development" else logging.INFO

    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[logging.StreamHandler(sys.stdout)],
        force=True,
    )

    # Quiet noisy third-party SQL/HTTP debug logs unless explicitly needed
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)

    return logging.getLogger("chatsphere")
