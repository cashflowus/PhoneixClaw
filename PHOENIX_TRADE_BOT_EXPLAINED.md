# Phoenix Trade Bot — Complete Project Guide

---

## 1. Executive Summary

**Phoenix Trade Bot** is an enterprise-grade, multi-tenant trading platform that automates the entire lifecycle of options trading — from signal ingestion to trade execution to position monitoring.

### The Problem It Solves

Options traders subscribe to Discord servers where analysts post real-time trade signals like:

> "Bought AAPL 190C at 2.50 Exp: 03/21/2026"

Manually copying these signals into a brokerage account is:

- **Slow** — by the time you type the order, the price has moved
- **Error-prone** — mistyping a strike price or expiration costs money
- **Unscalable** — you can only watch one channel at a time

Phoenix Trade Bot solves this by:

1. **Listening** to Discord channels in real time
2. **Parsing** trade signals automatically using regex pattern matching
3. **Executing** trades on your brokerage account (Alpaca) with configurable buffer pricing
4. **Monitoring** open positions and automatically closing them at profit targets or stop losses
5. **Notifying** you of every action taken

### Who It's For

- Individual traders who follow Discord-based trade signal services
- Trading groups who want to automate signal distribution to members
- Developers building agentic trading platforms with ML models

---

## 2. High-Level Architecture

The platform consists of **13 microservices** communicating through **Apache Kafka**, with **PostgreSQL** for persistence and **Redis** for caching. A **React** dashboard provides the user interface.

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACES                          │
│                                                                 │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│   │  Dashboard UI │    │  Chat Widget │    │   Discord     │     │
│   │  (React)      │    │  (React)     │    │   Commands    │     │
│   └──────┬───────┘    └──────┬───────┘    └──────────────┘     │
│          │                   │                                   │
│          ▼                   ▼                                   │
│   ┌─────────────────────────────────┐                           │
│   │         API Gateway             │                           │
│   │    (FastAPI, port 8011)         │                           │
│   │  JWT Auth │ REST API │ Kafka    │                           │
│   └─────────────┬───────────────────┘                           │
│                 │                                                │
├─────────────────┼────────────────────────────────────────────────┤
│                 │          BACKEND SERVICES                      │
│                 │                                                │
│  ┌──────────┐  │  ┌────────────────┐   ┌───────────────────┐   │
│  │  Auth    │◄─┘  │  Source        │──►│ Discord Ingestor  │   │
│  │ Service  │     │  Orchestrator  │   │ (per-user workers)│   │
│  └──────────┘     └────────────────┘   └────────┬──────────┘   │
│                                                  │              │
│                                                  ▼              │
│   ┌──────────────────── KAFKA ──────────────────────────────┐   │
│   │                                                         │   │
│   │  raw-messages ──► Trade Parser ──► parsed-trades        │   │
│   │                                        │                │   │
│   │                              Trade Gateway              │   │
│   │                                        │                │   │
│   │                               approved-trades           │   │
│   │                                        │                │   │
│   │                              Trade Executor             │   │
│   │                                        │                │   │
│   │                             execution-results           │   │
│   │                                   │    │                │   │
│   │                    Position Monitor    Notification Svc │   │
│   │                          │                              │   │
│   │                     exit-signals                        │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   ┌──────────┐    ┌──────────┐    ┌──────────────┐             │
│   │  Audit   │    │  Signal  │    │  Notification│             │
│   │  Writer  │    │  Scorer  │    │  Service     │             │
│   └──────────┘    └──────────┘    └──────────────┘             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                      INFRASTRUCTURE                             │
│                                                                 │
│   ┌──────────┐    ┌──────────────┐    ┌──────────┐             │
│   │  Kafka   │    │  PostgreSQL  │    │  Redis   │             │
│   │  (KRaft) │    │     16       │    │   7      │             │
│   └──────────┘    └──────────────┘    └──────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend | Python 3.13, FastAPI | Microservice framework, async REST APIs |
| Message Queue | Apache Kafka (KRaft) | Event streaming between services |
| Database | PostgreSQL 16 | Primary data store (trades, users, positions) |
| Cache | Redis 7 | JWT blocklist, dedup, rate limiting |
| Frontend | React 18, TypeScript, shadcn/ui | Dashboard with dark mode |
| Styling | Tailwind CSS | Utility-first CSS framework |
| Serialization | msgpack | Binary Kafka message format (faster than JSON) |
| Auth | JWT (HS256), bcrypt | Token-based authentication |
| Encryption | Fernet | Encrypts broker API keys at rest |
| Broker API | Alpaca | Options trading execution |
| Container | Docker, Docker Compose | Local development and deployment |
| Orchestration | Kubernetes | Production deployment |
| CI/CD | GitHub Actions | Lint, test, build Docker images |

---

## 3. Component-by-Component Breakdown

