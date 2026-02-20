import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.models import Position
from db.db_util import AsyncSessionLocal

logger = logging.getLogger(__name__)


class PositionManager:
    """Manages position tracking."""
    
    async def get_position(
        self,
        ticker: str,
        strike: float,
        option_type: str,
        expiration: str
    ) -> Optional[Position]:
        """Get current position for a contract."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Position).where(
                    Position.ticker == ticker,
                    Position.strike == strike,
                    Position.option_type == option_type,
                    Position.expiration == expiration
                )
            )
            return result.scalar_one_or_none()
    
    async def update_position(
        self,
        action: str,  # "BUY" or "SELL"
        quantity: int,
        price: float,
        ticker: str,
        strike: float,
        option_type: str,
        expiration: str
    ) -> Position:
        """
        Update position after a trade.
        For BUY: adds to position
        For SELL: subtracts from position
        """
        async with AsyncSessionLocal() as session:
            # Get existing position
            result = await session.execute(
                select(Position).where(
                    Position.ticker == ticker,
                    Position.strike == strike,
                    Position.option_type == option_type,
                    Position.expiration == expiration
                )
            )
            position = result.scalar_one_or_none()
            
            if action == "BUY":
                if position:
                    # Update existing position
                    old_qty = position.quantity
                    old_avg = position.avg_entry_price
                    new_qty = old_qty + quantity
                    new_avg = ((old_avg * old_qty) + (price * quantity)) / new_qty if new_qty > 0 else price
                    
                    position.quantity = new_qty
                    position.avg_entry_price = new_avg
                    position.total_cost = position.total_cost + (price * quantity)
                else:
                    # Create new position
                    position = Position(
                        ticker=ticker,
                        strike=strike,
                        option_type=option_type,
                        expiration=expiration,
                        quantity=quantity,
                        avg_entry_price=price,
                        total_cost=price * quantity
                    )
                    session.add(position)
            
            elif action == "SELL":
                if position:
                    # Update existing position (reduce quantity)
                    old_qty = position.quantity
                    new_qty = old_qty - quantity
                    
                    if new_qty == 0:
                        # Position closed, delete it
                        await session.delete(position)
                        position = None
                    else:
                        # Update quantity (average price stays the same)
                        position.quantity = new_qty
                        position.total_cost = position.avg_entry_price * new_qty
                else:
                    # Short position (negative quantity)
                    position = Position(
                        ticker=ticker,
                        strike=strike,
                        option_type=option_type,
                        expiration=expiration,
                        quantity=-quantity,  # Negative for short
                        avg_entry_price=price,
                        total_cost=price * quantity
                    )
                    session.add(position)
            
            await session.commit()
            if position:
                await session.refresh(position)
            
            logger.info(
                f"Updated position: {action} {quantity} {ticker} {strike}{option_type} "
                f"@ {price} -> Qty: {position.quantity if position else 0}"
            )
            
            return position
    
    async def calculate_sell_quantity(
        self,
        percentage: float,
        ticker: str,
        strike: float,
        option_type: str,
        expiration: str
    ) -> Optional[int]:
        """
        Calculate sell quantity from percentage.
        Returns None if position doesn't exist.
        """
        position = await self.get_position(ticker, strike, option_type, expiration)
        if not position:
            return None
        
        sell_quantity = int(position.quantity * percentage / 100)
        return max(1, sell_quantity)  # At least 1 contract
    
    async def get_all_positions(self) -> list[Position]:
        """Get all open positions."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Position))
            return list(result.scalars().all())


# Singleton instance
position_manager = PositionManager()
