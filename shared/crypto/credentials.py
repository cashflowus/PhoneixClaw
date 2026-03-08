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
        try:
            _fernet_instance = Fernet(key.encode() if isinstance(key, str) else key)
            return _fernet_instance
        except (ValueError, Exception):
            logger.warning("CREDENTIAL_ENCRYPTION_KEY is set but invalid — falling back to JWT derivation.")

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


def encrypt_credentials(data: dict) -> str:
    """Encrypt a credentials dict to a base64 string for DB Text column storage."""
    f = _get_fernet()
    return f.encrypt(json.dumps(data).encode("utf-8")).decode("utf-8")


def decrypt_credentials(token: str | bytes) -> dict:
    """Decrypt credentials from DB back to a dict. Accepts str or bytes."""
    f = _get_fernet()
    raw = token.encode("utf-8") if isinstance(token, str) else token
    return json.loads(f.decrypt(raw).decode("utf-8"))
