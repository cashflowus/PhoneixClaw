"""
Multi-Model Router — routes LLM tasks to optimal model by complexity.
Configured per OpenClaw instance via OpenRouter.
"""

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

OPENROUTER_BASE = "https://openrouter.ai/api/v1"

# Approximate $/1K tokens (input/output) for cost estimation
MODEL_COSTS: dict[str, tuple[float, float]] = {
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "deepseek/deepseek-chat": (0.14, 0.28),
    "meta-llama/llama-3-8b-instruct": (0.05, 0.15),
    "microsoft/phi-3-mini-4k-instruct": (0.20, 0.20),
}


class ModelRouter:
    TASK_ROUTES = {
        "complex_reasoning": "gpt-4o",
        "strategy_generation": "gpt-4o",
        "behavior_analysis": "gpt-4o",
        "research": "gpt-4o",
        "trade_evaluation": "gpt-4o-mini",
        "risk_assessment": "gpt-4o-mini",
        "summarization": "gpt-4o-mini",
        "price_check": "deepseek/deepseek-chat",
        "data_format": "deepseek/deepseek-chat",
        "lookup": "meta-llama/llama-3-8b-instruct",
        "headline_classify": "microsoft/phi-3-mini-4k-instruct",
    }

    def __init__(
        self,
        openrouter_api_key: str | None = None,
        default_model: str = "gpt-4o-mini",
    ):
        self.api_key = openrouter_api_key or os.getenv("OPENROUTER_API_KEY", "")
        self.default_model = default_model
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=OPENROUTER_BASE,
                timeout=httpx.Timeout(60.0),
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
            )
        return self._client

    def route(self, task_type: str, fallback: str | None = None) -> str:
        """Return the optimal model name for a task type."""
        model = self.TASK_ROUTES.get(task_type, fallback or self.default_model)
        return model

    async def complete(
        self,
        task_type: str,
        prompt: str,
        system: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs: Any,
    ) -> str:
        """Route to optimal model and get completion."""
        model = self.route(task_type, kwargs.get("fallback"))
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        payload.update(kwargs)

        try:
            client = await self._get_client()
            resp = await client.post("/chat/completions", json=payload)
            resp.raise_for_status()
            data = resp.json()
            choice = data.get("choices", [{}])[0]
            return choice.get("message", {}).get("content", "")
        except httpx.HTTPStatusError as e:
            logger.error("OpenRouter HTTP error %s: %s", e.response.status_code, e.response.text)
            raise
        except Exception as e:
            logger.error("OpenRouter completion failed: %s", e)
            raise

    def estimate_cost(self, task_type: str, input_tokens: int, output_tokens: int | None = None) -> float:
        """Estimate cost for a task in USD."""
        model = self.route(task_type)
        costs = MODEL_COSTS.get(model, (0.15, 0.60))
        inp_cost = (input_tokens / 1000) * costs[0]
        out_cost = ((output_tokens or input_tokens) / 1000) * costs[1]
        return round(inp_cost + out_cost, 6)
