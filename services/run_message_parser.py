import asyncio
import logging
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from connectors.discord_connector import run
from config.config_loader import settings

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler("logs/message_parser.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


if __name__ == "__main__":
    logger.info("Starting Message Parser Service (Discord)")
    logger.info(f"Trade queue storage: {settings.TRADE_QUEUE_STORAGE_TYPE}")
    
    try:
        run()
    except KeyboardInterrupt:
        logger.info("Message Parser Service stopped by user")
    except Exception as e:
        logger.error(f"Message Parser Service error: {e}", exc_info=True)
        sys.exit(1)
