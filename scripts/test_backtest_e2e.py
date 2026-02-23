#!/usr/bin/env python3
"""
E2E backtest script for manual verification with real Discord.

Reads DISCORD_TOKEN, CHANNEL_ID, START_DATE, END_DATE from env.
Fetches channel history, parses messages, runs backtest, prints summary.

Usage:
  export DISCORD_TOKEN="your-user-or-bot-token"
  export CHANNEL_ID="123456789012345678"
  export START_DATE="2025-01-01T00:00:00Z"
  export END_DATE="2025-01-31T23:59:59Z"
  export AUTH_TYPE="user_token"  # or "bot"
  python3 scripts/test_backtest_e2e.py
"""

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from shared.backtest.discord_fetcher import fetch_channel_history
from shared.backtest.engine import run_backtest
from services.trade_parser.src.parser import parse_trade_message


def main() -> None:
    token = os.environ.get("DISCORD_TOKEN")
    channel_id_str = os.environ.get("CHANNEL_ID")
    start_str = os.environ.get("START_DATE", "2025-01-01T00:00:00Z")
    end_str = os.environ.get("END_DATE", "2025-01-31T23:59:59Z")
    auth_type = os.environ.get("AUTH_TYPE", "user_token")

    if not token or not channel_id_str:
        print("Error: DISCORD_TOKEN and CHANNEL_ID are required.")
        print("Usage:")
        print("  export DISCORD_TOKEN=<your-token>")
        print("  export CHANNEL_ID=<channel-id>")
        print("  export START_DATE=2025-01-01T00:00:00Z  # optional")
        print("  export END_DATE=2025-01-31T23:59:59Z   # optional")
        print("  export AUTH_TYPE=user_token            # or 'bot'")
        sys.exit(1)

    try:
        channel_id = int(channel_id_str.strip())
    except ValueError:
        print(f"Error: CHANNEL_ID must be an integer, got {channel_id_str!r}")
        sys.exit(1)

    start_dt = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
    end_dt = datetime.fromisoformat(end_str.replace("Z", "+00:00"))

    if start_dt >= end_dt:
        print("Error: START_DATE must be before END_DATE")
        sys.exit(1)

    print("Fetching Discord channel history...")
    print(f"  Channel: {channel_id}")
    print(f"  Range: {start_str} to {end_str}")
    print(f"  Auth: {auth_type}")
    print()

    try:
        messages = fetch_channel_history(
            channel_id=channel_id,
            after=start_dt,
            before=end_dt,
            token=token,
            auth_type=auth_type,
        )
    except Exception as e:
        print(f"Discord fetch failed: {e}")
        sys.exit(1)

    print(f"Fetched {len(messages)} messages.")
    if not messages:
        print("No messages in range. Exiting.")
        sys.exit(0)

    # Parse each message (for logging)
    parsed_count = 0
    for m in messages[:5]:
        content = m.get("content", "").strip()
        if content:
            result = parse_trade_message(content)
            if result.get("actions"):
                parsed_count += 1
                print(f"  Sample: {content[:60]}... -> {len(result['actions'])} action(s)")
    if len(messages) > 5:
        print(f"  ... and {len(messages) - 5} more")

    print()
    print("Running backtest...")
    trade_dicts, summary = run_backtest(messages)

    print()
    print("=== Backtest Summary ===")
    for k, v in summary.items():
        print(f"  {k}: {v}")

    print()
    print(f"=== Trades ({len(trade_dicts)}) ===")
    for i, t in enumerate(trade_dicts[:10]):
        print(f"  {i + 1}. {t['ticker']} {t['strike']}{t['option_type'][0]} "
              f"{t['action']} @ {t['entry_price']} -> {t.get('exit_price')} "
              f"PnL={t.get('realized_pnl')} {t.get('exit_reason', '')}")
    if len(trade_dicts) > 10:
        print(f"  ... and {len(trade_dicts) - 10} more")

    print()
    print("Done.")


if __name__ == "__main__":
    main()
