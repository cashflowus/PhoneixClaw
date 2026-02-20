#!/usr/bin/env python3
"""Rotate Fernet encryption key for stored credentials.

Usage:
    python scripts/credential_rotation.py --old-key OLD_KEY --new-key NEW_KEY
"""
import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from cryptography.fernet import Fernet
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from shared.config.base_config import config
from shared.models.trade import TradingAccount, DataSource

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def rotate_keys(old_key: str, new_key: str):
    old_fernet = Fernet(old_key.encode())
    new_fernet = Fernet(new_key.encode())

    engine = create_async_engine(config.database.url)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        for model in [TradingAccount, DataSource]:
            result = await session.execute(select(model))
            records = result.scalars().all()
            count = 0
            for record in records:
                try:
                    decrypted = json.loads(old_fernet.decrypt(record.credentials_encrypted).decode())
                    record.credentials_encrypted = new_fernet.encrypt(json.dumps(decrypted).encode())
                    count += 1
                except Exception as e:
                    logger.error("Failed to rotate %s ID=%s: %s", model.__tablename__, record.id, e)
            logger.info("Rotated %d %s records", count, model.__tablename__)
        await session.commit()
    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Rotate Fernet encryption keys")
    parser.add_argument("--old-key", required=True, help="Current encryption key")
    parser.add_argument("--new-key", required=True, help="New encryption key")
    args = parser.parse_args()
    asyncio.run(rotate_keys(args.old_key, args.new_key))
