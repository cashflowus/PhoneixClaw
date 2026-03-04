"""
AI expand endpoint — uses local Ollama (directly or via LLM Gateway) to expand
short user notes into full descriptions.
Used by the dashboard "magic wand" AI-assist for agent description and similar fields.
"""

import logging
import os

import httpx
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v2/ai", tags=["ai"])

OLLAMA_EXPAND_MODEL = os.getenv("OLLAMA_EXPAND_MODEL", "llama3.2:1b")
LLM_GATEWAY_URL = os.getenv("LLM_GATEWAY_URL", "")

SYSTEM_PROMPT = """You are a helpful assistant that expands brief user notes into clear, professional descriptions for trading agent configuration. Output only the expanded text, no preamble or quotes. Keep the result concise (2-4 sentences) and suitable for a dashboard form."""


async def _expand_via_gateway(user_message: str) -> str:
    """Route through the LLM Gateway service."""
    async with httpx.AsyncClient(base_url=LLM_GATEWAY_URL, timeout=httpx.Timeout(120, connect=10)) as client:
        resp = await client.post("/generate", json={
            "prompt": user_message,
            "model": OLLAMA_EXPAND_MODEL,
            "system": SYSTEM_PROMPT,
            "temperature": 0.5,
            "max_tokens": 256,
        })
        resp.raise_for_status()
        return (resp.json().get("text") or "").strip()


async def _expand_via_ollama_direct(user_message: str) -> str:
    """Route directly to the Ollama client (shared/llm)."""
    from shared.llm.client import OllamaClient

    client = OllamaClient()
    if not await client.is_healthy():
        raise HTTPException(
            status_code=503,
            detail="Ollama service is unavailable. Start Ollama and pull a model (e.g. ollama pull llama3.2:1b).",
        )
    response = await client.generate(
        prompt=user_message,
        model=OLLAMA_EXPAND_MODEL,
        system=SYSTEM_PROMPT,
        temperature=0.5,
        max_tokens=256,
    )
    await client.close()
    return (response.text or "").strip()


@router.post("/expand")
async def expand_prompt(body: dict) -> dict:
    """
    Expand a short user summary into a longer description using the local Ollama model.
    Body: { "prompt": "short summary", "context": "optional e.g. field name or agent type" }
    Returns: { "text": "expanded description" }
    """
    prompt = (body.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    context = (body.get("context") or "").strip()
    user_message = f"Expand this into a clear description: {prompt}"
    if context:
        user_message = f"Context: {context}\n\n{user_message}"

    try:
        if LLM_GATEWAY_URL:
            text = await _expand_via_gateway(user_message)
        else:
            text = await _expand_via_ollama_direct(user_message)

        if not text:
            raise HTTPException(status_code=502, detail="Ollama returned empty response")
        return {"text": text}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("AI expand failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail="AI assist unavailable. Ensure Ollama is running and a model is pulled.",
        ) from e