### 3.1 Auth Service

**Purpose:** Handles user registration, login, and JWT token management.

**Port:** 8001

**Key Files:**
- `services/auth-service/src/auth.py` — Registration, login, token endpoints

**How It Works:**

1. **Register:** User sends email + password. Password is hashed with bcrypt. A new `User` row is created. Access + refresh tokens are returned.
2. **Login:** Email + password verified against bcrypt hash. New JWT tokens issued.
3. **Token Refresh:** Client sends expired access token's refresh token to get a new pair.
4. **Token Structure:**
   ```json
   {
     "sub": "user-uuid-here",
     "type": "access",
     "exp": 1740000000
   }
   ```

**Access token lifetime:** 30 minutes. **Refresh token:** 7 days.

---

### 3.2 API Gateway

**Purpose:** Central REST API entry point. All dashboard and chat requests flow through here. Enforces JWT authentication on every request.

**Port:** 8011

**Key Files:**
- `services/api-gateway/main.py` — FastAPI app, route registration, Kafka producer init
- `services/api-gateway/src/middleware.py` — JWT validation middleware
- `services/api-gateway/src/routes/` — Route handlers for accounts, sources, trades, chat, etc.

**Routes Registered:**

| Route Prefix | Purpose |
|---|---|
| `/auth/*` | Login, register, refresh (public) |
| `/api/v1/accounts` | CRUD for trading accounts |
| `/api/v1/sources` | CRUD for data sources (Discord, Twitter) |
| `/api/v1/mappings` | Map channels to trading accounts |
| `/api/v1/trades` | Query trade history |
| `/api/v1/metrics/daily` | Daily P&L metrics |
| `/api/v1/notifications` | Notification log |
| `/api/v1/system/health` | Service health status |
| `/api/v1/chat/send` | Send a trade signal via chat |
| `/api/v1/chat/history` | Retrieve chat message history |

**JWT Middleware Flow:**
```
Request arrives
    │
    ▼
Is path public? (/health, /auth/login, /auth/register)
    │
  Yes ──► Pass through
    │
   No ──► Extract "Bearer <token>" from Authorization header
             │
             ▼
          Decode JWT with HS256
             │
             ▼
          Verify type == "access" and not expired
             │
             ▼
          Set request.state.user_id = token.sub
             │
             ▼
          Continue to route handler
```

---

### 3.3 Source Orchestrator

**Purpose:** Control-plane service that watches the `data_sources` table and spawns/stops per-user ingestor worker processes.

**Port:** 8003

**How It Works:**

1. Periodically polls the `data_sources` table for enabled sources
2. For each source, spawns a dedicated ingestor worker (e.g., `DiscordIngestor`)
3. Each worker is isolated per-user so one user's connection issues don't affect others
4. Tracks running workers in Redis (`workers:{source_id}`)
5. Stops workers when sources are disabled or deleted

---

### 3.4 Discord Ingestor

**Purpose:** Connects to Discord and publishes messages to the `raw-messages` Kafka topic in real time.

**Key Files:**
- `services/discord-ingestor/src/connector.py` — `DiscordIngestor` class

**Two Authentication Modes:**

| Mode | Library | Use Case |
|------|---------|----------|
| `user_token` | discord.py-self | You're a regular member of the server (no admin needed) |
| `bot` | discord.py | You have a bot token and server admin has invited it |

**Message Processing Flow:**

```
Discord WebSocket event received
    │
    ▼
Ignore if message is from self
    │
    ▼
Ignore if channel not in target_channels list
    │
    ▼
Ignore if message is empty
    │
    ▼
Dedup check (message ID cache, max 10,000 entries)
    │
    ▼
Build raw_msg payload:
  {
    "content": "Bought AAPL 190C at 2.50",
    "message_id": "1234567890",
    "author": "TraderJoe#1234",
    "channel_name": "options-alerts",
    "channel_id": "9876543210",
    "user_id": "abc-def-ghi",
    "source": "discord",
    "timestamp": "2026-02-20T14:30:00Z"
  }
    │
    ▼
Publish to Kafka topic "raw-messages"
  - key: message_id
  - headers: [user_id, channel_id]
  - serialization: msgpack
```

---

### 3.5 Trade Parser

**Purpose:** Consumes raw messages from Kafka, extracts structured trade signals using regex, and publishes parsed trades.

**Port:** 8006

**Key Files:**
- `services/trade-parser/src/parser.py` — Regex pattern matching
- `services/trade-parser/src/service.py` — Kafka consumer/producer loop

**Supported Message Formats:**

