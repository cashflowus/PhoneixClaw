# Trading Bot - Microservices Architecture

A Discord trading bot that reads trading messages, parses them, and executes paper trades on Alpaca.

## Architecture

The bot follows a **microservices architecture** with two independent services:

1. **Message Parser Service**: Reads messages from Discord (extensible to WhatsApp/Reddit), parses trade information, and stores to trade queue
2. **Trade Execution Service**: Polls trade queue, validates trades, and executes on Alpaca paper trading platform

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

Edit `.env` file:
```
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_TARGET_CHANNELS=channel_id1,channel_id2
DB_URL=sqlite+aiosqlite:///tradingbot.db

# Alpaca API Configuration (Paper Trading)
ALPACA_API_KEY=your_alpaca_api_key
ALPACA_SECRET_KEY=your_alpaca_secret_key
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# Trade Queue Storage Type: "sql" or "csv"
TRADE_QUEUE_STORAGE_TYPE=sql
```

### 3. Get Alpaca API Keys

1. Sign up at https://alpaca.markets
2. Go to Paper Trading section
3. Generate API Key ID and Secret Key
4. Add them to `.env` file

### 4. Configure Safety Limits

Edit `config/settings.yaml` to set:
- `max_position_size`: Maximum contracts per position
- `max_daily_loss`: Maximum daily loss in dollars
- `default_contract_quantity`: Default quantity when not specified
- `enable_trading`: Master switch
- `dry_run_mode`: Set to `true` for testing without executing trades

## Running the Services

### Start Message Parser Service (Discord)

```bash
python services/run_message_parser.py
```

This service:
- Connects to Discord
- Listens to configured channels
- Parses trading messages
- Stores parsed trades to trade queue

### Start Trade Execution Service

```bash
python services/run_execution_service.py
```

This service:
- Polls trade queue for pending trades
- Validates trades (safety checks, position checks)
- Executes trades on Alpaca
- Updates position tracking

**Note**: Both services can run independently. Run them in separate terminals or as separate processes.

## Message Format Examples

The bot understands messages like:

- `Bought IWM 250P at 1.50 Exp: 02/20/2026`
- `Bought SPX 6940C at 4.80`
- `Sold 50% SPX 6950C at 6.50`
- `Sold 70% SPX 6950C at 8 Looks ready for 6950 Test`

## Trade Queue Storage

Trades are stored in either:
- **SQL Database** (default): Uses SQLite database (`tradingbot.db`)
- **CSV File**: Uses `data/trade_queue.csv`

Configure via `TRADE_QUEUE_STORAGE_TYPE` in `.env`.

## Adding New Input Sources

To add WhatsApp or Reddit:

1. Create new connector: `connectors/whatsapp_connector.py` or `connectors/reddit_connector.py`
2. Use `parse_and_store_message()` from `services.message_parser_service`
3. Set `source="whatsapp"` or `source="reddit"`
4. Execution service automatically processes trades from all sources

## Logs

- Message Parser Service: `logs/message_parser.log`
- Execution Service: `logs/execution_service.log`

## Safety Features

- Position size limits
- Daily loss limits
- Buying power checks
- Ticker blacklist
- Master kill switch (`enable_trading` flag)
- Dry-run mode for testing

## Testing

1. Set `dry_run_mode: true` in `config/settings.yaml`
2. Start both services
3. Send test messages to Discord channel
4. Check logs to see what would be executed
5. Once verified, set `dry_run_mode: false` and `enable_trading: true`
