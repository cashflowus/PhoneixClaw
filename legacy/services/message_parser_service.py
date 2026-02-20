import logging
from typing import List, Optional
from parsing.trade_parser import parse_trade_message
from services.trade_queue_writer import get_trade_queue_writer
from config.config_loader import settings

logger = logging.getLogger(__name__)


async def parse_and_store_message(
    message_text: str,
    source: str = "discord",
    source_message_id: Optional[str] = None
) -> List[int]:
    """
    Parse a message and store parsed trades to the trade queue.
    
    Args:
        message_text: The raw message text to parse
        source: Source of the message ("discord", "whatsapp", "reddit")
        source_message_id: Optional message ID from the source platform
    
    Returns:
        List of trade queue entry IDs that were created
    """
    try:
        # Parse the message
        parsed = parse_trade_message(message_text)
        
        if not parsed.get("actions"):
            logger.debug(f"No trade actions found in message: {message_text[:100]}")
            return []
        
        # Get writer
        writer = get_trade_queue_writer()
        
        # Store each trade action
        trade_ids = []
        for action in parsed["actions"]:
            # Set default quantity if not specified
            quantity = action.get("quantity", settings.DEFAULT_CONTRACT_QUANTITY)
            
            trade_data = {
                "ticker": action["ticker"],
                "option_type": action["option_type"],
                "strike": action["strike"],
                "expiration": action.get("expiration"),
                "action": action["action"],
                "quantity": quantity,
                "price": action["price"],
                "source": source,
                "source_message_id": source_message_id,
                "raw_message": message_text
            }
            
            trade_id = await writer.add_trade(trade_data)
            trade_ids.append(trade_id)
            logger.info(
                f"Stored trade to queue: {action['action']} {action['ticker']} "
                f"{action['strike']}{action['option_type']} @ {action['price']} "
                f"(ID: {trade_id})"
            )
        
        return trade_ids
    
    except Exception as e:
        logger.error(f"Error parsing and storing message: {e}", exc_info=True)
        return []
