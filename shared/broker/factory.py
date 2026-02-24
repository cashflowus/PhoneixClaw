from shared.broker.adapter import BrokerAdapter
from shared.broker.alpaca_adapter import AlpacaBrokerAdapter
from shared.crypto.credentials import decrypt_credentials

BROKER_ADAPTERS = {
    "alpaca": AlpacaBrokerAdapter,
}

def create_broker_adapter(broker_type: str, credentials_encrypted: bytes, paper_mode: bool = True) -> BrokerAdapter:
    creds = decrypt_credentials(credentials_encrypted)
    adapter_class = BROKER_ADAPTERS.get(broker_type.lower())
    if not adapter_class:
        raise ValueError(f"Unsupported broker type: {broker_type}")
    if broker_type.lower() == "alpaca":
        secret = creds.get("secret_key") or creds.get("api_secret") or creds.get("secret")
        if not secret:
            raise ValueError("Missing secret_key/api_secret in credentials")
        return adapter_class(api_key=creds["api_key"], secret_key=secret, paper=paper_mode)
    return adapter_class(**creds)