| Example Message | Parsed Output |
|-----------------|---------------|
| `Bought AAPL 190C at 2.50` | BUY AAPL 190 CALL @ $2.50 |
| `Sold 50% SPX 6950C at 6.50` | SELL 50% SPX 6950 CALL @ $6.50 |
| `Buy 3 IWM 250P at 1.50 Exp: 02/20/2026` | BUY 3x IWM 250 PUT @ $1.50 exp 2026-02-20 |
| `Sold TSLA 250C at 5.00` | SELL TSLA 250 CALL @ $5.00 |

**Regex Patterns (simplified):**

```
BUY pattern:
  (BOUGHT|BUY) [quantity]? TICKER STRIKE(C|P) [AT] PRICE

SELL pattern:
  (SOLD|SELL) [quantity]? TICKER STRIKE(C|P) [AT] PRICE
```

The parser extracts:
- **Action:** BUY or SELL
- **Ticker:** Stock symbol (1-5 uppercase letters)
- **Strike:** Numeric strike price
- **Option Type:** C = CALL, P = PUT
- **Price:** Execution price
- **Quantity:** Absolute number, percentage, or default 1
- **Expiration:** Optional date in MM/DD/YYYY format

---

### 3.6 Trade Gateway

**Purpose:** Approval engine that decides whether a parsed trade should be executed.

**Port:** 8007

**Key Files:**
- `services/trade-gateway/src/gateway.py` — Auto/manual approval logic
- `services/trade-gateway/src/manual_mode.py` — Manual approval with timeout

**Two Approval Modes:**

| Mode | Behavior |
|------|----------|
| `auto` | Immediately approves and forwards to execution |
| `manual` | Holds the trade for 300 seconds awaiting approval via Discord command or API |

**Auto Mode Flow:**
```
parsed-trades (Kafka)
    │
    ▼
Set status = "APPROVED"
Set approved_by = "auto"
Set approved_at = now()
    │
    ▼
Publish to approved-trades (Kafka)
  headers: [user_id, trading_account_id]
```

---

### 3.7 Trade Executor

**Purpose:** Executes approved trades on the broker API with buffer pricing and risk validation.

**Port:** 8008

**Key Files:**
- `services/trade-executor/src/executor.py` — Execution orchestration
- `services/trade-executor/src/buffer.py` — Buffer price calculation
- `services/trade-executor/src/validator.py` — Pre-execution validation

**Buffer Pricing Explained:**

Options prices move fast. If the signal says $2.50, by the time the order reaches the exchange, the price may be $2.60. Buffer pricing adds a cushion to ensure fills:

| Side | Formula | Example |
|------|---------|---------|
| BUY | price + (price × buffer%) | $2.50 + ($2.50 × 15%) = **$2.88** |
| SELL | price - (price × buffer%) | $5.00 - ($5.00 × 15%) = **$4.25** |

Configuration:
- **Default buffer:** 15%
- **Max buffer:** 30%
- **Min price floor:** $0.01
- **Per-ticker overrides** supported via JSON config

**Risk Validation Checks:**
1. Trading must be enabled for the account
2. Ticker must not be on the blacklist
3. All required fields (ticker, strike, price) must be present
4. Quantity must not exceed max position size
5. Price must be greater than zero

**Execution Flow:**
```
approved-trades (Kafka)
    │
    ▼
Idempotency check (Redis: have we seen this trade_id?)
    │
    ▼
Validate trade (TradeValidator)
    │
    ▼
Calculate buffered price
    │
    ▼
Format OCC option symbol: "AAPL260321C00190000"
    │
    ▼
Call Alpaca API: POST /v2/orders
  {
    "symbol": "AAPL260321C00190000",
    "qty": "1",
    "side": "buy",
    "type": "limit",
    "limit_price": "2.88",
    "time_in_force": "day"
  }
    │
    ▼
Record execution in DB (status = EXECUTED)
Create Position record (status = OPEN)
    │
    ▼
Publish to execution-results (Kafka)
```

---

### 3.8 Position Monitor

**Purpose:** Continuously monitors open positions and triggers automatic exits when profit targets or stop losses are hit.

**Port:** 8009

**Key Files:**
- `services/position-monitor/src/monitor.py` — Position polling loop
- `services/position-monitor/src/exit_engine.py` — Exit condition evaluation
- `services/position-monitor/src/daily_aggregator.py` — Daily metrics rollup

**Three Exit Conditions:**

| Condition | Default | Formula | Trigger |
|-----------|---------|---------|---------|
| Profit Target | 30% | (current - entry) / entry >= 30% | Close for profit |
| Stop Loss | 20% | (entry - current) / entry >= 20% | Close to limit losses |
| Trailing Stop | 10% offset | (high_water_mark - current) / high_water_mark >= 10% | Close on pullback from peak |

