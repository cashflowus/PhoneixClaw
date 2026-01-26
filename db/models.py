from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Float, JSON, Text, Index
)
from sqlalchemy.orm import declarative_base

Base = declarative_base()


# Legacy models (keeping for backward compatibility)
class FilteredMessage(Base):
    __tablename__ = "filtered_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source = Column(String(50), default="discord")
    message_id = Column(String(50))
    author = Column(String(100))
    channel = Column(String(100))
    ts = Column(DateTime, default=datetime.utcnow)
    content = Column(Text)
    sentiment_label = Column(String(20), nullable=True)
    sentiment_score = Column(Float, nullable=True)
    is_candidate = Column(Boolean, default=False)
    rank = Column(Float, nullable=True)
    parsed = Column(JSON)


class TradeCandidate(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source = Column(String(50), default="discord")
    message_id = Column(String(50))
    author = Column(String(100))
    ts = Column(DateTime, default=datetime.utcnow)
    stock = Column(String(10))
    trade_type = Column(String(20))
    expiry = Column(String(20))
    strike = Column(Float)
    direction = Column(String(20))
    raw = Column(JSON)


# New models for microservices architecture
class TradeQueue(Base):
    """Trade queue table for storing parsed trades before execution."""
    __tablename__ = "trade_queue"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(10), nullable=False)
    option_type = Column(String(4), nullable=False)  # "CALL" or "PUT"
    strike = Column(Float, nullable=False)
    expiration = Column(String(10), nullable=True)  # YYYY-MM-DD format
    action = Column(String(4), nullable=False)  # "BUY" or "SELL"
    quantity = Column(String(20), nullable=False)  # Can be integer or percentage like "50%"
    price = Column(Float, nullable=False)
    source = Column(String(20), nullable=False, default="discord")  # "discord", "whatsapp", "reddit"
    source_message_id = Column(String(50), nullable=True)
    raw_message = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="PENDING")  # PENDING, PROCESSING, EXECUTED, REJECTED, ERROR
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)
    alpaca_order_id = Column(String(50), nullable=True)

    # Indexes for efficient querying
    __table_args__ = (
        Index('idx_status', 'status'),
        Index('idx_created_at', 'created_at'),
        Index('idx_ticker_strike_type_exp', 'ticker', 'strike', 'option_type', 'expiration'),
    )


class Position(Base):
    """Current positions tracking."""
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(10), nullable=False)
    strike = Column(Float, nullable=False)
    option_type = Column(String(4), nullable=False)  # "CALL" or "PUT"
    expiration = Column(String(10), nullable=False)  # YYYY-MM-DD format
    quantity = Column(Integer, nullable=False)  # Can be negative for shorts
    avg_entry_price = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Composite unique constraint
    __table_args__ = (
        Index('idx_unique_position', 'ticker', 'strike', 'option_type', 'expiration', unique=True),
    )
