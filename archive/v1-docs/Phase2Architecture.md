# Phase 2 - Architecture Document

## 1. System Overview

Phase 2 extends the existing PhoenixTrade microservices architecture with new services for sentiment analysis, news aggregation, AI-driven trade recommendation, option chain analysis, visual pipeline building, natural-language strategy backtesting, and a centralized Model Hub. The core principles remain: event-driven via Kafka, PostgreSQL for persistence, Docker-containerized, deployed on Coolify.

### Current vs Phase 2 Architecture

**Current (14 services):**

```
Discord → discord-ingestor → raw-messages → trade-parser → parsed-trades
  → trade-gateway → approved-trades → trade-executor → execution-results
  → position-monitor → exit-signals
```

**Phase 2 (21+ services):**

```
                                ┌─────────────┐
                                │  Ollama LLM  │ (shared by all AI services)
                                └──────┬───────┘
                                       │
Discord/Reddit/Twitter ─┬─→ [raw-messages] → trade-parser → (existing trade flow)
                        │
                        └─→ [raw-sentiment] → sentiment-analyzer ─┬→ DB + Redis
                                                                  └→ [sentiment-signals]
                                                                         │
News APIs ──→ news-aggregator ─┬→ [news-headlines] → DB                  │
                               └→ [news-signals] ──────────────────────┐ │
                                                                       │ │
                                               ┌───────────────────────┘ │
                                               ▼                         ▼
                                     ai-trade-recommender ◄─► option-chain-analyzer
                                               │                    ▲
                                               ▼                    │
                                     [parsed-trades] ───────►  (existing trade flow)
                                                                    │
                              strategy-agent ─► [notifications]     │
                                                                    │
                              Model Hub (registry) ◄── All AI services
```

---

## 2. New Microservices

### 2.1 Sentiment Analyzer Service

**Purpose:** Consumes messages from sentiment-designated channels, extracts tickers, classifies sentiment, aggregates scores, triggers alerts.

**Port:** 8021

**Kafka:**
- Consumes: `raw-sentiment-messages` (new topic)
- Produces: `sentiment-signals` (new topic, emitted per ticker when significant change occurs or on 30-min interval)
- Produces: `notifications` (when sentiment alert rules are triggered)

**Key components:**
- `TickerExtractor` -- regex + known-ticker-list validation (shared module)
- `SpamFilter` -- ignores bot messages, short messages (<5 chars), duplicate content within 1 min
- `SentimentClassifier` -- FinBERT model (shared module). Maps 3-class → 5-class via confidence thresholds
- `SentimentAggregator` -- rolling 30-min window per ticker per user, stores in DB + Redis cache
- `AlertEvaluator` -- checks user-defined alert rules against current sentiment state

**Dependencies:** PostgreSQL, Redis, Kafka, FinBERT model weights, shared ticker list

```
┌───────────────────────────────────────────────────────────────┐
│                    sentiment-analyzer                          │
│                                                                │
│  KafkaConsumer(raw-sentiment-messages)                         │
│         │                                                      │
│         ▼                                                      │
│  SpamFilter (bot check, length, dedup)                         │
│         │                                                      │
│    [PASS] ▼        [REJECT] → discard                          │
│                                                                │
│  TickerExtractor ─── shared/data/tickers.json                  │
│         │                                                      │
│    [NO TICKERS] → discard    [FOUND] ↓                         │
│                                                                │
│  SentimentClassifier (FinBERT, shared module)                  │
│    3-class → 5-class mapping                                   │
│         │                                                      │
│         ▼                                                      │
│  DB Write (sentiment_messages table)                           │
│         │                                                      │
│         ▼                                                      │
│  SentimentAggregator (30-min rolling window)                   │
│         │                                                      │
│         ├──► DB Write (ticker_sentiment table)                 │
│         ├──► Redis Cache (latest per ticker)                   │
│         ├──► KafkaProducer(sentiment-signals)                  │
│         └──► AlertEvaluator                                    │
│                   │                                            │
│                   └──► KafkaProducer(notifications) if matched │
└───────────────────────────────────────────────────────────────┘
```

### 2.2 News Aggregator Service

**Purpose:** Polls multiple news APIs on a schedule, normalizes headlines, extracts tickers, classifies sentiment, clusters same-story headlines, stores and serves trending news.

**Port:** 8022

**Kafka:**
- Produces: `news-headlines` (new topic, each new headline batch)
- Produces: `news-signals` (new topic, high-importance headlines that could trigger trades)

**Key components:**
- `SourceAdapters` -- pluggable adapters for each API (Finnhub, NewsAPI, AlphaVantage, Reddit, SeekingAlpha)
- `HeadlineNormalizer` -- deduplication via fuzzy matching (rapidfuzz, >85% similarity = same story)
- `StoryClusterer` -- groups related headlines, assigns cluster_id, picks primary headline
- `TickerTagger` -- same TickerExtractor logic (shared module)
- `SentimentScorer` -- FinBERT on headline text (shared module)
- `ImportanceRanker` -- composite score: `(source_count * 3) + recency_score + ticker_watchlist_bonus + sentiment_magnitude`
- `RetentionCleaner` -- hourly cron job deleting news > 48 hours old

