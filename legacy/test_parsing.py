"""
Test script for trade message parsing.
"""
import asyncio
from parsing.trade_parser import parse_trade_message

# Test messages
test_messages = [
    "Bought IWM 250P at 1.50 Exp: 02/20/2026",
    "Bought SPX 6940C at 4.80",
    "Sold 50% SPX 6950C at 6.50",
    "Sold 70% SPX 6950C at 8 Looks ready for 6950 Test",
    "Bought 5 SPX 6940C at 4.80",
]

print("Testing Trade Message Parsing\n" + "=" * 50)

for msg in test_messages:
    print(f"\nMessage: {msg}")
    result = parse_trade_message(msg)
    print(f"Parsed Actions: {len(result['actions'])}")
    for i, action in enumerate(result['actions'], 1):
        print(f"  Action {i}:")
        print(f"    - Action: {action['action']}")
        print(f"    - Ticker: {action['ticker']}")
        print(f"    - Strike: {action['strike']}")
        print(f"    - Type: {action['option_type']}")
        print(f"    - Expiration: {action.get('expiration', 'Not specified')}")
        print(f"    - Quantity: {action['quantity']} ({'percentage' if action['is_percentage'] else 'absolute'})")
        print(f"    - Price: ${action['price']}")

print("\n" + "=" * 50)
print("Parsing test complete!")
