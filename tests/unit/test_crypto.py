
import pytest
from cryptography.fernet import Fernet


@pytest.fixture(autouse=True)
def setup_encryption_key(monkeypatch):
    key = Fernet.generate_key().decode()
    monkeypatch.setenv("CREDENTIAL_ENCRYPTION_KEY", key)
    monkeypatch.delenv("FERNET_KEY", raising=False)


class TestCredentialEncryption:
    def test_round_trip(self):
        from shared.crypto.credentials import decrypt_credentials, encrypt_credentials

        original = {"api_key": "AKTEST123", "secret_key": "secret456"}
        encrypted = encrypt_credentials(original)
        assert isinstance(encrypted, str)
        assert encrypted != original

        decrypted = decrypt_credentials(encrypted)
        assert decrypted == original

    def test_different_data_types(self):
        from shared.crypto.credentials import decrypt_credentials, encrypt_credentials

        data = {"key": "value", "number": 42, "nested": {"a": "b"}, "list": [1, 2, 3]}
        encrypted = encrypt_credentials(data)
        decrypted = decrypt_credentials(encrypted)
        assert decrypted == data

    def test_empty_dict(self):
        from shared.crypto.credentials import decrypt_credentials, encrypt_credentials

        encrypted = encrypt_credentials({})
        decrypted = decrypt_credentials(encrypted)
        assert decrypted == {}

    def test_encryptions_are_unique(self):
        from shared.crypto.credentials import encrypt_credentials

        data = {"key": "value"}
        enc1 = encrypt_credentials(data)
        enc2 = encrypt_credentials(data)
        assert enc1 != enc2  # Fernet uses random IV

    def test_invalid_key_raises(self, monkeypatch):
        monkeypatch.delenv("CREDENTIAL_ENCRYPTION_KEY", raising=False)
        monkeypatch.delenv("FERNET_KEY", raising=False)

        from shared.crypto.credentials import encrypt_credentials

        with pytest.raises(RuntimeError, match="FERNET_KEY"):
            encrypt_credentials({"key": "value"})