**Schedule:** asyncio loop, polls each source every 10 minutes, staggered to avoid simultaneous API calls

```
┌──────────────────────────────────────────────────────────────────┐
│                      news-aggregator                              │
│                                                                   │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐ ┌─────────┐ │
│  │ Finnhub  │ │ NewsAPI  │ │ Reddit │ │ AlphaVant │ │ Seeking │ │
│  │ Adapter  │ │ Adapter  │ │Adapter │ │ Adapter   │ │ Alpha   │ │
│  └────┬─────┘ └────┬─────┘ └───┬────┘ └─────┬─────┘ └────┬────┘ │
│       └─────────────┼──────────┼─────────────┼────────────┘      │
│                     ▼          ▼             ▼                    │
│              HeadlineNormalizer + StoryClusterer                  │
│                            │                                     │
│                     ┌──────┼──────┐                               │
│                     ▼      ▼      ▼                               │
│              TickerTag  Sentiment  Importance                     │
│              (shared)   (shared)   Ranker                         │
│                     └──────┼──────┘                               │
│                            ▼                                     │
│                 DB Write (news_headlines)                         │
│                            │                                     │
│              ┌─────────────┼─────────────┐                       │
│              ▼                           ▼                       │
│   Kafka(news-headlines)       Kafka(news-signals)                │
│   (all headlines)             (importance > threshold only)       │
│                                                                   │
│  RetentionCleaner (hourly cron, delete > 48h)                    │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 AI Trade Recommender Service

**Purpose:** Receives sentiment/news signals, uses LLM reasoning + Unusual Whales data to decide whether to trade and what to trade. Logs all decisions for audit trail.

**Port:** 8023

**Kafka:**
- Consumes: `sentiment-signals`, `news-signals`
- Produces: `parsed-trades` (reuses existing topic to feed into trade-gateway)
- Produces: `notifications` (trade decision notifications)

**Key components:**
- `MarketHoursChecker` -- validates if market is open (shared module)
- `SignalInterpreter` -- LLM (Ollama) or rule-based logic to determine if signal warrants a trade
- `ConflictDetector` -- compares sentiment direction with UW options flow direction; flags discrepancies
- `UnusualWhalesClient` -- REST client for UW API (shared module)
- `ContractSelector` -- picks optimal contract via option-chain-analyzer service call
- `RiskAttacher` -- attaches stop-loss/take-profit to generated trades
- `TradeSignalBuilder` -- constructs structured trade message compatible with existing pipeline
- `DecisionLogger` -- logs every decision (trade or no-trade) with full reasoning chain to `ai_trade_decisions`

```
┌──────────────────────────────────────────────────────────────────┐
│                   ai-trade-recommender                            │
│                                                                   │
│  KafkaConsumer(sentiment-signals, news-signals)                   │
│         │                                                         │
│         ▼                                                         │
│  MarketHoursChecker (shared/market/calendar.py)                   │
│    [CLOSED] → queue or discard per config                         │
│    [OPEN] ↓                                                       │
│                                                                   │
│  Deduplication Check (Redis: ticker+direction, 30-min cooldown)   │
│    [DUPLICATE] → discard + log                                    │
│    [NEW] ↓                                                        │
│                                                                   │
│  SignalInterpreter (Ollama LLM)                                   │
│    "Is this signal strong enough to trade?"                        │
│    Input: signal data + user thresholds                            │
│         │                                                         │
│    [NO] → log decision + discard                                  │
│    [YES] ↓                                                        │
│                                                                   │
│  ConflictDetector                                                 │
│    Compare sentiment vs UW flow direction                         │
│    [CONFLICT] → lower confidence, route to manual-confirm          │
│    [ALIGNED] ↓                                                    │
│                                                                   │
│  HTTP call → option-chain-analyzer /analyze                       │
│    Returns: top 3 contracts + metrics + rationale                  │
│         │                                                         │
│         ▼                                                         │
│  RiskAttacher (add stop-loss, take-profit from user config)        │
│         │                                                         │
│         ▼                                                         │
│  TradeSignalBuilder → KafkaProducer(parsed-trades)                │
│    Includes: originating_signal_id, confidence, rationale          │
│         │                                                         │
│         ▼                                                         │
│  DecisionLogger → DB Write (ai_trade_decisions)                   │
│    Full audit: signal → interpretation → UW data → contract →     │
│    risk params → final decision                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 2.4 Option Chain Analyzer Service

**Purpose:** Standalone MCP-style service that analyzes option chains for any given ticker+direction, returns top 3 contracts with metrics and strategy suggestions. Can be called by ai-trade-recommender, pipeline nodes, chatbot, or directly from UI.

**Port:** 8024

**API:** HTTP REST (synchronous request/response for flexibility)

**Endpoints:**
- `POST /analyze` -- input: `{ ticker, direction, preferences?, context? }`, output: `{ contracts: [...], strategies: [...], rationale }`
- `POST /analyze/strategy` -- suggest multi-leg strategy (spread, straddle, etc.)
- `GET /performance` -- historical accuracy metrics of recommendations
- `GET /health`