**Monitoring Loop:**
```
Every N seconds:
    │
    ▼
Query all OPEN positions from DB
    │
    ▼
For each position, fetch current quote from broker
    │
    ▼
Update high water mark if current > previous high
    │
    ▼
Evaluate exit conditions:
  1. Check profit target  → TAKE_PROFIT
  2. Check stop loss      → STOP_LOSS
  3. Check trailing stop  → TRAILING_STOP
    │
    ▼
If exit triggered:
  Publish ExitSignal to exit-signals (Kafka)
  → Trade Executor closes the position
```

---

### 3.9 Notification Service

**Purpose:** Sends notifications to users about trade events via multiple channels.

**Port:** 8010

**Notification Channels:**
- Discord webhooks
- Email
- HTTP webhooks

**Events That Trigger Notifications:**
- Trade executed
- Trade rejected (with reason)
- Trade errored
- Position closed (profit/loss)
- System health alerts

---

### 3.10 Audit Writer

**Purpose:** Persists trade events to the `trade_events` table for compliance and debugging. Runs off the hot path so it doesn't slow down trade execution.

**How It Works:**
- Consumes from `trade-events-raw` Kafka topic
- Writes `TradeEvent` records to PostgreSQL
- Each event includes: user_id, trade_id, event_type, event_data (JSONB), source_service, timestamp

---

### 3.11 Signal Scorer

**Purpose:** ML-based plugin that scores signal quality. Extensible architecture for future AI models.

**Plugin Protocol:**
```python
class SignalScoringAgent(Protocol):
    async def score_signal(self, signal: dict) -> float:
        """Return confidence score 0.0 to 1.0"""
```

The current implementation (`SimpleSignalScorer`) evaluates:
- Analyst track record (historical win rate)
- Signal clarity (how well-formed the message is)
- Market conditions (time of day, volatility)

---

### 3.12 Dashboard UI

**Purpose:** React web application for monitoring and configuring the trading platform.

**Technology:** React 18 + TypeScript + shadcn/ui + Tailwind CSS + Recharts

**7 Pages:**

| Page | Route | Purpose |
|------|-------|---------|
| Login | `/login` | Email/password authentication |
| Register | `/register` | New account creation |
| Dashboard | `/` | KPI cards, P&L chart, recent trades table |
| Data Sources | `/sources` | Connect Discord/Twitter/Reddit sources |
| Trading Accounts | `/accounts` | Manage broker connections (Alpaca, IB) |
| Analytics | `/analytics` | Cumulative P&L, win rate trends |
| System | `/system` | Service health, notifications |

**Chat Widget:**
A floating ChatGPT-style widget (bottom-right corner) that lets users type trade signals directly. Messages are published to the same Kafka `raw-messages` topic as Discord messages, so they flow through the entire pipeline identically.

**Design System:**
- **Dark mode** by default (trading dashboards are easier to read in dark)
- **Light mode** toggle available
- **Collapsible sidebar** (icons-only mode for more screen space)
- **Mobile-responsive** with slide-out sheet navigation
- **shadcn/ui** components: Card, Table, Badge, Dialog, Select, Switch, Button, Input, etc.

---

### 3.13 Shared Libraries

**Purpose:** Common code used by all services.

| Module | Purpose |
|--------|---------|
| `shared/models/trade.py` | SQLAlchemy ORM models (12 tables) |
| `shared/models/database.py` | Async database engine and session factory |
| `shared/kafka_utils/producer.py` | Async Kafka producer (msgpack serialization) |
| `shared/kafka_utils/consumer.py` | Async Kafka consumer with manual commit |
| `shared/broker/adapter.py` | `BrokerAdapter` protocol (interface) |
| `shared/broker/alpaca_adapter.py` | Alpaca API implementation |
| `shared/config/base_config.py` | Centralized config from environment variables |
| `shared/crypto/credentials.py` | Fernet encryption for API keys |
| `shared/graceful_shutdown.py` | SIGTERM handler for clean shutdown |
| `shared/error_codes.py` | Structured error code system |
| `shared/rate_limiter.py` | Redis sliding-window rate limiter |
| `shared/models/tenant.py` | Multi-tenant query utilities |

---

## 4. Database Schema

The platform uses **12 tables** in PostgreSQL. Here are the key entities and their relationships:

```
┌──────────┐
│  users   │
│──────────│
│ id (PK)  │
│ email    │
│ password │
│ name     │
└────┬─────┘
     │ 1:N
     ├──────────────────────┬───────────────────────┐
     ▼                      ▼                       ▼
┌──────────────┐    ┌──────────────┐    ┌───────────────────┐
│trading_      │    │data_sources  │    │ chat_messages      │
│accounts      │    │──────────────│    │───────────────────│
│──────────────│    │ id (PK)      │    │ id (PK)           │
│ id (PK)      │    │ user_id (FK) │    │ user_id (FK)      │
│ user_id (FK) │    │ source_type  │    │ content           │
│ broker_type  │    │ auth_type    │    │ role (user/system) │
│ paper_mode   │    │ credentials  │    │ trade_id (FK)     │
│ risk_config  │    │ enabled      │    └───────────────────┘
│ credentials  │    └──────┬───────┘
└──────┬───────┘           │ 1:N
       │                   ▼
       │            ┌──────────────┐
       │            │  channels    │
       │            │──────────────│
       │            │ id (PK)      │
       │            │ source_id(FK)│
       │            │ channel_id   │
       │            └──────┬───────┘
       │                   │
       │    ┌──────────────┘
       │    │  N:M (via mapping)
       ▼    ▼
┌──────────────────────┐
│account_source_mapping│
│──────────────────────│
│ trading_account_id   │
│ channel_id           │
│ config_overrides     │
└──────────────────────┘
       │
       ▼ (trades reference both)
┌───────────────────────┐       ┌───────────────────────┐
│  trades               │       │  positions            │
│───────────────────────│       │───────────────────────│
│ trade_id (UUID)       │       │ id (PK)               │
│ user_id (FK)          │       │ user_id (FK)          │
│ trading_account_id    │       │ trading_account_id    │
│ ticker, strike        │       │ ticker, strike        │
│ action (BUY/SELL)     │       │ quantity              │
│ price, buffered_price │       │ avg_entry_price       │
│ status (lifecycle)    │       │ profit_target (30%)   │
│ profit_target (30%)   │       │ stop_loss (20%)       │
│ stop_loss (20%)       │       │ high_water_mark       │
│ realized_pnl          │       │ status (OPEN/CLOSED)  │
│ execution_latency_ms  │       │ realized_pnl          │
└───────────────────────┘       └───────────────────────┘
```

**Additional Tables:**
- `trade_events` — Full audit log of every trade lifecycle event
- `daily_metrics` — Aggregated daily stats per trading account
- `analyst_performance` — Win rates and P&L per signal source author
- `configurations` — Per-user key-value settings
- `notification_log` — History of all notifications sent

---

## 5. Kafka Event Pipeline

All inter-service communication flows through 5 Kafka topics. Messages are serialized with **msgpack** (binary, faster than JSON) and carry **user_id** in headers for tenant routing.

### Topic Map

| Topic | Producer | Consumer | Partition Key |
|-------|----------|----------|---------------|
| `raw-messages` | Discord Ingestor, Chat API | Trade Parser | message_id |
| `parsed-trades` | Trade Parser | Trade Gateway | ticker |
| `approved-trades` | Trade Gateway | Trade Executor | ticker |
| `execution-results` | Trade Executor | Position Monitor, Notification Svc | trade_id |
| `exit-signals` | Position Monitor | Trade Executor | position_id |

### Message Flow

```
Discord ──┐
           ├──► raw-messages ──► Trade Parser ──► parsed-trades
Chat ─────┘                                           │
                                                      ▼
                                                Trade Gateway
                                                      │
                                                      ▼
                                               approved-trades
                                                      │
                                                      ▼
                                               Trade Executor ──► Alpaca API
                                                      │
                                                      ▼
                                             execution-results
                                                 │         │
                                                 ▼         ▼
                                         Position     Notification
                                         Monitor      Service
                                            │
                                            ▼
                                       exit-signals ──► Trade Executor (close)
```

### Example Kafka Message (raw-messages)

```python
# Headers
[("user_id", b"550e8400-e29b-41d4-a716-446655440000"),
 ("channel_id", b"1234567890")]

# Value (msgpack-encoded dict)
{
    "content": "Bought AAPL 190C at 2.50 Exp: 03/21/2026",
    "message_id": "1234567890123",
    "author": "TraderJoe#1234",
    "channel_name": "options-alerts",
    "channel_id": "1234567890",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "source": "discord",
    "timestamp": "2026-02-20T14:30:00.000Z"
}
```

---

## 6. End-to-End Worked Example: Discord Signal

Let's trace a complete trade from a Discord message to position monitoring.

### Scenario

A Discord analyst posts in the `#options-alerts` channel:

> **TraderJoe:** Bought AAPL 190C at 2.50 Exp: 03/21/2026

You (User ID: `abc-123`) have configured:
- A Discord data source connected to this channel
- An Alpaca paper trading account
- Auto-approval mode
- 15% buffer pricing
- 30% profit target, 20% stop loss

---

### Step 1: Discord Ingestor Captures the Message

The `DiscordIngestor` worker for your account is listening via WebSocket. When the message arrives:

1. **Filter:** Channel ID `1234567890` is in your `target_channels` list — passes
2. **Dedup:** Message ID `999888777` is not in the cache — passes
3. **Publish:** Sends to Kafka `raw-messages` topic

