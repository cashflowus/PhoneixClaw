"""
NLP Trade Parser Service

A FastAPI microservice that uses FinBERT (intent classification) and
spaCy (entity extraction) to parse unstructured trading messages into
structured trade signals.
"""

import logging
import time

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("nlp-parser")

app = FastAPI(title="NLP Trade Parser", version="1.0.0")


class ParseRequest(BaseModel):
    text: str
    user_id: str | None = None
    channel_id: str | None = None


class ParseResponse(BaseModel):
    is_trade_signal: bool
    action: str | None = None
    ticker: str | None = None
    strike: float | None = None
    option_type: str | None = None
    expiration: str | None = None
    price: float | None = None
    quantity: int | None = None
    confidence: float = 0.0
    sentiment: str | None = None
    method: str = "unknown"
    latency_ms: int = 0


@app.on_event("startup")
async def startup():
    logger.info("Pre-loading NLP models...")
    from src.entity_extractor import extract_entities
    from src.intent_classifier import classify_intent

    sample = "BTO AAPL 190C 3/21 @ 2.50"
    classify_intent(sample)
    extract_entities(sample)
    try:
        from src.bert_entity_extractor import extract_entities_bert
        extract_entities_bert(sample)
        logger.info("BERT entity extractor loaded")
    except Exception as e:
        logger.warning("BERT entity extractor not loaded: %s", e)
    logger.info("NLP models loaded and ready")


@app.get("/health")
async def health():
    return {"status": "ready", "service": "nlp-parser"}


def _get_entities(text: str) -> dict:
    """Try BERT entity extraction first, fall back to spaCy+regex."""
    from src.bert_entity_extractor import extract_entities_bert
    from src.entity_extractor import extract_entities

    bert_result = extract_entities_bert(text)
    if bert_result and bert_result.get("ticker") and (
        bert_result.get("price") or bert_result.get("strike")
    ):
        return bert_result
    return extract_entities(text)


@app.post("/parse", response_model=ParseResponse)
async def parse_message(req: ParseRequest):
    from src.intent_classifier import classify_intent

    start = time.monotonic()

    intent = classify_intent(req.text)
    entities = _get_entities(req.text)

    action = intent.get("action")
    if entities.get("option_type") and not action:
        action = "BUY"

    latency_ms = int((time.monotonic() - start) * 1000)

    return ParseResponse(
        is_trade_signal=intent["is_trade_signal"],
        action=action,
        ticker=entities.get("ticker"),
        strike=entities.get("strike"),
        option_type=entities.get("option_type"),
        expiration=entities.get("expiration"),
        price=entities.get("price"),
        quantity=entities.get("quantity"),
        confidence=intent["confidence"],
        sentiment=intent.get("sentiment"),
        method=intent["method"],
        latency_ms=latency_ms,
    )


@app.post("/batch")
async def batch_parse(messages: list[ParseRequest]):
    from src.entity_extractor import extract_entities
    from src.intent_classifier import classify_intent

    results = []
    for msg in messages:
        start = time.monotonic()
        intent = classify_intent(msg.text)
        entities = extract_entities(msg.text)
        action = intent.get("action")
        if entities.get("option_type") and not action:
            action = "BUY"
        latency_ms = int((time.monotonic() - start) * 1000)
        results.append(ParseResponse(
            is_trade_signal=intent["is_trade_signal"],
            action=action,
            ticker=entities.get("ticker"),
            strike=entities.get("strike"),
            option_type=entities.get("option_type"),
            expiration=entities.get("expiration"),
            price=entities.get("price"),
            quantity=entities.get("quantity"),
            confidence=intent["confidence"],
            sentiment=intent.get("sentiment"),
            method=intent["method"],
            latency_ms=latency_ms,
        ))
    return results


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8020)
