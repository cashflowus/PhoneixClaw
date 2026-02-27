import base64
import hashlib
import json
import logging

from cryptography.fernet import Fernet

from shared.config.base_config import config

logger = logging.getLogger(__name__)

_fernet_instance: Fernet | None = None


def _derive_key_from_jwt_secret(secret: str) -> bytes:
    """Derive a valid 32-byte Fernet key from the JWT secret using SHA-256."""
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _get_fernet() -> Fernet:
    global _fernet_instance
    if _fernet_instance is not None:
        return _fernet_instance

    key = config.credential_encryption.key
    if key:
        _fernet_instance = Fernet(key.encode() if isinstance(key, str) else key)
        return _fernet_instance

    jwt_secret = config.auth.secret_key
    if jwt_secret and jwt_secret != "dev-secret-key-change-in-production":
        logger.warning(
            "CREDENTIAL_ENCRYPTION_KEY not set — deriving from JWT_SECRET_KEY. "
            "Set CREDENTIAL_ENCRYPTION_KEY for production use."
        )
        derived = _derive_key_from_jwt_secret(jwt_secret)
        _fernet_instance = Fernet(derived)
        return _fernet_instance

    raise ValueError(
        "Neither CREDENTIAL_ENCRYPTION_KEY nor a valid JWT_SECRET_KEY is set. "
        "Please configure at least one in environment variables."
    )


def encrypt_credentials(data: dict) -> bytes:
    """Encrypt a credentials dict to bytes for DB storage."""
    f = _get_fernet()
    return f.encrypt(json.dumps(data).encode("utf-8"))


def decrypt_credentials(token: bytes) -> dict:
    """Decrypt credentials bytes from DB back to a dict."""
    f = _get_fernet()
    return json.loads(f.decrypt(token).decode("utf-8"))
