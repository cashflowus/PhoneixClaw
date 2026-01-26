import asyncio
import logging
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from services.execution_service import execution_service
from db.db_util import init_db
from config.config_loader import settings

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler("logs/execution_service.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


async def main():
    logger.info("Starting Trade Execution Service")
    logger.info(f"Trade queue storage: {settings.TRADE_QUEUE_STORAGE_TYPE}")
    logger.info(f"Poll interval: {settings.EXECUTION_POLL_INTERVAL} seconds")
    logger.info(f"Dry run mode: {settings.DRY_RUN_MODE}")
    logger.info(f"Trading enabled: {settings.ENABLE_TRADING}")
    
    # Initialize database
    await init_db()
    
    # Run execution service
    try:
        await execution_service.run_loop()
    except KeyboardInterrupt:
        logger.info("Execution Service stopped by user")
        execution_service.stop()
    except Exception as e:
        logger.error(f"Execution Service error: {e}", exc_info=True)
        execution_service.stop()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
