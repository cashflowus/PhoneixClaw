"""
Trade intent classification using FinBERT + zero-shot prompting.

Determines if a message is a trade signal and classifies the action
(BUY, SELL, HOLD, or NOT_TRADE).
"""

import logging
import re

from transformers import AutoModelForSequenceClassification, AutoTokenizer, pipeline

logger = logging.getLogger(__name__)

_classifier = None

BUY_KEYWORDS = {
    "buy", "bought", "buying", "long", "bto", "btc", "opening",
    "entered", "entering", "added", "adding", "loading", "loaded",
    "grabbed", "scooped", "picked up", "going long", "calls",
    "bullish", "lotto", "yolo", "alert", "new position", "entry",
}

SELL_KEYWORDS = {
    "sell", "sold", "selling", "short", "stc", "sto", "closing",
    "exited", "exiting", "trimmed", "trimming", "took profits",
    "taking profits", "closed", "puts", "bearish", "dump", "dumped",
    "cut", "cutting", "out of", "flat",
}


def _get_classifier():
    global _classifier
    if _classifier is None:
        logger.info("Loading FinBERT model...")
        model_name = "ProsusAI/finbert"
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSequenceClassification.from_pretrained(model_name)
        _classifier = pipeline(
            "sentiment-analysis",
            model=model,
            tokenizer=tokenizer,
            truncation=True,
            max_length=512,
        )
        logger.info("FinBERT model loaded")
    return _classifier


def classify_intent(text: str) -> dict:
    """
    Classify trade intent from message text.

    Returns:
        {
            "is_trade_signal": bool,
            "action": "BUY" | "SELL" | "HOLD" | null,
            "confidence": float,
            "sentiment": "positive" | "negative" | "neutral",
            "method": "keyword" | "finbert"
        }
    """
    text_lower = text.lower()

    has_ticker = bool(re.search(r"\b[A-Z]{1,5}\b", text))
    has_price = bool(re.search(r"\$?\d+\.?\d*", text))
    has_strike = bool(re.search(r"\d+[CcPp]\b", text))

    buy_score = sum(1 for kw in BUY_KEYWORDS if kw in text_lower)
    sell_score = sum(1 for kw in SELL_KEYWORDS if kw in text_lower)

    if (buy_score > 0 or sell_score > 0) and (has_ticker or has_strike):
        action = "BUY" if buy_score >= sell_score else "SELL"
        confidence = min(0.95, 0.6 + 0.1 * max(buy_score, sell_score))
        return {
            "is_trade_signal": True,
            "action": action,
            "confidence": round(confidence, 3),
            "sentiment": "positive" if action == "BUY" else "negative",
            "method": "keyword",
        }

    try:
        clf = _get_classifier()
        result = clf(text)[0]
        sentiment = result["label"].lower()
        score = result["score"]

        is_signal = (has_ticker or has_strike) and sentiment != "neutral"
        action = None
        if is_signal:
            action = "BUY" if sentiment == "positive" else "SELL"

        return {
            "is_trade_signal": is_signal,
            "action": action,
            "confidence": round(score, 3),
            "sentiment": sentiment,
            "method": "finbert",
        }
    except Exception:
        logger.exception("FinBERT classification failed, using heuristic")
        is_signal = has_ticker and (has_price or has_strike)
        return {
            "is_trade_signal": is_signal,
            "action": "BUY" if is_signal else None,
            "confidence": 0.3,
            "sentiment": "unknown",
            "method": "heuristic",
        }