**Key components:**
- `ChainFetcher` -- pulls full option chain from UW API, falls back to broker API
- `GreeksCalculator` -- computes/retrieves delta, gamma, theta, vega, IV rank
- `GEXAnalyzer` -- gamma exposure analysis at each strike
- `ContractRanker` -- scores each contract: `0.3*OI_score + 0.2*delta_score + 0.2*IV_score + 0.15*spread_score + 0.15*GEX_score`
- `StrategyBuilder` -- generates multi-leg suggestions (bull call spread, bear put spread, straddle, iron condor) when conditions warrant
- `RationaleGenerator` -- LLM-generated English explanation of the recommendation
- `OutcomeTracker` -- background job that checks outcomes of past recommendations at expiry

### 2.5 Strategy Agent Service

**Purpose:** Accepts natural-language strategy descriptions, extracts features/rules via LLM, fetches historical data, runs backtests, generates detailed reports with visualizations. Supports conversational clarification.

**Port:** 8025

**Kafka:**
- Produces: `notifications` (on backtest completion)

**API:** HTTP REST

**Endpoints:**
- `POST /parse` -- parse NL description, return structured strategy JSON (or clarifying questions)
- `POST /clarify` -- answer clarifying questions, update strategy
- `POST /backtest` -- run backtest with given strategy JSON, return job ID
- `GET /backtest/{job_id}` -- get backtest status/results
- `POST /deploy` -- convert strategy to advanced pipeline

**Key components:**
- `StrategyParser` -- LLM (Ollama) that converts English to structured strategy JSON. If ambiguous, returns `{ needs_clarification: true, questions: [...] }`
- `DataFetcher` -- pulls historical OHLCV from Yahoo Finance (yfinance), optionally intraday data
- `BacktestEngine` -- extends existing `shared/backtest/` module with event-driven strategies, options approximation, transaction costs, and slippage
- `VariationTester` -- automatically tests 2-3 parameter variations and compares results
- `BenchmarkComparer` -- compares strategy vs buy-and-hold and vs SPY
- `ReportGenerator` -- produces metrics + charts (equity curve, drawdown, monthly heatmap) + AI narrative
- `StrategyDeployer` -- converts a strategy definition into an advanced pipeline JSON

---

## 3. Database Schema Changes

### 3.1 New Tables

