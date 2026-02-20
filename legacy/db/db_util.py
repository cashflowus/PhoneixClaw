import asyncio
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from config.config_loader import settings
from db.models import Base, TradeQueue, Position, FilteredMessage, TradeCandidate

# ---- Engine & Session ----
engine = create_async_engine(settings.DB_URL, echo=False, future=True)
AsyncSessionLocal = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def init_db():
    """Initialize database and create tables if missing."""
    # Import all models to ensure they're registered
    from db.models import TradeQueue, Position, FilteredMessage, TradeCandidate
    
    # Create engine and tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Database initialized and tables created")

# ---- Insert helpers ----
async def save_filtered_message(message_data: dict):
    """Save parsed message into filtered_messages table."""
    async with AsyncSessionLocal() as session:
        msg = FilteredMessage(
            message_id=str(message_data["id"]),
            author=message_data["author"],
            channel=message_data["channel"],
            ts=datetime.fromisoformat(message_data["ts"].replace("Z", "+00:00")),
            content=message_data["content"],
            parsed=message_data.get("parsed", {})
        )
        session.add(msg)
        await session.commit()
        print(f"Saved message from {msg.author} ({msg.channel})")

async def save_trade_candidate(parsed_data: dict, raw_message: dict):
    """Optionally store trade candidates separately."""
    for contract in parsed_data.get("contracts", []):
        async with AsyncSessionLocal() as session:
            trade = TradeCandidate(
                message_id=str(raw_message["id"]),
                author=raw_message["author"],
                ts=datetime.fromisoformat(raw_message["ts"].replace("Z", "+00:00")),
                stock=contract["symbol"],
                trade_type=contract["type"],
                expiry=contract["expiry"],
                strike=contract["strike"],
                direction="BULLISH" if contract["type"] == "CALL" else "BEARISH",
                raw=raw_message,
            )
            session.add(trade)
            await session.commit()
            print(f"Trade candidate: {trade.stock} {trade.trade_type} {trade.strike} {trade.expiry}")
