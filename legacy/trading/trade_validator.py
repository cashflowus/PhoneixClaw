import logging
from typing import Optional
from trading.alpaca_client import get_alpaca_client
from trading.position_manager import position_manager
from config.config_loader import settings

logger = logging.getLogger(__name__)


class TradeValidator:
    """Validates trades before execution."""
    
    def __init__(self):
        self.alpaca_client = None
        if settings.ALPACA_API_KEY and settings.ALPACA_SECRET_KEY:
            try:
                self.alpaca_client = get_alpaca_client()
            except Exception as e:
                logger.warning(f"Could not initialize Alpaca client: {e}")
    
    async def validate_trade(self, trade: dict) -> tuple[bool, Optional[str]]:
        """
        Validate a trade before execution.
        Returns (is_valid, error_message)
        """
        # Check if trading is enabled
        if not settings.ENABLE_TRADING:
            return False, "Trading is disabled"
        
        # Check ticker blacklist
        ticker = trade.get("ticker", "").upper()
        if ticker in [t.upper() for t in settings.TICKER_BLACKLIST]:
            return False, f"Ticker {ticker} is blacklisted"
        
        # Check if we have required fields
        if not all([trade.get("ticker"), trade.get("strike"), trade.get("option_type"),
                   trade.get("action"), trade.get("price")]):
            return False, "Missing required trade fields"
        
        # Parse quantity
        quantity_str = str(trade.get("quantity", "1"))
        is_percentage = "%" in quantity_str
        
        if is_percentage:
            # For percentage sells, check if position exists
            if trade["action"] == "SELL":
                position = await position_manager.get_position(
                    trade["ticker"],
                    trade["strike"],
                    trade["option_type"],
                    trade["expiration"]
                )
                if not position:
                    return False, f"No position found for percentage sell: {trade['ticker']} {trade['strike']}{trade['option_type']}"
                if position.quantity <= 0:
                    return False, f"Position quantity is {position.quantity}, cannot sell"
        else:
            try:
                quantity = int(quantity_str)
                if quantity <= 0:
                    return False, f"Invalid quantity: {quantity}"
                
                # Check position size limits
                if quantity > settings.MAX_POSITION_SIZE:
                    return False, f"Quantity {quantity} exceeds max position size {settings.MAX_POSITION_SIZE}"
            except ValueError:
                return False, f"Invalid quantity format: {quantity_str}"
        
        # Check if we have expiration for options
        if not trade.get("expiration"):
            return False, "Expiration date is required for options"
        
        # Check buying power for BUY orders
        if trade["action"] == "BUY" and self.alpaca_client:
            account = self.alpaca_client.get_account()
            if account:
                qty = int(quantity_str.replace("%", "")) if not is_percentage else 1
                required_cash = float(trade["price"]) * qty * 100  # Options are per 100 shares
                if account["buying_power"] < required_cash:
                    return False, f"Insufficient buying power: need ${required_cash:.2f}, have ${account['buying_power']:.2f}"
        
        # Check total contracts limit
        if not is_percentage:
            all_positions = await position_manager.get_all_positions()
            total_contracts = sum(abs(p.quantity) for p in all_positions)
            new_total = total_contracts + int(quantity_str)
            if new_total > settings.MAX_TOTAL_CONTRACTS:
                return False, f"Total contracts {new_total} would exceed limit {settings.MAX_TOTAL_CONTRACTS}"
        
        return True, None


# Singleton instance
trade_validator = TradeValidator()