```sql
-- Sentiment: individual message-level sentiment
CREATE TABLE sentiment_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    data_source_id UUID REFERENCES data_sources(id),
    channel_id UUID REFERENCES channels(id),
    channel_name VARCHAR(255),
    source_message_id VARCHAR(255),
    content TEXT NOT NULL,
    tickers TEXT[] NOT NULL,
    sentiment_label VARCHAR(20) NOT NULL,
    sentiment_score FLOAT NOT NULL,
    raw_model_output JSONB,
    author VARCHAR(255),
    is_bot BOOLEAN DEFAULT false,
    message_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sentiment_messages_ticker ON sentiment_messages USING GIN(tickers);
CREATE INDEX idx_sentiment_messages_created ON sentiment_messages(created_at);
CREATE INDEX idx_sentiment_messages_user ON sentiment_messages(user_id);
CREATE INDEX idx_sentiment_messages_source_msg ON sentiment_messages(source_message_id);

-- Sentiment: aggregated per-ticker sentiment (updated every 30 min)
CREATE TABLE ticker_sentiment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    ticker VARCHAR(10) NOT NULL,
    sentiment_label VARCHAR(20) NOT NULL,
    sentiment_score FLOAT NOT NULL,
    mention_count INT NOT NULL DEFAULT 0,
    previous_score FLOAT,
    previous_mention_count INT,
    mention_change_pct FLOAT,              -- % change vs previous window
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, ticker, window_start)
);

CREATE INDEX idx_ticker_sentiment_user_ticker ON ticker_sentiment(user_id, ticker);
CREATE INDEX idx_ticker_sentiment_window ON ticker_sentiment(window_end DESC);

-- Sentiment alert rules (user-configurable)
CREATE TABLE sentiment_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    ticker VARCHAR(10),                    -- NULL = any ticker
    condition_type VARCHAR(50) NOT NULL,   -- threshold_cross, direction_flip, mention_spike
    condition_config JSONB NOT NULL,       -- e.g. {"min_score": -1.5, "min_mentions": 30}
    delivery_channels TEXT[] DEFAULT '{notification}', -- notification, email, discord_webhook
    cooldown_minutes INT DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- News headlines
CREATE TABLE news_headlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    headline TEXT NOT NULL,
    summary TEXT,                           -- first 200 chars of article if available
    source_name VARCHAR(100) NOT NULL,
    source_url TEXT,
    source_icon VARCHAR(50),               -- icon identifier for UI
    tickers TEXT[] NOT NULL DEFAULT '{}',
    sentiment_label VARCHAR(20),
    sentiment_score FLOAT,
    importance_score FLOAT DEFAULT 0,
    cluster_id VARCHAR(100),
    is_primary_in_cluster BOOLEAN DEFAULT true,
    source_count INT DEFAULT 1,            -- how many sources reported this story
    published_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_news_tickers ON news_headlines USING GIN(tickers);
CREATE INDEX idx_news_published ON news_headlines(published_at DESC);
CREATE INDEX idx_news_created ON news_headlines(created_at);
CREATE INDEX idx_news_cluster ON news_headlines(cluster_id);
CREATE INDEX idx_news_importance ON news_headlines(importance_score DESC);

-- News API connections (per-user API keys)
CREATE TABLE news_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    source_name VARCHAR(100) NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    extra_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_fetch_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, source_name)
);

-- Advanced pipelines (visual builder)
CREATE TABLE advanced_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    pipeline_json JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    version INT DEFAULT 1,
    template_name VARCHAR(100),
    last_run_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pipeline version history
CREATE TABLE advanced_pipeline_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES advanced_pipelines(id) ON DELETE CASCADE,
    version INT NOT NULL,
    pipeline_json JSONB NOT NULL,
    changed_by UUID REFERENCES users(id),
    change_description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(pipeline_id, version)
);

-- Strategy models (from NL backtesting)
CREATE TABLE strategy_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    strategy_json JSONB NOT NULL,
    original_prompt TEXT,
    clarification_history JSONB,           -- conversation log of Q&A
    generated_code TEXT,                   -- pseudocode/logic for transparency
    backtest_run_id UUID REFERENCES backtest_runs(id),
    performance_metrics JSONB,
    benchmark_comparison JSONB,            -- vs buy-hold, vs SPY
    variation_results JSONB,               -- results of parameter variations
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Option analysis history
CREATE TABLE option_analysis_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    ticker VARCHAR(10) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    input_context TEXT,
    recommended_contracts JSONB NOT NULL,   -- array of top 3
    strategy_suggestions JSONB,            -- multi-leg suggestions
    metrics JSONB NOT NULL,
    rationale TEXT,
    selected_contract JSONB,               -- which one was actually used
    user_override BOOLEAN DEFAULT false,   -- did user pick a different one?
    outcome JSONB,                         -- filled later with actual P&L
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_option_analysis_ticker ON option_analysis_log(ticker);
CREATE INDEX idx_option_analysis_created ON option_analysis_log(created_at DESC);

-- AI trade decision audit log
CREATE TABLE ai_trade_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    signal_type VARCHAR(20) NOT NULL,      -- sentiment, news
    signal_id VARCHAR(255),                -- reference to originating signal
    ticker VARCHAR(10) NOT NULL,
    signal_data JSONB NOT NULL,            -- full signal payload
    llm_interpretation TEXT,               -- LLM's reasoning
    uw_data_snapshot JSONB,                -- UW API data at time of decision
    conflict_detected BOOLEAN DEFAULT false,
    decision VARCHAR(20) NOT NULL,         -- trade, no_action, manual_confirm
    confidence_score FLOAT,
    trade_details JSONB,                   -- if trade: contract, quantity, stop-loss, etc.
    rejection_reason TEXT,                 -- if no_action: why
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_decisions_ticker ON ai_trade_decisions(ticker);
CREATE INDEX idx_ai_decisions_created ON ai_trade_decisions(created_at DESC);
CREATE INDEX idx_ai_decisions_decision ON ai_trade_decisions(decision);

-- Model registry (Model Hub)
CREATE TABLE model_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),     -- NULL for system models
    name VARCHAR(255) NOT NULL,
    description TEXT,
    model_type VARCHAR(50) NOT NULL,       -- sentiment, trade_recommendation, option_analysis, strategy, general_llm
    provider VARCHAR(50) NOT NULL,         -- system, user, ollama
    config_json JSONB DEFAULT '{}',        -- model-specific config (e.g., prompt template, parameters)
    input_schema JSONB,                    -- expected input format
    output_schema JSONB,                   -- output format
    endpoint_url VARCHAR(500),             -- where to call this model
    status VARCHAR(20) DEFAULT 'available', -- available, loading, error, deprecated
    performance_metrics JSONB,             -- accuracy, latency, etc.
    strategy_model_id UUID REFERENCES strategy_models(id), -- if derived from a strategy
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_model_registry_type ON model_registry(model_type);
CREATE INDEX idx_model_registry_provider ON model_registry(provider);

-- User watchlist
CREATE TABLE user_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    ticker VARCHAR(10) NOT NULL,
    added_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, ticker)
);

CREATE INDEX idx_watchlist_user ON user_watchlist(user_id);
```

### 3.2 Modified Tables

```sql
-- data_sources: add source_type column
ALTER TABLE data_sources ADD COLUMN source_type VARCHAR(20) DEFAULT 'trades';
-- values: 'trades', 'sentiment', 'news'
-- Migration: UPDATE data_sources SET source_type = 'trades' WHERE source_type IS NULL;

-- trade_pipelines: add pipeline_type and trigger config
ALTER TABLE trade_pipelines ADD COLUMN pipeline_type VARCHAR(20) DEFAULT 'standard';
-- values: 'standard', 'sentiment', 'news', 'advanced'
ALTER TABLE trade_pipelines ADD COLUMN trigger_config JSONB DEFAULT '{}';
-- e.g., {"min_sentiment_score": 1.5, "min_mentions": 20, "market_hours_mode": "regular"}
ALTER TABLE trade_pipelines ADD COLUMN market_hours_mode VARCHAR(20) DEFAULT 'regular';
-- values: 'regular', 'extended', '24_7', 'queue_next_open'
```

---

## 4. New Kafka Topics

