"""
Financial entity extraction using spaCy + custom matchers.

Extracts: ticker symbols, strike prices, option types, expiration dates,
prices, quantities from unstructured trade messages.
"""

import re
from datetime import datetime

import spacy
from spacy.matcher import Matcher

COMMON_TICKERS = {
    "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "TSLA", "META", "NVDA",
    "AMD", "INTC", "NFLX", "SPY", "QQQ", "IWM", "SPX", "DIA", "VIX",
    "BABA", "NIO", "PLTR", "COIN", "SQ", "PYPL", "DIS", "BA", "JPM",
    "GS", "MS", "WMT", "TGT", "COST", "HD", "LOW", "V", "MA", "UBER",
    "LYFT", "SNAP", "PINS", "ROKU", "ZM", "CRWD", "NET", "DDOG",
    "SNOW", "RBLX", "SOFI", "HOOD", "ARM", "SMCI", "MARA", "RIOT",
    "XOM", "CVX", "COP", "OXY", "SLB", "HAL", "PFE", "JNJ", "MRK",
    "LLY", "ABBV", "UNH", "CVS", "WBA", "T", "VZ", "TMUS", "CRM",
    "ORCL", "IBM", "SHOP", "MELI", "SE", "BIDU", "JD", "PDD", "RIVN",
}

_nlp = None
_matcher = None


def _get_nlp():
    global _nlp, _matcher
    if _nlp is None:
        _nlp = spacy.load("en_core_web_sm")
        _matcher = Matcher(_nlp.vocab)

        _matcher.add("TICKER_STRIKE", [
            [{"TEXT": {"REGEX": r"^[A-Z]{1,5}$"}},
             {"TEXT": {"REGEX": r"^\d+(\.\d+)?[CcPp]$"}}],
        ])
        _matcher.add("DOLLAR_PRICE", [
            [{"TEXT": {"REGEX": r"^\$?\d+(\.\d{1,2})?$"}}],
        ])
        _matcher.add("OPTION_TYPE_WORD", [
            [{"LOWER": {"IN": ["call", "calls", "put", "puts"]}}],
        ])
    return _nlp, _matcher


def extract_entities(text: str) -> dict:
    """Extract financial entities from text."""
    nlp, matcher = _get_nlp()
    doc = nlp(text)

    result = {
        "ticker": None,
        "strike": None,
        "option_type": None,
        "expiration": None,
        "price": None,
        "quantity": None,
    }

    upper = text.upper()

    ticker_match = re.search(r"\b([A-Z]{1,5})\b", upper)
    if ticker_match:
        candidate = ticker_match.group(1)
        if candidate in COMMON_TICKERS:
            result["ticker"] = candidate

    if not result["ticker"]:
        matches = matcher(doc)
        for match_id, start, end in matches:
            label = nlp.vocab.strings[match_id]
            if label == "TICKER_STRIKE":
                span_text = doc[start:end].text.upper()
                parts = span_text.split()
                if len(parts) == 2 and parts[0] in COMMON_TICKERS:
                    result["ticker"] = parts[0]

    strike_pattern = re.search(r"(\d+(?:\.\d+)?)\s*[CcPp]\b", upper)
    if strike_pattern:
        result["strike"] = float(strike_pattern.group(1))
        char = upper[strike_pattern.end() - 1]
        result["option_type"] = "CALL" if char == "C" else "PUT"

    if not result["option_type"]:
        if re.search(r"\b(CALL|CALLS)\b", upper):
            result["option_type"] = "CALL"
        elif re.search(r"\b(PUT|PUTS)\b", upper):
            result["option_type"] = "PUT"

    price_patterns = [
        r"(?:@|at|for|entry|price)\s*\$?(\d+(?:\.\d{1,2})?)",
        r"\$(\d+(?:\.\d{1,2})?)\s*(?:entry|fill|avg|average)?",
    ]
    for pat in price_patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            result["price"] = float(m.group(1))
            break

    qty_match = re.search(r"(\d+)\s*(?:contracts?|lots?|x)\b", text, re.IGNORECASE)
    if qty_match:
        result["quantity"] = int(qty_match.group(1))

    for ent in doc.ents:
        if ent.label_ == "DATE" and not result["expiration"]:
            try:
                parsed = _parse_date(ent.text)
                if parsed:
                    result["expiration"] = parsed
            except Exception:
                pass

    if not result["expiration"]:
        date_patterns = [
            r"(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?",
            r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2})(?:\w*\s*,?\s*(\d{4}))?",
        ]
        for pat in date_patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                parsed = _parse_date(m.group(0))
                if parsed:
                    result["expiration"] = parsed
                    break

    return result


def _parse_date(text: str) -> str | None:
    """Try to parse a date string into YYYY-MM-DD format."""
    formats = [
        "%m/%d/%Y", "%m/%d/%y", "%m/%d",
        "%m-%d-%Y", "%m-%d-%y", "%m-%d",
        "%b %d %Y", "%b %d, %Y", "%b %d",
        "%B %d %Y", "%B %d, %Y", "%B %d",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(text.strip(), fmt)
            if dt.year < 2000:
                dt = dt.replace(year=datetime.now().year)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None
