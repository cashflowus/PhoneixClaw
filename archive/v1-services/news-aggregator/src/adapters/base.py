from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class RawHeadline:
    title: str
    summary: str | None = None
    url: str | None = None
    image_url: str | None = None
    author: str | None = None
    category: str | None = None
    published_at: str | None = None
    source_api: str = ""


class NewsAdapter(ABC):
    source_api: str = ""

    @abstractmethod
    async def fetch(self, api_key: str, config: dict | None = None) -> list[RawHeadline]:
        ...