| Topic | Partitions | Key | Producer(s) | Consumer(s) |
|---|---|---|---|---|
| `raw-sentiment-messages` | 6 | channel_id | discord-ingestor, reddit-ingestor, twitter-ingestor | sentiment-analyzer |
| `sentiment-signals` | 3 | ticker | sentiment-analyzer | ai-trade-recommender, api-gateway (WebSocket push) |
| `news-headlines` | 3 | source_name | news-aggregator | api-gateway (for dashboard) |
| `news-signals` | 3 | ticker | news-aggregator | ai-trade-recommender |

**Existing topics reused:**
- `parsed-trades` -- AI trade recommender produces into this topic to join the existing trade flow
- `notifications` -- sentiment alerts, strategy completion, AI trade notifications
- `raw-messages` -- unchanged for trade data sources

---

## 5. Modified Existing Services

### 5.1 Discord Ingestor

**Change:** Route messages based on channel's data source type.

**Implementation:**
- On startup, load mapping of `channel_id → source_type` from DB via source-orchestrator or direct DB query
- Listen for `config-updates` Kafka topic for real-time mapping changes
- When processing a message:
  - If `source_type = 'sentiment'` → publish to `raw-sentiment-messages`
  - If `source_type = 'trades'` → publish to `raw-messages` (existing behavior)
  - Include `is_bot` flag in message metadata for spam filtering downstream

### 5.2 Source Orchestrator

**Change:** Manage lifecycle of new services. When a user creates/modifies a sentiment data source:
- Notify discord-ingestor to update channel routing
- Publish config change to `config-updates` topic
- Track health of sentiment-analyzer and news-aggregator

### 5.3 API Gateway

**New route groups:**

| Route | Method | Purpose |
|---|---|---|
| `/api/v1/sentiment/tickers` | GET | List aggregated ticker sentiment with trends |
| `/api/v1/sentiment/tickers/{ticker}/messages` | GET | Messages contributing to a ticker's sentiment (paginated) |
| `/api/v1/sentiment/tickers/{ticker}/summary` | GET | AI-generated summary for a ticker (cached 5 min) |
| `/api/v1/sentiment/tickers/{ticker}/history` | GET | Historical sentiment windows for sparkline data |
| `/api/v1/sentiment/alerts` | GET/POST/PUT/DELETE | Manage sentiment alert rules |
| `/api/v1/news/headlines` | GET | List trending news headlines (paginated, filterable) |
| `/api/v1/news/connections` | GET/POST/PUT/DELETE | Manage news API connections |
| `/api/v1/watchlist` | GET/POST/DELETE | Manage user watchlist |
| `/api/v1/pipelines/advanced` | GET/POST/PUT/DELETE | Manage advanced (visual) pipelines |
| `/api/v1/pipelines/advanced/{id}/deploy` | POST | Deploy an advanced pipeline |
| `/api/v1/pipelines/advanced/{id}/test` | POST | Test-run an advanced pipeline |
| `/api/v1/pipelines/advanced/{id}/versions` | GET | List pipeline version history |
| `/api/v1/pipelines/advanced/{id}/versions/{v}/revert` | POST | Revert to a specific version |
| `/api/v1/pipelines/advanced/import` | POST | Import pipeline from JSON |
| `/api/v1/pipelines/advanced/{id}/export` | GET | Export pipeline as JSON |
| `/api/v1/strategies` | GET/POST | List/create strategy models |
| `/api/v1/strategies/{id}` | GET/DELETE | Get/delete strategy details |
| `/api/v1/strategies/{id}/parse` | POST | Parse NL description |
| `/api/v1/strategies/{id}/clarify` | POST | Answer clarifying questions |
| `/api/v1/strategies/{id}/backtest` | POST | Trigger backtest run |
| `/api/v1/strategies/{id}/deploy` | POST | Deploy as pipeline |
| `/api/v1/options/analyze` | POST | Proxy to option-chain-analyzer |
| `/api/v1/options/performance` | GET | Option recommendation performance metrics |
| `/api/v1/models` | GET | List all models in registry (Model Hub) |
| `/api/v1/models/{id}` | GET | Get model details |
| `/api/v1/models/ollama` | GET | List available Ollama models |
| `/api/v1/models/ollama/pull` | POST | Download a new Ollama model |
| `/api/v1/ai/decisions` | GET | List AI trade decisions (audit log) |

**WebSocket additions:**
- Push `sentiment-signals` updates to connected clients for real-time ticker sentiment updates
- Push `news-signals` for breaking headlines
- Push AI trade decision notifications

### 5.4 Dashboard UI

**New pages:**

| Page | Route | Description |
|---|---|---|
| TickerSentiment | `/sentiment` | Ticker sentiment dashboard with sparklines, alerts |
| SentimentAlerts | `/sentiment/alerts` | Configure sentiment alert rules |
| TrendingNews | `/news` | Trending news feed with clustering |
| NewsConnections | `/news/connections` | Manage news API keys |
| AdvancedPipelines | `/pipelines/advanced` | List advanced pipelines |
| PipelineEditor | `/pipelines/advanced/:id` | React Flow canvas editor |
| StrategyBuilder | `/strategies` | NL strategy description + backtest |
| StrategyDetail | `/strategies/:id` | Strategy results, report, variations |
| ModelHub | `/models` | Model registry and management |
| Watchlist | `/watchlist` | Manage watched tickers |

