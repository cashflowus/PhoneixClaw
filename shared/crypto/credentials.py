import json

from cryptography.fernet import Fernet

from shared.config.base_config import config


def _get_fernet() -> Fernet:
    key = config.credential_encryption.key
    if not key:
        raise ValueError("CREDENTIAL_ENCRYPTION_KEY not set")
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_credentials(data: dict) -> bytes:
    """Encrypt a credentials dict to bytes for DB storage."""
    f = _get_fernet()
    return f.encrypt(json.dumps(data).encode("utf-8"))


def decrypt_credentials(token: bytes) -> dict:
    """Decrypt credentials bytes from DB back to a dict."""
    f = _get_fernet()
    return json.loads(f.decrypt(token).decode("utf-8"))