```python
# Published to Kafka
topic: "raw-messages"
key: "999888777"
headers: [("user_id", b"abc-123"), ("channel_id", b"1234567890")]
value: {
    "content": "Bought AAPL 190C at 2.50 Exp: 03/21/2026",
    "message_id": "999888777",
    "author": "TraderJoe#1234",
    "channel_id": "1234567890",
    "user_id": "abc-123",
    "source": "discord",
    "timestamp": "2026-02-20T14:30:00Z"
}
```

**Latency:** ~5ms (fire-and-forget Kafka publish)

---

### Step 2: Trade Parser Extracts the Signal

The Trade Parser consumes the message and runs regex matching:

**Input:** `"Bought AAPL 190C at 2.50 Exp: 03/21/2026"`

**Regex Match (BUY pattern):**
```
BOUGHT [no qty] AAPL 190C AT 2.50
  │       │      │    │ │     │
  action  qty=1  ticker strike C=CALL price
```

**Expiration extracted:** `03/21/2026` → `2026-03-21`

**Output (published to `parsed-trades`):**
```python
{
    "trade_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "user_id": "abc-123",
    "channel_id": "1234567890",
    "action": "BUY",
    "ticker": "AAPL",
    "strike": 190.0,
    "option_type": "CALL",
    "expiration": "2026-03-21",
    "quantity": 1,
    "price": 2.50,
    "is_percentage": false,
    "source": "discord",
    "source_author": "TraderJoe#1234",
    "raw_message": "Bought AAPL 190C at 2.50 Exp: 03/21/2026"
}
```

**Latency:** ~10ms (regex parsing + Kafka publish)

---

### Step 3: Trade Gateway Approves

Since auto-approval is enabled, the gateway immediately:

1. Sets `status = "APPROVED"`
2. Sets `approved_by = "auto"`
3. Sets `approved_at = "2026-02-20T14:30:00.015Z"`
4. Publishes to `approved-trades` with header `trading_account_id`

**Latency:** ~5ms

---

### Step 4: Trade Executor Places the Order

**4a. Idempotency Check:**
Redis key `dedup:f47ac10b-58cc-...` does not exist. Proceed.

**4b. Validation:**
- Trading enabled: YES
- Ticker blacklisted: NO
- Quantity (1) <= max position size (10): YES
- Price ($2.50) > 0: YES

**4c. Buffer Price Calculation:**
```
Side:    BUY
Price:   $2.50
Buffer:  15%
Formula: $2.50 + ($2.50 × 0.15) = $2.50 + $0.375 = $2.875
Rounded: $2.88
```

The limit order is set at **$2.88** — you're willing to pay up to $2.88 to ensure the order fills, even if the price has moved from $2.50.

**4d. Format OCC Option Symbol:**
```
Ticker:     AAPL
Expiration: 2026-03-21 → "260321"
Type:       CALL → "C"
Strike:     190.0 → "00190000"

OCC Symbol: AAPL260321C00190000
```

**4e. Place Order via Alpaca API:**
```
POST https://paper-api.alpaca.markets/v2/orders
{
    "symbol": "AAPL260321C00190000",
    "qty": "1",
    "side": "buy",
    "type": "limit",
    "limit_price": "2.88",
    "time_in_force": "day"
}

Response: { "id": "order-xyz-789", "status": "accepted" }
```

**4f. Database Updates:**
- `trades` table: status = "EXECUTED", broker_order_id = "order-xyz-789", buffered_price = 2.88
- `positions` table: new row with status = "OPEN", avg_entry_price = 2.50, profit_target = 0.30, stop_loss = 0.20

**4g. Publish to `execution-results`:**
```python
{
    "trade_id": "f47ac10b-...",
    "status": "EXECUTED",
    "broker_order_id": "order-xyz-789",
    "buffered_price": 2.88,
    "execution_latency_ms": 145
}
```

**Latency:** ~130-350ms (dominated by Alpaca API call)

---

### Step 5: Position Monitor Watches the Position

The position monitor runs a periodic loop. Let's say AAPL 190C price moves over time:

| Time | Current Price | P&L % | Action |
|------|--------------|-------|--------|
| 14:30 | $2.50 | 0% | Hold — no exit condition met |
| 14:45 | $2.70 | +8% | Hold — update high water mark to $2.70 |
| 15:00 | $3.00 | +20% | Hold — update high water mark to $3.00 |
| 15:15 | $3.25 | +30% | **TAKE_PROFIT triggered!** |

**At 15:15, the exit engine evaluates:**
```python
entry_price  = 2.50
current_price = 3.25
profit_target = 0.30  (30%)

pnl_pct = (3.25 - 2.50) / 2.50 = 0.30  (30%)

0.30 >= 0.30 → TRUE → TAKE_PROFIT
```

**Exit Signal published to `exit-signals`:**
```python
{
    "position_id": 42,
    "reason": "TAKE_PROFIT",
    "trigger_price": 3.25
}
```