**Modified pages:**
- `DataSources.tsx` -- add source_type selector (trades/sentiment), multi-channel selection for sentiment
- `TradePipelines.tsx` -- option to create from sentiment/news data sources, show pipeline_type badge
- `Backtesting.tsx` -- add "Strategy from Description" link/section
- `Dashboard.tsx` -- optional watchlist widget, sentiment mini-summary

---

## 6. External API Integrations

```
┌─────────────────────────────────────────────────────────────────────┐
│                        External APIs                                 │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │ Finnhub      │  │ NewsAPI.org  │  │ Unusual Whales            │ │
│  │ - Market News│  │ - Headlines  │  │ - Options Flow            │ │
│  │ - Sentiment  │  │ - Trending   │  │ - Open Interest           │ │
│  │ (Free tier)  │  │ (Free: 100/d)│  │ - GEX/DEX/Greeks          │ │
│  └──────┬───────┘  └──────┬───────┘  │ - Market Tide             │ │
│         │                 │          │ - IV Rank                  │ │
│  ┌──────┴───────┐  ┌──────┴───────┐  └──────────┬─────────────────┘ │
│  │ Alpha Vantage│  │ Reddit API   │             │                   │
│  │ - News+Sent. │  │ - Posts      │             │                   │
│  │ (Free tier)  │  │ (Free/OAuth) │             │                   │
│  └──────┬───────┘  └──────┬───────┘             │                   │
│         │                 │                     │                   │
│  ┌──────┴───────┐  ┌──────┴───────┐             │                   │
│  │ Seeking Alpha│  │ Yahoo Finance│             │                   │
│  │ (RapidAPI)   │  │ (yfinance)   │             │                   │
│  │ - News       │  │ - OHLCV hist │             │                   │
│  └──────┬───────┘  └──────┬───────┘             │                   │
│         │                 │                     │                   │
└─────────┼─────────────────┼─────────────────────┼───────────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
   news-aggregator   strategy-agent        ai-trade-recommender
                                           option-chain-analyzer
```

---

## 7. AI/ML Stack

### 7.1 Models

| Model | Purpose | Deployment | Size | Used By |
|---|---|---|---|---|
| FinBERT (ProsusAI/finbert) | Sentiment classification (3-class → 5-class) | Shared module, loaded by sentiment-analyzer + news-aggregator | ~440MB | sentiment-analyzer, news-aggregator |
| Mistral 7B (via Ollama) | AI summaries, signal interpretation, strategy parsing, rationale generation | Ollama server on VPS | ~4.1GB | All AI services |
| Plutus or Llama 3.3 8B | Financial reasoning (fallback/upgrade) | Ollama server on VPS | ~4.7GB | Fallback for Mistral |
| spaCy en_core_web_sm | Ticker/entity extraction | Already in nlp-parser | ~12MB | Shared NLP module |

### 7.2 Ollama Server

Deploy Ollama as a shared Docker service accessible by all AI-consuming services.

**Docker service:**
```yaml
ollama:
  image: ollama/ollama:latest
  ports:
    - "11434:11434"
  volumes:
    - ollama_data:/root/.ollama
  deploy:
    resources:
      reservations:
        devices:
          - capabilities: [gpu]  # if GPU available
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
    interval: 30s
    timeout: 10s
    retries: 3
```

**Health/Fallback mechanism:**
- All services using Ollama go through `shared/llm/client.py` which includes:
  - Connection pooling and retry logic (3 retries with exponential backoff)
  - Timeout per request (30s for summaries, 60s for strategy parsing)
  - Graceful fallback: if Ollama is unreachable after retries, return a degraded response (e.g., "AI summary temporarily unavailable") rather than failing the entire request
  - Health check endpoint that verifies Ollama is responding and the target model is loaded

### 7.3 Shared LLM Client

**New module:** `shared/llm/client.py`

```python
class OllamaClient:
    async def generate(prompt: str, model: str = "mistral", timeout: int = 30) -> str
    async def is_healthy() -> bool
    async def list_models() -> list[dict]
    async def pull_model(model_name: str) -> None
```

All services importing LLM functionality use this shared client.

---

## 8. Frontend Architecture

### 8.1 React Flow Pipeline Editor

The visual pipeline builder is the most complex frontend addition. Key architecture:

```
AdvancedPipelineEditor/
├── PipelineCanvas.tsx          -- ReactFlow wrapper with zoom/pan/minimap
├── NodePalette.tsx             -- left sidebar with draggable node types
├── NodeConfigPanel.tsx         -- right sidebar for selected node configuration
├── PipelineToolbar.tsx         -- top bar with save, deploy, test, undo/redo, import/export
├── DebugPanel.tsx              -- bottom panel showing test-run data at each node
├── VersionHistory.tsx          -- version history sidebar/dialog
├── nodes/
│   ├── DataSourceNode.tsx      -- Discord, Sentiment, News source nodes
│   ├── ProcessingNode.tsx      -- Parser, Analyzer, Filter nodes
│   ├── AIModelNode.tsx         -- LLM, MCP, Strategy, Option Analyzer nodes
│   ├── BrokerNode.tsx          -- Alpaca, IB execution nodes
│   └── ControlNode.tsx         -- IF, Merge, Delay, Split nodes
├── edges/
│   └── AnimatedEdge.tsx        -- custom edge with data flow animation
├── hooks/
│   ├── usePipelineState.ts     -- manages nodes/edges state + undo/redo history
│   ├── usePipelineDeploy.ts    -- deployment logic
│   ├── usePipelineTest.ts      -- test-run logic
│   └── useAutoSave.ts          -- debounced auto-save
└── templates/
    └── defaultTemplates.ts     -- pre-built pipeline JSON templates
```

