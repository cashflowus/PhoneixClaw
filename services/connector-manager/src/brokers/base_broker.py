"""
Abstract base broker — all broker adapters implement this interface.

M2.11: Broker abstraction layer.
"""

from abc import ABC, abstractmethod
from typing import Any


class BaseBroker(ABC):
    @abstractmethod
    async def connect(self) -> None: ...

    @abstractmethod
    async def disconnect(self) -> None: ...

    @abstractmethod
    async def get_account(self) -> dict[str, Any]: ...

    @abstractmethod
    async def submit_order(self, order: dict) -> dict[str, Any]: ...

    @abstractmethod
    async def get_positions(self) -> list[dict]: ...

    @abstractmethod
    async def close_position(self, symbol: str) -> dict[str, Any]: ...

    @abstractmethod
    async def health_check(self) -> dict[str, Any]: ...
