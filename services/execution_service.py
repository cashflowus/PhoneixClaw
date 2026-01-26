import asyncio
import logging
from typing import Optional
from services.trade_queue_reader import get_trade_queue_reader
from trading.trade_validator import trade_validator
from trading.alpaca_client import get_alpaca_client
from trading.position_manager import position_manager
from config.config_loader import settings

logger = logging.getLogger(__name__)


class ExecutionService:
    """Service that polls trade queue and executes trades."""
    
    def __init__(self):
        self.reader = get_trade_queue_reader()
        self.running = False
    
    async def process_trade(self, trade: dict) -> bool:
        """Process a single trade from the queue."""
        trade_id = trade["id"]
        
        try:
            # Mark as processing
            await self.reader.mark_processing(trade_id)
            
            # Parse quantity
            quantity_str = str(trade["quantity"])
            is_percentage = "%" in quantity_str
            
            # Handle percentage sells
            if is_percentage and trade["action"] == "SELL":
                percentage = float(quantity_str.replace("%", ""))
                calculated_qty = await position_manager.calculate_sell_quantity(
                    percentage,
                    trade["ticker"],
                    trade["strike"],
                    trade["option_type"],
                    trade["expiration"]
                )
                if calculated_qty is None:
                    await self.reader.mark_rejected(
                        trade_id,
                        f"No position found for percentage sell"
                    )
                    return False
                quantity = calculated_qty
            else:
                quantity = int(quantity_str)
            
            # Validate trade
            is_valid, error_msg = await trade_validator.validate_trade({
                **trade,
                "quantity": quantity
            })
            
            if not is_valid:
                await self.reader.mark_rejected(trade_id, error_msg or "Validation failed")
                logger.warning(f"Trade {trade_id} rejected: {error_msg}")
                return False
            
            # Dry run mode check
            if settings.DRY_RUN_MODE:
                logger.info(
                    f"[DRY RUN] Would execute: {trade['action']} {quantity} "
                    f"{trade['ticker']} {trade['strike']}{trade['option_type']} @ {trade['price']}"
                )
                await self.reader.mark_executed(trade_id, "DRY_RUN")
                return True
            
            # Execute trade on Alpaca
            if not trade.get("expiration"):
                await self.reader.mark_rejected(trade_id, "Missing expiration date")
                return False
            
            alpaca_client = get_alpaca_client()
            contract_symbol = alpaca_client.format_alpaca_symbol(
                trade["ticker"],
                trade["expiration"],
                trade["option_type"],
                trade["strike"]
            )
            
            # Alpaca SDK is synchronous, run in executor
            import asyncio
            loop = asyncio.get_event_loop()
            order_id = await loop.run_in_executor(
                None,
                lambda: alpaca_client.place_order(
                    contract_symbol,
                    quantity,
                    trade["action"],
                    trade["price"]
                )
            )
            
            if not order_id:
                await self.reader.mark_error(trade_id, "Failed to place order on Alpaca")
                return False
            
            # Update position tracking
            await position_manager.update_position(
                trade["action"],
                quantity,
                trade["price"],
                trade["ticker"],
                trade["strike"],
                trade["option_type"],
                trade["expiration"]
            )
            
            # Mark as executed
            await self.reader.mark_executed(trade_id, order_id)
            logger.info(
                f"Trade {trade_id} executed: {trade['action']} {quantity} "
                f"{trade['ticker']} {trade['strike']}{trade['option_type']} @ {trade['price']} "
                f"(Alpaca Order: {order_id})"
            )
            
            return True
        
        except Exception as e:
            logger.error(f"Error processing trade {trade_id}: {e}", exc_info=True)
            await self.reader.mark_error(trade_id, str(e))
            return False
    
    async def run_once(self):
        """Process all pending trades once."""
        try:
            pending_trades = await self.reader.get_pending_trades()
            
            if not pending_trades:
                return
            
            logger.info(f"Processing {len(pending_trades)} pending trades")
            
            for trade in pending_trades:
                await self.process_trade(trade)
                # Small delay between trades
                await asyncio.sleep(0.5)
        
        except Exception as e:
            logger.error(f"Error in execution service run: {e}", exc_info=True)
    
    async def run_loop(self):
        """Run the execution service in a loop."""
        self.running = True
        logger.info("Execution service started")
        
        while self.running:
            try:
                await self.run_once()
            except Exception as e:
                logger.error(f"Error in execution loop: {e}", exc_info=True)
            
            # Wait before next poll
            await asyncio.sleep(settings.EXECUTION_POLL_INTERVAL)
    
    def stop(self):
        """Stop the execution service."""
        self.running = False
        logger.info("Execution service stopped")


# Singleton instance
execution_service = ExecutionService()