**State management:**
- React Flow's built-in `useNodesState` and `useEdgesState` hooks
- Custom undo/redo stack (50 entries) tracking node/edge changes
- Auto-save: debounced PUT (2 second delay) to backend
- Version creation: explicit save creates a new version entry

### 8.2 New Dashboard Pages

All new pages follow existing patterns: React + TanStack Query + Shadcn/UI + Axios.

**Ticker Sentiment page layout:**
```
┌──────────────────────────────────────────────────────────────┐
│  [Search] [Filters: Sentiment ▼] [Time: 3h ▼] [☐ Watchlist] │
├──────────────────────────────────────────────────────────────┤
│ Ticker │ Sentiment │ Score │ Mentions │ Δ% │ Trend │ Trades │👁│
│ AAPL   │ 🟢 Bullish │ +1.3  │ 47       │ +23%│ ╱╲╱  │ 3      │👁│
│ TSLA   │ 🔴 V.Bear │ -1.8  │ 89       │ +156%│╲╲╲  │ 7      │👁│
│ ...                                                          │
└──────────────────────────────────────────────────────────────┘
```

**Trending News page layout:**
```
┌──────────────────────────────────────────────────────────────────┐
│  [Search] [Source: All ▼] [☐ Watchlist] [Configure Sources ⚙]    │
├──────────────────────────────────────────────────────────────────┤
│  ── Today ──                                                     │
│  1. [TSLA] Tesla shares jump as earnings beat forecasts          │
│     🟢 Positive · 10m ago · Finnhub · from 3 sources            │
│  2. [AMC] AMC plunges 15% on surprise equity offering            │
│     🔴 Negative · 8m ago · NewsAPI · from 2 sources              │
│  ── Yesterday ──                                                 │
│  3. ...                                                          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 9. Data Flow Diagrams

### 9.1 Sentiment Flow (End-to-End)

```
User configures                Discord channels
Sentiment Data Source    ──►   marked as sentiment
        │                            │
        ▼                            ▼