The Trade Executor consumes this and places a **SELL** order to close the position. Your realized profit: **$0.75 per contract** (30% return).

---

### Total End-to-End Timeline

| Stage | Service | Time |
|-------|---------|------|
| Message captured | Discord Ingestor | 0ms |
| Published to Kafka | Discord Ingestor | 5ms |
| Parsed | Trade Parser | 15ms |
| Approved | Trade Gateway | 20ms |
| Validated + buffered | Trade Executor | 25ms |
| Order placed | Trade Executor → Alpaca | 170ms |
| Order confirmed | Trade Executor | 180ms |

**Total: ~180ms from Discord message to order placed on exchange.**

---

## 7. Chat-to-Trade Example

The Chat Widget provides an alternative signal source — instead of Discord, you type directly in the dashboard.

### Scenario

You type in the chat widget:

> BTO TSLA 250C 4/18 @ 5.00

### Flow

1. **Frontend** sends `POST /api/v1/chat/send` with `{ "message": "BTO TSLA 250C 4/18 @ 5.00" }`
2. **API Gateway** saves a `ChatMessage` row (role = "user") and publishes to `raw-messages` Kafka topic:
   ```python
   {
       "content": "BTO TSLA 250C 4/18 @ 5.00",
       "author": "abc-123",
       "source": "chat",
       "channel_id": "chat-widget",
       "timestamp": "2026-02-20T15:00:00Z"
   }
   ```
3. **API Gateway** saves a system reply: `"Signal received: 'BTO TSLA 250C 4/18 @ 5.00'. Routing to trade parser..."`
4. **Trade Parser** consumes and parses it exactly like a Discord message
5. The signal flows through Gateway → Executor → Broker as normal

The chat widget shows both the user message and the system confirmation in real time with auto-scroll.

---

## 8. Multi-Tenancy Model

Phoenix Trade Bot is multi-tenant — many users share the same infrastructure, but each user's data is completely isolated.

### Isolation at Every Layer

| Layer | Mechanism | How |
|-------|-----------|-----|
| **Database** | Row-level isolation | Every table has a `user_id` column. All queries include `WHERE user_id = ?` |
| **API** | JWT middleware | Token contains `sub: user_id`. Set on every request as `request.state.user_id` |
| **Kafka** | Message headers | Every Kafka message carries `user_id` in headers. Consumers filter by user |
| **Redis** | Key prefixing | Keys formatted as `user:{user_id}:key_name` |
| **Workers** | Process isolation | Each user gets their own Discord ingestor worker process |
| **Credentials** | Per-row encryption | Each user's broker API keys are encrypted separately with Fernet |

### Example: Two Users, Same Infrastructure

```
User A (abc-123)                    User B (def-456)
    │                                   │
    ▼                                   ▼
Discord Ingestor Worker A          Discord Ingestor Worker B
    │                                   │
    ▼                                   ▼
Kafka: raw-messages                Kafka: raw-messages
  header: user_id=abc-123            header: user_id=def-456
    │                                   │
    ▼                                   ▼
Trade Parser (processes both, tags each with user_id)
    │                                   │
    ▼                                   ▼
DB: trades WHERE user_id=abc-123   DB: trades WHERE user_id=def-456
    │                                   │
    ▼                                   ▼
Alpaca Account A (paper)           Alpaca Account B (live)
```

User A cannot see User B's trades, accounts, or settings. The isolation is enforced at the ORM level, so even a coding mistake in a route handler won't leak data.

---

## 9. Frontend Dashboard

### Technology Stack

| Component | Purpose |
|-----------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| shadcn/ui | Component library (Card, Table, Dialog, Badge, etc.) |
| Tailwind CSS | Utility-first styling |
| Recharts | Charts (bar, line, area) |
| @tanstack/react-query | Server state management |
| axios | HTTP client |
| react-router-dom | Client-side routing |
| lucide-react | Icon library |

### Page Descriptions

**Login / Register:**
Centered card on a dark gradient background. Email + password form with loading states and error handling.

**Dashboard (Home):**
- 4 KPI cards: Total Trades, Executed, Rejected, Errors (with colored icons)
- Daily P&L bar chart (7 days, dark-aware Recharts)
- Recent trades table with status badges (Executed = green, Error = red, Rejected = amber)

**Data Sources:**
- Card grid showing connected sources (Discord, Twitter, Reddit)
- Dialog form for adding new sources with:
  - Platform selection (Discord/Twitter/Reddit)
  - Auth method toggle (User Token / Bot Token) for Discord
  - Token input and channel ID configuration
- Dropdown menu for deleting sources

**Trading Accounts:**
- Card grid with broker type and connection status
- Dialog form for adding accounts with:
  - Broker selection (Alpaca / Interactive Brokers)
  - Paper/Live toggle switch
  - API key and secret inputs
- Inline toggle switch for switching between paper and live mode

