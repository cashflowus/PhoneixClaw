"""
BERT/Seq2Seq entity extraction for options trade messages.

Uses google/flan-t5-small for zero-shot JSON extraction.
Falls back to spaCy+regex when model returns low confidence or missing fields.
"""

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

_model = None
_tokenizer = None

EXTRACTION_PROMPT = (
    "Extract ticker, strike, option_type, price, quantity, expiration from this options trade message. "
    "Output only valid JSON with keys: ticker, strike, option_type, price, quantity, expiration. "
    "Use null for missing values. Ticker is stock symbol (e.g. AAPL). Strike is number. "
    "option_type is CALL or PUT. price and quantity are numbers. expiration is YYYY-MM-DD. "
    "Message: {text}"
)


def _get_model():
    global _model, _tokenizer
    if _model is None:
        try:
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

            logger.info("Loading FLAN-T5-small for entity extraction...")
            _tokenizer = AutoTokenizer.from_pretrained("google/flan-t5-small")
            _model = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-small")
            logger.info("FLAN-T5-small loaded")
        except Exception as e:
            logger.warning("Failed to load FLAN-T5: %s. BERT extraction disabled.", e)
            _model = _tokenizer = None
    return _model, _tokenizer


def extract_entities_bert(text: str) -> dict[str, Any] | None:
    """
    Extract entities using FLAN-T5. Returns None if model unavailable or parse fails.
    """
    model, tokenizer = _get_model()
    if model is None or tokenizer is None:
        return None

    try:
        prompt = EXTRACTION_PROMPT.format(text=text[:500])
        inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
        outputs = model.generate(**inputs, max_new_tokens=128)
        decoded = tokenizer.batch_decode(outputs, skip_special_tokens=True)[0].strip()

        # Try to parse JSON (model may return extra text)
        decoded = _extract_json_from_output(decoded)
        if not decoded:
            return None

        data = json.loads(decoded)
        result = {
            "ticker": _safe_str(data.get("ticker")),
            "strike": _safe_float(data.get("strike")),
            "option_type": _normalize_option_type(data.get("option_type")),
            "expiration": _safe_expiration(data.get("expiration")),
            "price": _safe_float(data.get("price")),
            "quantity": _safe_int(data.get("quantity")),
        }
        # Consider valid if we got at least ticker and (strike or price)
        if result["ticker"] and (result["strike"] is not None or result["price"] is not None):
            return result
        return None
    except Exception as e:
        logger.debug("BERT entity extraction failed: %s", e)
        return None


def _extract_json_from_output(text: str) -> str | None:
    """Extract JSON object from model output (may have extra text)."""
    # Look for {...}
    match = re.search(r"\{[^{}]*\}", text)
    if match:
        return match.group(0)
    return None


def _safe_str(val: Any) -> str | None:
    if val is None:
        return None
    s = str(val).strip().upper()
    return s if s and s != "NULL" and len(s) <= 5 else None


def _safe_float(val: Any) -> float | None:
    if val is None:
        return None
    try:
        f = float(val)
        return f if f > 0 and f < 1e7 else None
    except (ValueError, TypeError):
        return None


def _safe_int(val: Any) -> int | None:
    if val is None:
        return None
    try:
        i = int(float(val))
        return i if 0 < i < 1000 else None
    except (ValueError, TypeError):
        return None


def _normalize_option_type(val: Any) -> str | None:
    if val is None:
        return None
    s = str(val).upper().strip()
    if "CALL" in s or s == "C":
        return "CALL"
    if "PUT" in s or s == "P":
        return "PUT"
    return None


def _safe_expiration(val: Any) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    if re.match(r"\d{4}-\d{2}-\d{2}", s):
        return s[:10]
    return None