source-orchestrator          discord-ingestor
 (routes channel)            reads messages
        │                            │
        ▼                            ▼
                          Kafka: raw-sentiment-messages
                                     │
                                     ▼
                            sentiment-analyzer
                            ┌────────────────────────────┐
                            │ SpamFilter (bots, dupes)    │
                            │ TickerExtractor (shared)    │
                            │ SentimentClassifier (shared)│
                            │ DB Write (messages)         │
                            │ Aggregate 30min             │
                            │ AlertEvaluator              │
                            └────────────┬───────────────┘
                                         │
                          ┌──────────────┼──────────────────┐
                          ▼              ▼                  ▼
                     DB: sentiment   DB: ticker        Kafka:
                     _messages       _sentiment        sentiment-signals
                          │              │                  │
                          ▼              ▼                  ├──► WebSocket → UI
                    API Gateway    Redis Cache              │
                    /sentiment/*                            ▼
                          │                         ai-trade-recommender
                          ▼                         (if pipeline exists)
                    Dashboard UI                          │
                    (Ticker Sentiment                      ▼
                     + Alerts)                      parsed-trades → ...
```

### 9.2 News Flow (End-to-End)

```
Scheduled every 10 min (staggered per source)
        │
        ▼
  news-aggregator
  ┌──────────────────────────────────────┐
  │ Poll: Finnhub, NewsAPI, Reddit,      │
  │   AlphaVantage, SeekingAlpha         │
  │ Normalize + StoryCluster (dedup)     │
  │ Tag tickers (shared) + sentiment     │
  │ Rank importance                      │
  │ Store in DB                          │
  │ Clean up > 48h                       │
  └──────────┬───────────────────────────┘
             │
   ┌─────────┼────────────┐
   ▼                      ▼
DB: news_headlines     Kafka: news-signals
   │                   (importance > threshold)
   ▼                         │
API Gateway                  ├──► WebSocket → UI (breaking)
/news/*                      │
   │                         ▼
   ▼                  ai-trade-recommender
Dashboard UI                 │
(Trending News               ▼
 + Clustering)         parsed-trades → ...
```

### 9.3 Headlines-Based Trading Flow

```
sentiment-signals ──┐
                    ├──► ai-trade-recommender
news-signals ───────┘          │
                               ▼
                    MarketHoursChecker
                    [CLOSED] → queue/discard
                    [OPEN] ↓
                               │
                    Dedup Check (Redis 30-min cooldown)
                    [DUP] → discard + log
                    [NEW] ↓
                               │
                    SignalInterpreter (Ollama LLM)
                    "Should we trade? What direction?"
                               │
                    [NO] → log decision → DecisionLogger
                    [YES] ↓
                               │
                    ConflictDetector
                    Compare sentiment vs UW options flow
                    [CONFLICT] → lower confidence, manual-confirm
                    [ALIGNED] ↓
                               │
                    HTTP → option-chain-analyzer /analyze
                    "Pick top 3 contracts + strategies"
                               │
                    RiskAttacher (stop-loss, take-profit)
                               │
                    TradeSignalBuilder
                    Kafka: parsed-trades
                               │
                    DecisionLogger → DB: ai_trade_decisions
                               │
                    (existing flow)
                    trade-gateway → trade-executor → Alpaca/IB
```

### 9.4 NL Strategy Flow

```
User types strategy in English
        │
        ▼
  API Gateway /strategies/{id}/parse
        │
        ▼
  strategy-agent /parse
  ┌─────────────────────────────────────┐
  │ StrategyParser (Ollama LLM)          │
  │ "Extract entry/exit/timing/risk"     │
  │                                      │
  │ [AMBIGUOUS] → return questions       │
  │   User answers via /clarify          │
  │   Re-parse with additional context   │
  │                                      │
  │ [CLEAR] → structured strategy JSON   │
  └───────────┬─────────────────────────┘
              │
    User reviews JSON (editable)
    Clicks "Run Backtest"
              │
              ▼
  strategy-agent /backtest
  ┌─────────────────────────────────────┐
  │ DataFetcher (yfinance, 2 years)      │
  │ BacktestEngine (run strategy)        │
  │ VariationTester (try 2-3 params)     │
  │ BenchmarkComparer (vs SPY, vs B&H)  │
  │ ReportGenerator (metrics + charts)   │
  │ AI Narrative (Ollama)                │
  └───────────┬─────────────────────────┘
              │
    Kafka: notifications (completion)
              │
    User views report
    Clicks "Deploy as Pipeline"
              │
              ▼
  strategy-agent /deploy
  → Creates advanced_pipeline record
  → User configures broker node in editor
```

---

## 10. Deployment Architecture

### Docker Compose Additions

```yaml
ollama:
  image: ollama/ollama:latest
  ports: ["11434:11434"]
  volumes:
    - ollama_data:/root/.ollama
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
    interval: 30s
    timeout: 10s
    retries: 3

sentiment-analyzer:
  build: ./services/sentiment-analyzer
  ports: ["8021:8021"]
  depends_on: [kafka, postgres, redis]
  environment:
    - KAFKA_BOOTSTRAP_SERVERS=kafka:9092
    - DATABASE_URL=postgresql+asyncpg://...
    - REDIS_URL=redis://redis:6379

news-aggregator:
  build: ./services/news-aggregator
  ports: ["8022:8022"]
  depends_on: [kafka, postgres]
  environment:
    - KAFKA_BOOTSTRAP_SERVERS=kafka:9092
    - DATABASE_URL=postgresql+asyncpg://...

ai-trade-recommender:
  build: ./services/ai-trade-recommender
  ports: ["8023:8023"]
  depends_on: [kafka, postgres, ollama, redis]
  environment:
    - KAFKA_BOOTSTRAP_SERVERS=kafka:9092
    - OLLAMA_URL=http://ollama:11434
    - UW_API_BASE=https://api.unusualwhales.com
    - REDIS_URL=redis://redis:6379
    - OPTION_ANALYZER_URL=http://option-chain-analyzer:8024

option-chain-analyzer:
  build: ./services/option-chain-analyzer
  ports: ["8024:8024"]
  depends_on: [ollama, redis]
  environment:
    - OLLAMA_URL=http://ollama:11434
    - UW_API_BASE=https://api.unusualwhales.com
    - REDIS_URL=redis://redis:6379
    - DATABASE_URL=postgresql+asyncpg://...

strategy-agent:
  build: ./services/strategy-agent
  ports: ["8025:8025"]
  depends_on: [kafka, postgres, ollama]
  environment:
    - KAFKA_BOOTSTRAP_SERVERS=kafka:9092
    - OLLAMA_URL=http://ollama:11434
    - DATABASE_URL=postgresql+asyncpg://...
```

### Resource Requirements

| Service | CPU | Memory | Disk | Notes |
|---|---|---|---|---|
| sentiment-analyzer | 0.5 vCPU | 2GB (FinBERT) | minimal | FinBERT loaded in-process |
| news-aggregator | 0.25 vCPU | 1GB (FinBERT) | minimal | Shares FinBERT via shared module |
| ai-trade-recommender | 0.5 vCPU | 1GB | minimal | Calls Ollama and OCA via HTTP |
| option-chain-analyzer | 0.25 vCPU | 512MB | minimal | Calls Ollama via HTTP |
| strategy-agent | 0.5 vCPU | 1GB | 5GB | Historical data cache |
| ollama | 2+ vCPU | 8GB+ (7B model) | 10GB+ | Model weights; GPU recommended |

**Total additional:** ~4 vCPU, ~14GB RAM, ~15GB disk (dominated by Ollama)

**VPS sizing recommendation:** At least 32GB RAM total (existing services ~8GB + new ~14GB + OS/buffer ~10GB). If GPU available, Ollama performance improves dramatically. Without GPU, Mistral 7B Q4 quantized (~4GB VRAM-equivalent) runs on CPU at ~5 tok/s.