**Analytics:**
- Side-by-side chart cards: Cumulative P&L (area) and Win Rate Trend (line)
- Daily P&L breakdown chart
- All charts use theme-aware colors with gradient fills

**System:**
- Service health grid with status badges (healthy = green, unhealthy = red)
- Recent notifications list with timestamps

### Chat Widget

A floating ChatGPT-style panel that:
- Appears as a blue circle button at the bottom-right
- Expands to a 380×520px chat panel on click
- Shows message history with user (blue, right-aligned) and system (gray, left-aligned) bubbles
- Input field with Send button and Enter-to-send
- Auto-scrolls to latest messages
- Polls for updates every 5 seconds when open
- Only visible when authenticated

---

## 10. Deployment Options

### Option 1: Local Development (Docker Compose)

```bash
make setup        # Install deps, create .env, init DB
make up           # Build and start all 12 services + infra
make logs         # Tail logs
make status       # Check running containers
make down         # Stop everything
```

Infrastructure started: Kafka, PostgreSQL, Redis

### Option 2: Production via Coolify

Coolify is a self-hosted PaaS (like Heroku) that runs on your VPS.

**Setup:**
1. Push code to GitHub
2. Install Coolify on your Hostinger VPS
3. Create a new project using Docker Compose build pack
4. Point to `docker-compose.coolify.yml`
5. Set environment variables in Coolify UI
6. Deploy

**Key Production Features:**
- Environment variable substitution (`${POSTGRES_PASSWORD}`)
- Persistent volumes for PostgreSQL and Redis
- Resource limits (CPU and memory per service)
- Health checks on all services
- Traefik reverse proxy (built into Coolify) for HTTPS

### Option 3: Kubernetes

Full K8s manifests in `k8s/` directory:
- Namespace: `phoenixtrader`
- ConfigMap with service discovery URLs
- Secrets for JWT keys and encryption keys
- Deployments for each service
- HPA (Horizontal Pod Autoscaler) for trade-parser and trade-executor
- Ingress for external access

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/services/
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml
```

---

## 11. Development Workflow

### Testing

The project has **169 unit tests** covering all critical components:

```bash
make test         # Run all tests
make test-cov     # Run with coverage report
```

Test categories:
- Models and database operations
- Kafka producer/consumer
- Trade parser regex patterns
- Buffer pricing calculations
- Risk validation
- Exit engine (profit target, stop loss, trailing stop)
- JWT authentication and middleware
- Circuit breaker and retry logic
- Rate limiting
- Signal scorer

### Linting and Type Checking

```bash
make lint         # Run ruff linter
make typecheck    # Run mypy type checker
```

### CI/CD Pipeline (GitHub Actions)

On every push:
1. **Lint** — ruff checks code style
2. **Test** — pytest runs all 169 tests
3. **Build** — Docker images built for all services

### Key Makefile Commands

| Command | Purpose |
|---------|---------|
| `make setup` | First-time setup (install, env, DB init) |
| `make up` | Build and start everything |
| `make down` | Stop all services |
| `make test` | Run unit tests |
| `make lint` | Code style check |
| `make logs` | Tail all service logs |
| `make infra-up` | Start only Kafka, Postgres, Redis |
| `make db-init` | Initialize database tables |
| `make prod-up` | Start production (Coolify) stack |

---

## 12. Configuration Reference

All configuration is via environment variables with sensible defaults.

### Core Settings

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql+asyncpg://phoenixtrader:localdev@localhost:5432/phoenixtrader` | PostgreSQL connection |
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka broker address |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `JWT_SECRET_KEY` | `change-me-in-production` | JWT signing key |
| `CREDENTIAL_ENCRYPTION_KEY` | (generated) | Fernet key for encrypting broker credentials |

### Execution Settings

| Variable | Default | Purpose |
|----------|---------|---------|
| `BUFFER_PERCENTAGE` | `0.15` | Default buffer (15%) |
| `BUFFER_MAX_PERCENTAGE` | `0.30` | Max buffer cap (30%) |
| `BUFFER_MIN_PRICE` | `0.01` | Min buffer floor ($0.01) |
| `DEFAULT_PROFIT_TARGET` | `0.30` | Close at 30% profit |
| `DEFAULT_STOP_LOSS` | `0.20` | Close at 20% loss |
| `APPROVAL_MODE` | `auto` | auto or manual |

### Broker Settings

| Variable | Default | Purpose |
|----------|---------|---------|
| `ALPACA_API_KEY` | (none) | Alpaca API key |
| `ALPACA_SECRET_KEY` | (none) | Alpaca secret key |
| `ALPACA_PAPER` | `true` | Paper trading mode |

---

*This document covers the complete Phoenix Trade Bot architecture, every component, the data flow, and worked examples showing how trades flow from Discord signals to broker execution.*
