import os
import yaml
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
load_dotenv()

# Load YAML settings
_settings_path = Path(__file__).parent / "settings.yaml"
_settings_data = {}
if _settings_path.exists():
    with open(_settings_path, 'r') as f:
        _settings_data = yaml.safe_load(f) or {}

class Settings:
    # Discord Configuration
    DISCORD_BOT_TOKEN: str | None = os.getenv("DISCORD_BOT_TOKEN")
    TARGET_CHANNELS: list[int] = [int(x) for x in os.getenv("DISCORD_TARGET_CHANNELS", "").split(",") if x.strip()]
    
    # Database Configuration
    DB_URL: str | None = os.getenv("DB_URL")
    
    # Alpaca Configuration
    ALPACA_API_KEY: str | None = os.getenv("ALPACA_API_KEY")
    ALPACA_SECRET_KEY: str | None = os.getenv("ALPACA_SECRET_KEY")
    ALPACA_BASE_URL: str = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")
    
    # Trade Queue Storage
    TRADE_QUEUE_STORAGE_TYPE: str = os.getenv("TRADE_QUEUE_STORAGE_TYPE", "sql")
    
    # Safety Limits
    MAX_POSITION_SIZE: int = _settings_data.get("max_position_size", 10)
    MAX_DAILY_LOSS: float = _settings_data.get("max_daily_loss", 1000.0)
    DEFAULT_CONTRACT_QUANTITY: int = _settings_data.get("default_contract_quantity", 1)
    ENABLE_TRADING: bool = _settings_data.get("enable_trading", True)
    
    # Service Configuration
    EXECUTION_POLL_INTERVAL: int = _settings_data.get("execution_poll_interval", 5)
    DRY_RUN_MODE: bool = _settings_data.get("dry_run_mode", False)
    
    # Position Limits
    MAX_TOTAL_CONTRACTS: int = _settings_data.get("max_total_contracts", 100)
    MAX_NOTIONAL_VALUE: float = _settings_data.get("max_notional_value", 50000.0)
    
    # Ticker Blacklist
    TICKER_BLACKLIST: list[str] = _settings_data.get("ticker_blacklist", [])

settings = Settings()
