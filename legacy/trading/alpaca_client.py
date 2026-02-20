import logging
from typing import Optional
from datetime import datetime
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import LimitOrderRequest, GetOrdersRequest
from alpaca.trading.enums import OrderSide, TimeInForce
from alpaca.common.exceptions import APIError
from config.config_loader import settings

logger = logging.getLogger(__name__)


class AlpacaClient:
    """Client for interacting with Alpaca API."""
    
    def __init__(self):
        if not settings.ALPACA_API_KEY or not settings.ALPACA_SECRET_KEY:
            raise ValueError("Alpaca API credentials not configured in .env file")
        
        self.client = TradingClient(
            api_key=settings.ALPACA_API_KEY,
            secret_key=settings.ALPACA_SECRET_KEY,
            paper=True,  # Always use paper trading
            base_url=settings.ALPACA_BASE_URL
        )
        logger.info("Alpaca client initialized (paper trading)")
    
    def format_alpaca_symbol(
        self,
        ticker: str,
        expiration: str,
        option_type: str,
        strike: float
    ) -> str:
        """
        Format options contract symbol in OCC format.
        Format: {TICKER}{YYYYMMDD}{C/P}{STRIKE*1000:08d}
        Example: SPX240220C06940000 = SPX, Feb 20 2024, Call, Strike 6940
        """
        # Parse expiration date
        exp_date = datetime.strptime(expiration, "%Y-%m-%d")
        exp_str = exp_date.strftime("%Y%m%d")
        
        # Format option type
        opt_char = "C" if option_type == "CALL" else "P"
        
        # Format strike (multiply by 1000 and pad to 8 digits)
        strike_str = f"{int(strike * 1000):08d}"
        
        return f"{ticker}{exp_str}{opt_char}{strike_str}"
    
    def get_option_contract(
        self,
        ticker: str,
        strike: float,
        option_type: str,
        expiration: str
    ) -> Optional[str]:
        """
        Get option contract symbol.
        Returns the formatted symbol if contract exists.
        """
        try:
            symbol = self.format_alpaca_symbol(ticker, expiration, option_type, strike)
            # Note: Alpaca API doesn't have a direct "check if contract exists" endpoint
            # We'll try to place an order and see if it's rejected
            # For now, just return the formatted symbol
            return symbol
        except Exception as e:
            logger.error(f"Error formatting contract symbol: {e}")
            return None
    
    def place_order(
        self,
        contract_symbol: str,
        quantity: int,
        side: str,  # "BUY" or "SELL"
        price: float
    ) -> Optional[str]:
        """
        Place a limit order on Alpaca.
        Returns order ID if successful, None otherwise.
        Note: Alpaca SDK is synchronous, so we wrap it in async context.
        """
        try:
            order_side = OrderSide.BUY if side == "BUY" else OrderSide.SELL
            
            order_request = LimitOrderRequest(
                symbol=contract_symbol,
                qty=quantity,
                side=order_side,
                limit_price=price,
                time_in_force=TimeInForce.DAY
            )
            
            order = self.client.submit_order(order_request)
            logger.info(
                f"Order placed: {side} {quantity} {contract_symbol} @ {price} "
                f"(Order ID: {order.id})"
            )
            return str(order.id)
        
        except APIError as e:
            logger.error(f"Alpaca API error placing order: {e}")
            return None
        except Exception as e:
            logger.error(f"Error placing order: {e}", exc_info=True)
            return None
    
    def get_account(self) -> Optional[dict]:
        """Get account information."""
        try:
            account = self.client.get_account()
            return {
                "buying_power": float(account.buying_power),
                "cash": float(account.cash),
                "portfolio_value": float(account.portfolio_value),
                "equity": float(account.equity)
            }
        except Exception as e:
            logger.error(f"Error getting account info: {e}")
            return None
    
    def get_positions(self) -> list[dict]:
        """Get current positions from Alpaca."""
        try:
            positions = self.client.get_all_positions()
            return [
                {
                    "symbol": pos.symbol,
                    "qty": int(pos.qty),
                    "avg_entry_price": float(pos.avg_entry_price),
                    "market_value": float(pos.market_value)
                }
                for pos in positions
            ]
        except Exception as e:
            logger.error(f"Error getting positions: {e}")
            return []


# Singleton instance (lazy initialization)
_alpaca_client: Optional[AlpacaClient] = None


def get_alpaca_client() -> AlpacaClient:
    """Get or create Alpaca client instance."""
    global _alpaca_client
    if _alpaca_client is None:
        _alpaca_client = AlpacaClient()
    return _alpaca_client
