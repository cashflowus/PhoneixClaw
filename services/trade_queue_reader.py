import csv
import platform
from datetime import datetime
from typing import List, Optional
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.models import TradeQueue
from db.db_util import AsyncSessionLocal
from config.config_loader import settings

# File locking for cross-platform support
if platform.system() == 'Windows':
    try:
        import msvcrt
        HAS_LOCKING = True
    except ImportError:
        HAS_LOCKING = False
else:
    try:
        import fcntl
        HAS_LOCKING = True
    except ImportError:
        HAS_LOCKING = False


class TradeQueueReader:
    """Abstract base class for reading trades from queue."""
    
    async def get_pending_trades(self) -> List[dict]:
        """Get all trades with status PENDING."""
        raise NotImplementedError
    
    async def mark_processing(self, trade_id: int) -> bool:
        """Mark trade as PROCESSING. Returns True if successful."""
        raise NotImplementedError
    
    async def mark_executed(self, trade_id: int, alpaca_order_id: Optional[str] = None) -> bool:
        """Mark trade as EXECUTED. Returns True if successful."""
        raise NotImplementedError
    
    async def mark_rejected(self, trade_id: int, error_message: str) -> bool:
        """Mark trade as REJECTED. Returns True if successful."""
        raise NotImplementedError
    
    async def mark_error(self, trade_id: int, error_message: str) -> bool:
        """Mark trade as ERROR. Returns True if successful."""
        raise NotImplementedError


class SQLTradeQueueReader(TradeQueueReader):
    """SQL-based trade queue reader."""
    
    async def get_pending_trades(self) -> List[dict]:
        """Get all pending trades."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(TradeQueue).where(TradeQueue.status == "PENDING")
                .order_by(TradeQueue.created_at)
            )
            trades = result.scalars().all()
            return [self._trade_to_dict(trade) for trade in trades]
    
    async def mark_processing(self, trade_id: int) -> bool:
        """Mark trade as PROCESSING."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(TradeQueue).where(TradeQueue.id == trade_id, TradeQueue.status == "PENDING")
            )
            trade = result.scalar_one_or_none()
            if trade:
                trade.status = "PROCESSING"
                await session.commit()
                return True
            return False
    
    async def mark_executed(self, trade_id: int, alpaca_order_id: Optional[str] = None) -> bool:
        """Mark trade as EXECUTED."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(TradeQueue).where(TradeQueue.id == trade_id)
            )
            trade = result.scalar_one_or_none()
            if trade:
                trade.status = "EXECUTED"
                trade.processed_at = datetime.utcnow()
                if alpaca_order_id:
                    trade.alpaca_order_id = alpaca_order_id
                await session.commit()
                return True
            return False
    
    async def mark_rejected(self, trade_id: int, error_message: str) -> bool:
        """Mark trade as REJECTED."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(TradeQueue).where(TradeQueue.id == trade_id)
            )
            trade = result.scalar_one_or_none()
            if trade:
                trade.status = "REJECTED"
                trade.error_message = error_message
                trade.processed_at = datetime.utcnow()
                await session.commit()
                return True
            return False
    
    async def mark_error(self, trade_id: int, error_message: str) -> bool:
        """Mark trade as ERROR."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(TradeQueue).where(TradeQueue.id == trade_id)
            )
            trade = result.scalar_one_or_none()
            if trade:
                trade.status = "ERROR"
                trade.error_message = error_message
                trade.processed_at = datetime.utcnow()
                await session.commit()
                return True
            return False
    
    def _trade_to_dict(self, trade: TradeQueue) -> dict:
        """Convert TradeQueue model to dict."""
        return {
            "id": trade.id,
            "ticker": trade.ticker,
            "option_type": trade.option_type,
            "strike": trade.strike,
            "expiration": trade.expiration,
            "action": trade.action,
            "quantity": trade.quantity,
            "price": trade.price,
            "source": trade.source,
            "source_message_id": trade.source_message_id,
            "raw_message": trade.raw_message,
            "status": trade.status,
            "error_message": trade.error_message,
            "created_at": trade.created_at,
            "processed_at": trade.processed_at,
            "alpaca_order_id": trade.alpaca_order_id
        }


class CSVTradeQueueReader(TradeQueueReader):
    """CSV-based trade queue reader."""
    
    def __init__(self, csv_path: str = "data/trade_queue.csv"):
        self.csv_path = Path(csv_path)
    
    async def get_pending_trades(self) -> List[dict]:
        """Get all pending trades from CSV."""
        if not self.csv_path.exists():
            return []
        
        pending_trades = []
        with open(self.csv_path, 'r', newline='') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('status') == 'PENDING':
                    pending_trades.append(dict(row))
        
        return pending_trades
    
    async def mark_processing(self, trade_id: int) -> bool:
        """Mark trade as PROCESSING in CSV."""
        return await self._update_status(trade_id, "PROCESSING")
    
    async def mark_executed(self, trade_id: int, alpaca_order_id: Optional[str] = None) -> bool:
        """Mark trade as EXECUTED in CSV."""
        return await self._update_status(trade_id, "EXECUTED", alpaca_order_id=alpaca_order_id)
    
    async def mark_rejected(self, trade_id: int, error_message: str) -> bool:
        """Mark trade as REJECTED in CSV."""
        return await self._update_status(trade_id, "REJECTED", error_message=error_message)
    
    async def mark_error(self, trade_id: int, error_message: str) -> bool:
        """Mark trade as ERROR in CSV."""
        return await self._update_status(trade_id, "ERROR", error_message=error_message)
    
    async def _update_status(self, trade_id: int, status: str, 
                           error_message: Optional[str] = None,
                           alpaca_order_id: Optional[str] = None) -> bool:
        """Update trade status in CSV (append-only approach)."""
        # For CSV, we'll append a new row with updated status
        # In a production system, you might want to use a separate status file
        # For simplicity, we'll read all rows and rewrite (with locking)
        if not self.csv_path.exists():
            return False
        
        rows = []
        found = False
        with open(self.csv_path, 'r', newline='') as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames
            for row in reader:
                if row.get('id') == str(trade_id):
                    found = True
                    row['status'] = status
                    if error_message:
                        row['error_message'] = error_message
                    if alpaca_order_id:
                        row['alpaca_order_id'] = alpaca_order_id
                    if status in ['EXECUTED', 'REJECTED', 'ERROR']:
                        row['processed_at'] = datetime.utcnow().isoformat()
                rows.append(row)
        
        if not found:
            return False
        
        # Write back with locking (if available)
        with open(self.csv_path, 'w', newline='') as f:
            try:
                # Lock file if locking is available
                if HAS_LOCKING:
                    if platform.system() == 'Windows':
                        msvcrt.locking(f.fileno(), msvcrt.LK_LOCK, 1)
                    else:
                        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
            finally:
                # Unlock file if locking was used
                if HAS_LOCKING:
                    if platform.system() == 'Windows':
                        msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)
                    else:
                        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        
        return True


def get_trade_queue_reader() -> TradeQueueReader:
    """Factory function to get appropriate reader based on config."""
    if settings.TRADE_QUEUE_STORAGE_TYPE.lower() == "csv":
        return CSVTradeQueueReader()
    else:
        return SQLTradeQueueReader()
