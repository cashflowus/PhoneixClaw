import csv
import os
import platform
from datetime import datetime
from typing import Optional
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


class TradeQueueWriter:
    """Abstract base class for writing trades to queue."""
    
    async def add_trade(self, trade_data: dict) -> int:
        """Add a trade to the queue. Returns trade queue entry ID."""
        raise NotImplementedError


class SQLTradeQueueWriter(TradeQueueWriter):
    """SQL-based trade queue writer."""
    
    async def add_trade(self, trade_data: dict) -> int:
        """Add trade to SQL database."""
        async with AsyncSessionLocal() as session:
            trade = TradeQueue(
                ticker=trade_data["ticker"],
                option_type=trade_data["option_type"],
                strike=trade_data["strike"],
                expiration=trade_data.get("expiration"),
                action=trade_data["action"],
                quantity=str(trade_data["quantity"]),  # Store as string to handle percentages
                price=trade_data["price"],
                source=trade_data.get("source", "discord"),
                source_message_id=trade_data.get("source_message_id"),
                raw_message=trade_data.get("raw_message"),
                status="PENDING",
                created_at=datetime.utcnow()
            )
            session.add(trade)
            await session.commit()
            await session.refresh(trade)
            return trade.id


class CSVTradeQueueWriter(TradeQueueWriter):
    """CSV-based trade queue writer."""
    
    def __init__(self, csv_path: str = "data/trade_queue.csv"):
        self.csv_path = Path(csv_path)
        self.csv_path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_csv_exists()
    
    def _ensure_csv_exists(self):
        """Create CSV file with headers if it doesn't exist."""
        if not self.csv_path.exists():
            with open(self.csv_path, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'id', 'ticker', 'option_type', 'strike', 'expiration', 'action',
                    'quantity', 'price', 'source', 'source_message_id', 'raw_message',
                    'status', 'error_message', 'created_at', 'processed_at', 'alpaca_order_id'
                ])
    
    async def add_trade(self, trade_data: dict) -> int:
        """Add trade to CSV file."""
        # Read current max ID
        max_id = 0
        if self.csv_path.exists():
            with open(self.csv_path, 'r', newline='') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row.get('id') and row['id'].isdigit():
                        max_id = max(max_id, int(row['id']))
        
        new_id = max_id + 1
        
        # Append new row with file locking (if available)
        with open(self.csv_path, 'a', newline='') as f:
            try:
                # Lock file if locking is available
                if HAS_LOCKING:
                    if platform.system() == 'Windows':
                        msvcrt.locking(f.fileno(), msvcrt.LK_LOCK, 1)
                    else:
                        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                
                writer = csv.writer(f)
                writer.writerow([
                    new_id,
                    trade_data["ticker"],
                    trade_data["option_type"],
                    trade_data["strike"],
                    trade_data.get("expiration", ""),
                    trade_data["action"],
                    str(trade_data["quantity"]),
                    trade_data["price"],
                    trade_data.get("source", "discord"),
                    trade_data.get("source_message_id", ""),
                    trade_data.get("raw_message", ""),
                    "PENDING",
                    "",  # error_message
                    datetime.utcnow().isoformat(),  # created_at
                    "",  # processed_at
                    ""  # alpaca_order_id
                ])
            finally:
                # Unlock file if locking was used
                if HAS_LOCKING:
                    if platform.system() == 'Windows':
                        msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)
                    else:
                        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        
        return new_id


def get_trade_queue_writer() -> TradeQueueWriter:
    """Factory function to get appropriate writer based on config."""
    if settings.TRADE_QUEUE_STORAGE_TYPE.lower() == "csv":
        return CSVTradeQueueWriter()
    else:
        return SQLTradeQueueWriter()
