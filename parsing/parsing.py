import re
from datetime import datetime
from typing import Any

# ---- Regex definitions ----
TICKER = r"\b[A-Z]{1,5}\b"
DATE1  = r"(?P<m>\d{1,2})[\/\-](?P<d>\d{1,2})(?:[\/\-](?P<y>\d{2,4}))?"
DATE2  = r"(?P<y2>\d{4})[\/\-](?P<m2>\d{1,2})[\/\-](?P<d2>\d{1,2})"
STRIKE = r"(?P<strike>\d+(?:\.\d+)?)"
OPT    = r"(?P<cp>[cCpP])"

PATTERNS = [
    re.compile(fr"(?P<sym>{TICKER})\s+{DATE1}\s+{STRIKE}\s*{OPT}"),
    re.compile(fr"(?P<sym>{TICKER})\s+{DATE2}\s+{STRIKE}\s*{OPT}")
]

def parse_tickers_and_options(text: str) -> dict[str, Any]:
    """Parse message text for tickers and options contracts."""
    text = text.upper()
    tickers = set(re.findall(TICKER, text))
    contracts = []

    for pat in PATTERNS:
        for m in pat.finditer(text):
            sym = m.group("sym")
            y = m.group("y") or m.group("y2")
            mth = m.group("m") or m.group("m2")
            d = m.group("d") or m.group("d2")

            # Normalize year
            y = int(y) + 2000 if y and len(y) == 2 else int(y) if y else datetime.now().year
            exp = datetime(y, int(mth), int(d)).date()
            strike = float(m.group("strike"))
            cp = m.group("cp").upper()
            contracts.append({
                "symbol": sym,
                "expiry": str(exp),
                "strike": strike,
                "type": "CALL" if cp == "C" else "PUT"
            })

    return {
        "tickers": list(tickers),
        "contracts": contracts,
        "trade": bool(contracts)
    }
