import re
from datetime import datetime
from typing import Any, Optional


def parse_trade_message(text: str) -> dict[str, Any]:
    """
    Parse trading messages to extract trade actions.
    
    Examples:
    - "Bought IWM 250P at 1.50 Exp: 02/20/2026"
    - "Bought SPX 6940C at 4.80"
    - "Sold 50% SPX 6950C at 6.50"
    - "Sold 70% SPX 6950C at 8 Looks ready for 6950 Test"
    
    Returns:
    {
        "actions": [
            {
                "action": "BUY" | "SELL",
                "ticker": "IWM",
                "strike": 250.0,
                "option_type": "PUT" | "CALL",
                "expiration": "2026-02-20" | None,
                "quantity": 1 | "50%",
                "price": 1.50,
                "is_percentage": False
            }
        ],
        "raw_message": "..."
    }
    """
    text_upper = text.upper().strip()
    actions = []
    
    # Extract expiration first (might appear anywhere in message)
    expiration = None
    exp_patterns = [
        r"EXP:\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})",
        r"(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})",  # Date without "Exp:"
    ]
    for exp_pat in exp_patterns:
        exp_match = re.search(exp_pat, text_upper)
        if exp_match:
            m = exp_match.group(1) if len(exp_match.groups()) >= 1 else None
            d = exp_match.group(2) if len(exp_match.groups()) >= 2 else None
            y = exp_match.group(3) if len(exp_match.groups()) >= 3 else None
            if m and d:
                y = int(y) if y else datetime.now().year
                if len(str(y)) == 2:
                    y = 2000 + int(y)
                try:
                    expiration = datetime(int(y), int(m), int(d)).strftime("%Y-%m-%d")
                except ValueError:
                    pass
            break
    
    # Buy pattern: (?:BOUGHT|BUY)\s+([quantity])?\s*([A-Z]{1,5})\s+(\d+(?:\.\d+)?)([CP])\s+(?:AT\s+)?\$?(\d+(?:\.\d+)?)
    buy_pattern = r"(?:BOUGHT|BUY)\s+(?:(\d+(?:\.\d+)?)\s*(?:CONTRACTS?)?|(\d+)%)?\s*([A-Z]{1,5})\s+(\d+(?:\.\d+)?)([CP])\s+(?:AT\s+)?\$?(\d+(?:\.\d+)?)"
    
    # Sell pattern: (?:SOLD|SELL)\s+([quantity])?\s*([A-Z]{1,5})\s+(\d+(?:\.\d+)?)([CP])\s+(?:AT\s+)?\$?(\d+(?:\.\d+)?)
    sell_pattern = r"(?:SOLD|SELL)\s+(?:(\d+(?:\.\d+)?)\s*(?:CONTRACTS?)?|(\d+)%)?\s*([A-Z]{1,5})\s+(\d+(?:\.\d+)?)([CP])\s+(?:AT\s+)?\$?(\d+(?:\.\d+)?)"
    
    # Process buy actions
    for match in re.finditer(buy_pattern, text_upper):
        absolute_qty = match.group(1)
        percentage_qty = match.group(2)
        ticker = match.group(3)
        strike = float(match.group(4))
        option_type = "CALL" if match.group(5) == "C" else "PUT"
        price = float(match.group(6)) if match.group(6) else None
        
        # Determine quantity
        if percentage_qty:
            quantity = f"{percentage_qty}%"
            is_percentage = True
        elif absolute_qty:
            quantity = int(float(absolute_qty))
            is_percentage = False
        else:
            quantity = 1
            is_percentage = False
        
        if price is not None:  # Only add if we have a price
            actions.append({
                "action": "BUY",
                "ticker": ticker,
                "strike": strike,
                "option_type": option_type,
                "expiration": expiration,
                "quantity": quantity,
                "price": price,
                "is_percentage": is_percentage
            })
    
    # Process sell actions
    for match in re.finditer(sell_pattern, text_upper):
        absolute_qty = match.group(1)
        percentage_qty = match.group(2)
        ticker = match.group(3)
        strike = float(match.group(4))
        option_type = "CALL" if match.group(5) == "C" else "PUT"
        price = float(match.group(6)) if match.group(6) else None
        
        # Determine quantity
        if percentage_qty:
            quantity = f"{percentage_qty}%"
            is_percentage = True
        elif absolute_qty:
            quantity = int(float(absolute_qty))
            is_percentage = False
        else:
            quantity = 1
            is_percentage = False
        
        if price is not None:  # Only add if we have a price
            actions.append({
                "action": "SELL",
                "ticker": ticker,
                "strike": strike,
                "option_type": option_type,
                "expiration": expiration,
                "quantity": quantity,
                "price": price,
                "is_percentage": is_percentage
            })
    
    return {
        "actions": actions,
        "raw_message": text
    }
