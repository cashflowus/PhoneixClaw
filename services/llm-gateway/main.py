"""
Phoenix LLM Gateway — shared interface for all Phoenix services to talk to Ollama.
Any service (API, Bridge, Orchestrator, etc.) can call this gateway instead of Ollama directly.
"""

import logging
import os

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_MODEL = os.getenv("OLLAMA_DEFAULT_MODEL", "llama3.2:1b")
TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "120"))

app = FastAPI(
    title="Phoenix LLM Gateway",
    description="Shared LLM interface for all Phoenix services",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _ollama_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=OLLAMA_BASE_URL,
        timeout=httpx.Timeout(TIMEOUT, connect=10.0),
    )


@app.get("/health")
async def health():
    """Health check — also verifies Ollama connectivity."""
    try:
        async with await _ollama_client() as client:
            resp = await client.get("/api/tags", timeout=5.0)
            if resp.status_code == 200:
                return {"status": "healthy", "ollama": "connected"}
    except Exception:
        pass
    return {"status": "degraded", "ollama": "unreachable"}


@app.get("/models")
async def list_models():
    """List available Ollama models."""
    try:
        async with await _ollama_client() as client:
            resp = await client.get("/api/tags", timeout=10.0)
            resp.raise_for_status()
            data = resp.json()
            return {"models": data.get("models", [])}
    except Exception as e:
        logger.exception("Failed to list models: %s", e)
        raise HTTPException(status_code=503, detail="Ollama unreachable") from e


@app.post("/generate")
async def generate(body: dict):
    """
    Forward a generate request to Ollama.
    Body: { "prompt": str, "model"?: str, "system"?: str, "temperature"?: float, "max_tokens"?: int }
    Returns: { "text": str, "model": str, "done": bool }
    """
    prompt = (body.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    model = body.get("model") or DEFAULT_MODEL
    payload: dict = {
        "model": model,
        "prompt": prompt,
        "stream": False,
    }
    if body.get("system"):
        payload["system"] = body["system"]

    options: dict = {}
    if body.get("temperature") is not None:
        options["temperature"] = body["temperature"]
    if body.get("max_tokens") is not None:
        options["num_predict"] = body["max_tokens"]
    if options:
        payload["options"] = options

    try:
        async with await _ollama_client() as client:
            resp = await client.post("/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return {
                "text": data.get("response", ""),
                "model": data.get("model", model),
                "done": data.get("done", True),
            }
    except httpx.HTTPStatusError as e:
        logger.error("Ollama generate error: %s %s", e.response.status_code, e.response.text[:200])
        raise HTTPException(status_code=502, detail="Ollama generate failed") from e
    except Exception as e:
        logger.exception("LLM Gateway generate error: %s", e)
        raise HTTPException(status_code=503, detail="Ollama unreachable") from e


@app.post("/chat")
async def chat(body: dict):
    """
    Forward a chat request to Ollama.
    Body: { "model"?: str, "messages": [{ "role": str, "content": str }], "temperature"?: float }
    Returns: { "message": { "role": str, "content": str }, "model": str }
    """
    messages = body.get("messages")
    if not messages or not isinstance(messages, list):
        raise HTTPException(status_code=400, detail="messages array is required")

    model = body.get("model") or DEFAULT_MODEL
    payload: dict = {
        "model": model,
        "messages": messages,
        "stream": False,
    }
    options: dict = {}
    if body.get("temperature") is not None:
        options["temperature"] = body["temperature"]
    if options:
        payload["options"] = options

    try:
        async with await _ollama_client() as client:
            resp = await client.post("/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return {
                "message": data.get("message", {}),
                "model": data.get("model", model),
            }
    except httpx.HTTPStatusError as e:
        logger.error("Ollama chat error: %s %s", e.response.status_code, e.response.text[:200])
        raise HTTPException(status_code=502, detail="Ollama chat failed") from e
    except Exception as e:
        logger.exception("LLM Gateway chat error: %s", e)
        raise HTTPException(status_code=503, detail="Ollama unreachable") from e


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8050)
