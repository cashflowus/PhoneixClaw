# Phase 2 - Implementation Plan

## Overview

Phase 2 is organized into 7 milestones, each building on the previous. Milestones are designed to deliver incrementally usable features. Estimated total duration: 12-16 weeks for a single developer.

**Key change from v1:** Ollama and shared modules are set up in Milestone 0 (foundational sprint) rather than deferred to the end, since multiple milestones depend on LLM capabilities.

---

## Milestone 0: Foundation -- Ollama, Shared Modules, Watchlist (Week 1)

**Goal:** Set up Ollama infrastructure, extract shared NLP/LLM modules, create Watchlist, add market calendar utility. These are prerequisites for all subsequent milestones.

### 0.1 Ollama Server Setup

**Tasks:**
1. Add Ollama service to `docker-compose.yaml` with health check
2. Create startup script that pulls Mistral 7B model on first run
3. Verify Ollama responds on `http://ollama:11434`

### 0.2 Shared LLM Client

**New module:** `shared/llm/client.py`

**Tasks:**
1. Create `OllamaClient` class with methods: `generate()`, `is_healthy()`, `list_models()`, `pull_model()`
2. Connection pooling via `httpx.AsyncClient`
3. Retry logic: 3 retries with exponential backoff (1s, 2s, 4s)
4. Timeout: configurable per request (default 30s)
5. Graceful fallback: return degraded response string when Ollama is unreachable
6. Unit test with mock Ollama responses

### 0.3 Shared NLP Modules

**New modules:**
- `shared/nlp/ticker_extractor.py` -- regex + known-list validation
- `shared/nlp/sentiment_classifier.py` -- FinBERT wrapper with 3-class → 5-class mapping
- `shared/data/tickers.json` -- ticker symbol list (downloaded from exchange or static)

**Tasks:**
1. Extract ticker detection logic from existing `services/nlp-parser/src/entity_extractor.py` into `shared/nlp/ticker_extractor.py`
2. Create `shared/nlp/sentiment_classifier.py` wrapping FinBERT with 5-class output
3. Download and store US equity ticker list (~8000 symbols) in `shared/data/tickers.json`
4. Unit tests for ticker extraction edge cases (`$SPY`, `AMC`, `calls`, `I AM SELLING`, false positives like `A`, `I`, `CEO`)

### 0.4 Shared Market Calendar

**New module:** `shared/market/calendar.py`

**Tasks:**
1. Install `exchange_calendars` package
2. Create utility functions: `is_market_open()`, `next_market_open()`, `is_premarket()`, `is_afterhours()`
3. Support NYSE and NASDAQ schedules including holidays
4. Unit tests for market hours edge cases (holidays, early close days)

### 0.5 Shared Unusual Whales Client

**New module:** `shared/unusual_whales/`

**Tasks:**
1. Create `client.py` with authenticated `httpx` client, rate limiter, and Redis cache
2. Key endpoints: `GET /options/flow`, `GET /options/chain/{ticker}`, `GET /options/greeks/gex`
3. Create `models.py` with Pydantic response models
4. Create `cache.py` with Redis-backed 5-minute cache
5. Fallback: if UW API fails, return `None` with log (callers handle gracefully)

### 0.6 Watchlist

**Backend:**
- DB migration: create `user_watchlist` table
- New file: `services/api-gateway/src/routes/watchlist.py`
- Routes: `GET /api/v1/watchlist`, `POST /api/v1/watchlist` (add ticker), `DELETE /api/v1/watchlist/{ticker}` (remove)

**Frontend:**
- Small component: `WatchlistButton.tsx` (star icon, toggles ticker in/out of watchlist)
- Can be embedded in any page next to ticker symbols
- `useWatchlist()` hook for querying and mutating

### 0.7 Database Migrations

**Tasks:**
1. Add `source_type` column to `data_sources` table, backfill existing rows with `'trades'`
2. Add `pipeline_type`, `trigger_config`, `market_hours_mode` columns to `trade_pipelines`
3. Create `user_watchlist` table
4. Create `model_registry` table and seed with system models (FinBERT, Mistral 7B, etc.)

### Milestone 0 Deliverable

- Ollama running with Mistral 7B available
- Shared modules ready for use by all services
- Watchlist functional (add/remove tickers)
- Market calendar utility working
- UW client ready (requires user's API key to actually call)
- Database migrated with new columns and tables

### Acceptance Criteria

- [ ] `curl http://localhost:11434/api/tags` returns model list including mistral
- [ ] `shared/llm/client.py` generates a response to "Hello" within 30s
- [ ] `shared/nlp/ticker_extractor.py` correctly extracts `AAPL` from "$AAPL calls looking good"
- [ ] `shared/nlp/sentiment_classifier.py` classifies "Apple earnings beat expectations" as Bullish or Very Bullish
- [ ] Watchlist API: POST adds ticker, GET returns it, DELETE removes it
- [ ] `is_market_open()` returns correct value for current time

---

## Milestone 1: Sentiment Analysis (Weeks 2-3)

**Goal:** Sentiment data source type, sentiment analyzer service, ticker sentiment dashboard with sparklines and alerts.

### 1.1 Backend: Data Source Type Extension

**Files to modify:**
- `shared/models/trade.py` -- add SQLAlchemy models for `sentiment_messages`, `ticker_sentiment`, `sentiment_alerts`
- `services/api-gateway/main.py` -- add migration for new tables
- `services/api-gateway/src/routes/sources.py` -- update create/update endpoints to handle `source_type = "sentiment"` and multi-channel selection

**Tasks:**
1. Create `sentiment_messages`, `ticker_sentiment`, `sentiment_alerts` tables with all indexes
2. Update data source API to accept `source_type` and array of `channel_ids` for sentiment sources
3. Validate that sentiment sources have at least one channel selected

### 1.2 Backend: Sentiment Analyzer Service

**New service:** `services/sentiment-analyzer/`

**Structure:**
```
services/sentiment-analyzer/
├── main.py
├── requirements.txt
├── Dockerfile
└── src/
    ├── spam_filter.py         # Bot check, length check, dedup
    ├── aggregator.py          # 30-min rolling window aggregation
    ├── alert_evaluator.py     # Check user alert rules
    └── service.py             # Main Kafka consumer loop
```

**Tasks:**
1. Create `spam_filter.py` -- check `is_bot` flag, reject messages < 5 chars, reject duplicate content from same author within 60s (Redis set)
2. Create `aggregator.py` -- compute rolling 30-min average per ticker per user, store in `ticker_sentiment` table, calculate `mention_change_pct` vs previous window, cache latest in Redis, emit to `sentiment-signals` Kafka topic
3. Create `alert_evaluator.py` -- load user alert rules from DB, evaluate against current sentiment state, respect cooldown period, produce to `notifications` topic when triggered
4. Create `service.py` -- Kafka consumer for `raw-sentiment-messages`, orchestrates: spam filter → ticker extract (shared) → classify (shared) → persist → aggregate → alert check
5. Create Dockerfile (base on existing service pattern)
6. Add `raw-sentiment-messages` and `sentiment-signals` topics to `scripts/init.sh`

### 1.3 Backend: Discord Ingestor Routing

**Files to modify:**
- `services/discord-ingestor/src/ingestor.py` (or `services/discord-ingestor/src/discord_bot.py`)

**Tasks:**
1. On startup, load mapping of `channel_id → source_type` from DB
2. Subscribe to `config-updates` Kafka topic for dynamic mapping changes
3. Route messages: `source_type = 'sentiment'` → `raw-sentiment-messages` topic; `source_type = 'trades'` → `raw-messages` topic (existing)
4. Include `is_bot` flag from Discord message metadata in Kafka headers

### 1.4 Frontend: Data Source UI Update

**Files to modify:**
- `services/dashboard-ui/src/pages/DataSources.tsx`

**Tasks:**
1. Add `source_type` radio buttons (Trades / Sentiment) in the create/edit data source dialog
2. When `sentiment` is selected, show multi-channel picker (checkboxes for all channels in the connected Discord account)
3. When `trades` is selected, hide channel selection (channels are picked at the pipeline level, existing behavior)
4. Show `source_type` badge on the data source list

### 1.5 Frontend: Ticker Sentiment Dashboard

**New file:** `services/dashboard-ui/src/pages/TickerSentiment.tsx`

**Tasks:**
1. Table with columns: Ticker (with WatchlistButton), Sentiment (colored badge), Score, Mentions (30m), Change % (with up/down arrow and color), Sparkline (Recharts sparkline, last 6 windows), # Trades, Eye icon
2. Polling with `useQuery` every 30 seconds. WebSocket listener for `sentiment-signals` to update in real-time
3. Filter bar: sentiment category multi-select, minimum mention count, time range dropdown (1h/3h/6h/24h), "Watchlist Only" toggle, search by ticker
4. Sorting: by mentions (desc), score (desc/asc), ticker (alpha), trend velocity
5. Eye icon opens a `Dialog` with:
   - AI summary at top (fetched from `/api/v1/sentiment/tickers/{ticker}/summary`, shows loading spinner while generating, cached 5 min)
   - Table of contributing messages (paginated, 20/page): Message Excerpt, Sentiment Badge, Channel/Server, Author, Timestamp
6. Add route in `App.tsx`: `/sentiment` → `TickerSentiment`
7. Add sidebar nav item with chart icon

### 1.6 Frontend: Sentiment Alerts Configuration

**New file:** `services/dashboard-ui/src/pages/SentimentAlerts.tsx` (or section within TickerSentiment)

**Tasks:**
1. List existing alert rules with toggle (active/inactive)
2. "Create Alert" dialog: ticker (optional, blank = any), condition type dropdown (threshold cross, direction flip, mention spike), condition parameters, delivery channels (notification, email), cooldown period
3. Delete alert rule

### 1.7 Backend: Sentiment API Routes

**New file:** `services/api-gateway/src/routes/sentiment.py`

**Tasks:**
1. `GET /api/v1/sentiment/tickers` -- query latest `ticker_sentiment` per ticker, join with trade count, include sparkline data (last 6 windows)
2. `GET /api/v1/sentiment/tickers/{ticker}/messages` -- paginated, sorted by timestamp DESC, filterable by date range
3. `GET /api/v1/sentiment/tickers/{ticker}/summary` -- collect last 20 messages, send to Ollama, cache result for 5 min in Redis
4. `GET /api/v1/sentiment/tickers/{ticker}/history` -- return last N aggregation windows for sparkline rendering
5. CRUD for `/api/v1/sentiment/alerts`
6. Register router in `main.py`

### Milestone 1 Deliverable

- User can create a "Sentiment" data source, select multiple Discord channels
- Messages from those channels are analyzed for tickers and sentiment (with spam filtering)
- Ticker Sentiment dashboard shows aggregated sentiment with sparklines, drill-down, and AI summary
- User can configure sentiment alerts (threshold, flip, spike)

### Acceptance Criteria

- [ ] Creating a data source with `source_type = "sentiment"` and 3 channels succeeds
- [ ] A Discord message "$AAPL looking very strong today" produces a sentiment_messages record with ticker=AAPL, sentiment=Bullish
- [ ] A bot message is filtered out and not stored
- [ ] Ticker sentiment dashboard shows AAPL with correct sentiment, mention count, and trend
- [ ] Eye icon shows AI summary and message list
- [ ] Sentiment alert fires when AAPL crosses "Very Bullish" threshold

---

## Milestone 2: Trending News Dashboard (Weeks 4-5)

**Goal:** News aggregator service, trending news dashboard with clustering and source configuration.

### 2.1 Backend: News Aggregator Service

**New service:** `services/news-aggregator/`

**Structure:**
```
services/news-aggregator/
├── main.py
├── requirements.txt           # httpx, rapidfuzz, aiokafka, asyncpg, apscheduler
├── Dockerfile
└── src/
    ├── adapters/
    │   ├── base.py            # Abstract adapter interface
    │   ├── finnhub.py         # Finnhub market news
    │   ├── newsapi.py         # NewsAPI.org
    │   ├── alpha_vantage.py   # Alpha Vantage news sentiment
    │   ├── reddit.py          # Reddit API (r/stocks, r/wallstreetbets, r/options)
    │   └── seekingalpha.py    # Seeking Alpha via RapidAPI
    ├── story_clusterer.py     # Fuzzy matching + cluster assignment
    ├── importance_ranker.py   # Composite ranking with watchlist bonus
    ├── retention.py           # Delete news > 48h
    └── service.py             # Scheduler + orchestration
```

**Tasks:**
1. Create adapter interface: `async def fetch_headlines(api_key: str) -> list[Headline]`
2. Implement adapters (each handles its API's quirks, rate limits, auth):
   - Finnhub: `/api/v1/news?category=general` (free tier: 60 calls/min)
   - NewsAPI: `/v2/top-headlines?category=business&language=en` (free: 100/day)
   - Reddit: PRAW library or Reddit API, fetch top/hot posts from finance subs
   - Alpha Vantage: `NEWS_SENTIMENT` function
   - Seeking Alpha: RapidAPI endpoint for trending articles
3. Create `story_clusterer.py` -- use `rapidfuzz.fuzz.token_sort_ratio` for dedup (>85% = same story). Assign `cluster_id`, mark primary headline (earliest or most important source), count `source_count`
4. Ticker tagging and sentiment scoring via shared modules (`shared/nlp/`)
5. Create `importance_ranker.py`: `importance = (source_count * 3) + (1 / minutes_ago) * 100 + (is_watchlist_ticker * 50) + abs(sentiment_score) * 20`
6. Create `retention.py` -- hourly cron, `DELETE FROM news_headlines WHERE created_at < now() - interval '48 hours'`
7. Create scheduler: asyncio loop, staggered polling (source 1 at :00, source 2 at :02, etc. every 10 min)
8. Error handling: if a source API fails, log error, update `news_connections.last_error`, skip that source, continue with others
9. Add `news-headlines` and `news-signals` topics to `scripts/init.sh`

### 2.2 Backend: News API Routes + Connection Management

**New file:** `services/api-gateway/src/routes/news.py`

**Tasks:**
1. `GET /api/v1/news/headlines` -- paginated (50/page), filterable by source/ticker/date, sorted by importance desc. Include cluster grouping info (for each primary headline, list secondary source_urls). Support `watchlist_only` query param
2. `GET /api/v1/news/connections` -- list user's news API connections with status
3. `POST /api/v1/news/connections` -- create with encrypted API key, validate by making test call
4. `PUT /api/v1/news/connections/{id}` -- update key or config
5. `DELETE /api/v1/news/connections/{id}` -- delete
6. DB migration for `news_headlines` and `news_connections` tables

### 2.3 Frontend: Trending News Page

**New file:** `services/dashboard-ui/src/pages/TrendingNews.tsx`

**Tasks:**
1. Compact list UI, each row: rank number, ticker badge(s) (clickable, navigates to `/sentiment`), headline text (link to source, opens new tab), sentiment icon (green up / red down / grey dash), time ago, source icon + label, "from N sources" badge (expandable)
2. Hover tooltip on headline: show first 150 chars of summary
3. "Today" / "Yesterday" date section headers
4. Auto-refresh every 10 minutes. Manual "Refresh" button. WebSocket listener for breaking headlines
5. Filter bar: source multi-select dropdown, ticker search, "Watchlist Only" toggle
6. "Configure Sources" button opens `NewsConnections` dialog/page
7. Pagination: "Load More" button or infinite scroll
8. Add route `/news` and sidebar nav item

### 2.4 Frontend: News Connections Management

**New file or component:** `services/dashboard-ui/src/components/NewsConnectionsDialog.tsx`

**Tasks:**
1. List of source connections: Finnhub, NewsAPI, Reddit, Alpha Vantage, Seeking Alpha
2. Each shows: status badge (active/inactive/error), last fetch time, last error message (if any)
3. Add/edit: input API key (masked), extra config (subreddits for Reddit, etc.)
4. Test button: validate API key by making a test call

### Milestone 2 Deliverable

- News aggregator pulls headlines from configured sources every 10 min
- Trending News dashboard shows ranked, sentiment-tagged, clustered headlines
- User can configure API keys for different news sources with validation
- Headlines cross-reference to sentiment dashboard via ticker badges

### Acceptance Criteria

- [ ] With Finnhub API key configured, headlines appear within 10 minutes
- [ ] Same-story headlines from multiple sources show "from N sources" badge
- [ ] Clicking a ticker badge navigates to that ticker's sentiment view
- [ ] Headlines older than 48h are automatically removed
- [ ] Source with invalid API key shows error status in connections UI

---

## Milestone 3: AI Trade Recommender + Unusual Whales (Weeks 6-8)

**Goal:** Option chain analyzer, AI trade recommender, sentiment/news as trade pipeline triggers with full audit trail.

### 3.1 Backend: Option Chain Analyzer Service

**New service:** `services/option-chain-analyzer/`

**Tasks:**
1. FastAPI service with endpoints: `POST /analyze`, `POST /analyze/strategy`, `GET /performance`, `GET /health`
2. `POST /analyze` input: `{ ticker, direction, preferences?: { min_delta?, max_expiry_days?, strategy_type? }, context?: string }`
3. Fetch option chain via UW client (shared module). If UW unavailable, return degraded response
4. Score each contract: `0.3 * oi_norm + 0.2 * delta_fit + 0.2 * iv_score + 0.15 * spread_score + 0.15 * gex_score`
5. Filter: expiry 14-45 days out (configurable), OI > 100, bid-ask spread < 20% of mid
6. Return **top 3** contracts with full metrics and individual rationale (via Ollama)
7. `POST /analyze/strategy` -- suggest multi-leg strategies (bull call spread for moderate bullish, straddle for expected volatility, iron condor for range-bound) based on IV percentile and direction strength
8. Log to `option_analysis_log` table
9. `GET /performance` -- query historical recommendations vs outcomes, compute accuracy %
10. Background job: `OutcomeTracker` runs daily, checks if past recommendations have expired or been closed, records P&L outcome

### 3.2 Backend: AI Trade Recommender Service

**New service:** `services/ai-trade-recommender/`

**Tasks:**
1. Kafka consumer for `sentiment-signals` and `news-signals`
2. Market hours check (shared module): reject or queue based on pipeline config
3. Deduplication: Redis key `trade:{user}:{ticker}:{direction}` with 30-min TTL
4. Signal interpreter: Ollama LLM prompt with user's threshold config. Default rules: sentiment must be Very Bullish/Very Bearish with 20+ mentions, OR news importance > 80th percentile
5. Conflict detection: compare sentiment direction with UW options flow. If conflicting, lower confidence by 30% and route to manual-confirm
6. Call option-chain-analyzer `/analyze` to get top 3 contracts
7. Select top contract (or route all 3 to user for manual selection if confidence < threshold)
8. Attach risk management: stop-loss (default -20%), take-profit (default +50%) from pipeline config
9. Build trade message with `originating_signal_id` reference
10. Publish to `parsed-trades` topic
11. Log EVERY decision (trade + no-trade) to `ai_trade_decisions` table with full reasoning chain

### 3.3 Backend: Pipeline Support for Sentiment/News Sources

**Files to modify:**
- `services/api-gateway/src/routes/pipelines.py` -- allow creating pipelines with sentiment/news data sources
- Pipeline creation includes `trigger_config` (thresholds) and `market_hours_mode`

**Tasks:**
1. Pipeline creation wizard accepts `data_source_type` = "sentiment" or "news"
2. Trigger config UI: min sentiment score, min mentions, min news importance, confidence threshold
3. Market hours mode selector: Regular / Extended / 24-7 / Queue-for-open
4. New pipelines from sentiment/news default to paper trading mode
5. `POST /api/v1/ai/decisions` -- paginated list of AI trade decisions for audit

### 3.4 Frontend: Pipeline Creation Update + AI Decisions Audit

**Files to modify:**
- `services/dashboard-ui/src/pages/TradePipelines.tsx` -- add Sentiment and News as data source options, trigger config fields, market hours selector

**New component:** AI Trade Decisions log page or section

**Tasks:**
1. In pipeline creation: new data source type options with trigger configuration
2. AI Decisions page/tab: table showing all AI trade decisions with columns: Time, Ticker, Signal Type, Decision (Trade/No Action/Manual), Confidence, Reason (expandable). Filter by decision type, ticker, date range

### Milestone 3 Deliverable

- Option chain analyzer returns top 3 contracts with metrics and multi-leg suggestions
- AI recommender converts sentiment/news signals into trades with risk management
- Full audit trail of every AI decision (trade and no-trade)
- Users can create pipelines triggered by sentiment or news with configurable thresholds
- Conflict detection when UW flow contradicts sentiment

### Acceptance Criteria

- [ ] `POST /analyze` with ticker=AAPL, direction=bullish returns 3 contracts with delta, OI, IV rank, rationale
- [ ] Sentiment signal "AAPL Very Bullish 50 mentions" triggers a trade in connected pipeline
- [ ] Trade has stop-loss and take-profit attached
- [ ] Conflicting signal (bullish sentiment + bearish UW flow) routes to manual-confirm with explanation
- [ ] `ai_trade_decisions` table contains entries for both traded and rejected signals
- [ ] Pipeline created from sentiment source defaults to paper trading

---

## Milestone 4: Visual Pipeline Builder (Weeks 8-10)

**Goal:** React Flow-based graphical pipeline editor with full node palette, configuration, versioning, deployment, and testing.

### 4.1 Frontend: Pipeline Editor Core

**New files:**
```
services/dashboard-ui/src/pages/AdvancedPipelines.tsx
services/dashboard-ui/src/pages/PipelineEditor.tsx
services/dashboard-ui/src/components/pipeline/
├── PipelineCanvas.tsx
├── NodePalette.tsx
├── NodeConfigPanel.tsx
├── PipelineToolbar.tsx
├── DebugPanel.tsx
├── VersionHistory.tsx
├── nodes/
│   ├── DataSourceNode.tsx
│   ├── ProcessingNode.tsx
│   ├── AIModelNode.tsx
│   ├── BrokerNode.tsx
│   └── ControlNode.tsx
├── edges/
│   └── AnimatedEdge.tsx
├── hooks/
│   ├── usePipelineState.ts
│   ├── usePipelineDeploy.ts
│   ├── usePipelineTest.ts
│   └── useAutoSave.ts
└── templates/
    └── defaultTemplates.ts
```

**Tasks:**
1. Install `@xyflow/react` package
2. Create `PipelineCanvas.tsx` -- React Flow with Controls, MiniMap, Background. Custom connection validation (only compatible types can connect)
3. Create `NodePalette.tsx` -- categorized sidebar (Data Sources blue, Processing green, AI purple, Execution orange, Control grey). Drag-to-canvas support
4. Create custom node components: distinct styling per category, input/output handles, config summary display on node face, status badge (configured/unconfigured/error)
5. Create `NodeConfigPanel.tsx` -- right sidebar, context-sensitive form per node type. Broker nodes pull from existing trading accounts, AI nodes pull from Model Hub
6. Create `PipelineToolbar.tsx` -- Save, Deploy, Test Run, Undo, Redo, Import JSON, Export JSON, Version History buttons
7. Create `DebugPanel.tsx` -- bottom panel (collapsible), shows test-run results at each node: input data, processing time, output data
8. Create `VersionHistory.tsx` -- side panel listing versions with timestamps, click to preview, "Revert" button
9. Undo/redo: custom hook tracking node/edge state changes, 50-step history, Ctrl+Z / Ctrl+Shift+Z
10. Node copy/paste: Ctrl+C / Ctrl+V with offset positioning
11. Auto-save: `useAutoSave.ts` hook, debounced PUT to backend every 2 seconds after change
12. Animated edges: pulse animation when pipeline is actively processing
13. Create 4 templates: "Discord Copy Trading", "Sentiment Options Trader", "News Alert Pipeline", "Multi-Source Merged Pipeline"

### 4.2 Backend: Advanced Pipeline API

**New file:** `services/api-gateway/src/routes/advanced_pipelines.py`

**Tasks:**
1. CRUD for `advanced_pipelines` table
2. `POST /deploy` -- validate graph (no disconnected nodes, all nodes configured, valid connection types), translate to backend config, update status to "active"
3. `POST /test` -- accept sample input JSON, simulate flow through nodes sequentially, return intermediate results per node
4. `GET /versions` -- list versions for a pipeline
5. `POST /versions/{v}/revert` -- copy version's JSON to current, increment version
6. `POST /import` -- upload JSON, create new pipeline
7. `GET /{id}/export` -- return pipeline JSON as downloadable file

### 4.3 Backend: Pipeline Execution Engine

**Files to modify/create:**
- `services/source-orchestrator/` -- extend to read advanced pipeline configs

**Tasks:**
1. Pipeline graph parser: convert JSON graph to execution DAG (topological sort)
2. For each node type, map to Kafka consumer/producer chain or HTTP call:
   - Data Source nodes → configure Kafka consumer on the appropriate topic
   - Processing nodes → transform message in-process
   - AI nodes → HTTP call to the relevant service (option-chain-analyzer, Ollama)
   - Broker nodes → publish to `approved-trades` or `parsed-trades`
   - Control flow → IF evaluates expression, routes to appropriate branch
3. Handle errors: if a node fails, log error, mark pipeline status as "error", notify user

### Milestone 4 Deliverable

- Users can visually build pipelines with drag-and-drop nodes on a React Flow canvas
- Full undo/redo, copy/paste, keyboard shortcuts
- Pipelines can be saved (with auto-save), versioned, deployed, and test-run
- Import/export pipeline JSON for sharing
- 4 pre-built templates available
- Live status indicators on nodes when deployed

### Acceptance Criteria

- [ ] Drag a Discord Source node and Alpaca Broker node onto canvas, connect them, deploy succeeds
- [ ] Undo/redo correctly reverts node additions and connections
- [ ] Test-run shows sample data flowing through each node in the debug panel
- [ ] Pipeline version history shows 3+ versions after edits, revert restores old state
- [ ] Export JSON → Import JSON produces identical pipeline
- [ ] Template "Sentiment Options Trader" loads with pre-configured nodes

---

## Milestone 5: Natural Language Strategy & Backtesting (Weeks 10-12)

**Goal:** NL-to-strategy agent with conversational clarification, enhanced backtesting with variations and benchmarks, strategy repository.

### 5.1 Backend: Strategy Agent Service

**New service:** `services/strategy-agent/`

**Structure:**
```
services/strategy-agent/
├── main.py
├── requirements.txt           # yfinance, matplotlib, numpy, pandas
├── Dockerfile
└── src/
    ├── parser.py              # LLM-based strategy parsing with clarification
    ├── data_fetcher.py        # Historical data retrieval (yfinance)
    ├── backtest_engine.py     # Strategy backtesting with costs
    ├── variation_tester.py    # Parameter variation testing
    ├── benchmark_comparer.py  # vs SPY, vs buy-and-hold
    ├── report_generator.py    # Metrics + charts + narrative
    └── deployer.py            # Convert strategy to pipeline
```

**Tasks:**
1. Create `parser.py`:
   - Ollama LLM prompt extracts structured strategy JSON from English
   - If ambiguous, return `{ needs_clarification: true, questions: [...], partial_strategy: {...} }`
   - After user answers questions via `/clarify`, re-parse with additional context
   - Show generated pseudocode/logic for transparency
2. Create `data_fetcher.py`:
   - Use `yfinance` for daily OHLCV (2 years)
   - Cache data locally in filesystem (invalidate after 24h)
   - For intraday strategies: attempt 1-min or 5-min data (limited to ~60 days by yfinance)
3. Create `backtest_engine.py`:
   - Extend `shared/backtest/` engine
   - Support: time-based triggers, price-based triggers, indicator-based triggers (MA crossover, RSI)
   - Apply transaction costs (commission + slippage from user config)
   - Compute: total return, CAGR, win rate, max drawdown, Sharpe, Sortino, Calmar, profit factor, avg trade duration
   - Generate equity curve data points
4. Create `variation_tester.py`:
   - Automatically identify 2-3 key parameters from strategy (e.g., MA period, entry timing, strike distance)
   - Test variations (e.g., 5/10/20 for MA period) and compare results in a table
5. Create `benchmark_comparer.py`:
   - Compare strategy returns vs buy-and-hold of underlying and vs SPY over same period
   - Compute alpha and beta
6. Create `report_generator.py`:
   - Compile all metrics into structured report
   - Generate charts: equity curve, drawdown chart, monthly returns heatmap (matplotlib → base64 PNG or JSON data for Recharts)
   - Use Ollama to generate narrative: "Your strategy generated X% return vs Y% for buy-and-hold. The main drawdown occurred during... The strategy tends to work best when..."
7. Create `deployer.py`:
   - Convert strategy definition to an advanced pipeline JSON
   - Map strategy components to appropriate node types

### 5.2 Backend: Strategy API Routes

**New file:** `services/api-gateway/src/routes/strategies.py`

**Tasks:**
1. `POST /api/v1/strategies` -- create strategy from NL description
2. `POST /api/v1/strategies/{id}/parse` -- parse description, return structured JSON or clarifying questions
3. `POST /api/v1/strategies/{id}/clarify` -- answer clarifying questions, update strategy
4. `POST /api/v1/strategies/{id}/backtest` -- trigger backtest (background), return job ID
5. `GET /api/v1/strategies/{id}` -- get strategy with results, variations, benchmarks
6. `GET /api/v1/strategies` -- list all strategies with key metrics and status
7. `POST /api/v1/strategies/{id}/deploy` -- create advanced pipeline from strategy
8. `DELETE /api/v1/strategies/{id}` -- delete strategy

### 5.3 Frontend: Strategy Builder UI

**New file:** `services/dashboard-ui/src/pages/StrategyBuilder.tsx`

**Tasks:**
1. Strategy input: large text area with placeholder examples ("Buy SPX call just above the price 5 minutes before market close", "Short stocks that go up 5 days in a row")
2. "Analyze Strategy" button → shows parsed strategy JSON (editable code view) and any clarifying questions (chat-like Q&A)
3. Transaction cost settings: commission input, slippage % input
4. "Run Backtest" button → progress bar with estimated completion, background execution
5. Results display:
   - Key metrics cards: Total Return, CAGR, Sharpe, Max Drawdown, Win Rate, Profit Factor
   - Equity curve chart (Recharts AreaChart) with benchmark overlay (SPY, buy-and-hold)
   - Monthly returns heatmap
   - Trade log table (date, action, ticker, price, P&L)
   - AI narrative explanation
   - Variation comparison table
   - Generated pseudocode/logic (collapsible)
6. "Deploy as Pipeline" button → creates advanced pipeline, redirects to editor
7. Strategy list view: table of all saved strategies with: name, return, Sharpe, drawdown, status, actions (re-test, deploy, delete)

### Milestone 5 Deliverable

- Users describe strategies in English, agent parses with conversational clarification
- Backtests run over 2 years with transaction costs, showing comprehensive report
- Automatic variation testing and benchmark comparison
- Strategy code transparency (show generated logic)
- Strategy repository listing all saved strategies
- One-click deployment to advanced pipeline

### Acceptance Criteria

- [ ] Strategy "Buy when 50-day MA crosses above 200-day MA for SPY" produces valid strategy JSON
- [ ] Ambiguous strategy "Buy calls before earnings" triggers clarifying questions
- [ ] Backtest produces report with equity curve, metrics, and AI narrative
- [ ] Variation test shows 3 different MA periods with comparative results
- [ ] Benchmark comparison shows strategy vs SPY and vs buy-and-hold
- [ ] "Deploy as Pipeline" creates a working advanced pipeline

---

## Milestone 6: Model Hub & Integration (Weeks 12-14)

**Goal:** Model Hub page, cross-feature integration, WebSocket real-time updates, UI polish.

### 6.1 Frontend: Model Hub

**New file:** `services/dashboard-ui/src/pages/ModelHub.tsx`

**Tasks:**
1. Grid/list of all registered models with: name, type badge, provider badge, status indicator, description
2. Model detail view: full description, input/output schema, performance metrics (if tracked), configuration
3. Ollama section: list downloaded models, "Download New Model" dialog (search Ollama registry), model size and memory info
4. Strategy models section: shows user-created strategies that can be used as pipeline nodes
5. Health status: green/yellow/red indicator per model based on periodic health checks

### 6.2 Cross-Feature Integration

**Tasks:**
1. Sentiment → News: clicking a ticker on the news dashboard shows its sentiment data (cross-link)
2. News → Sentiment: if a ticker in the sentiment dashboard has recent news, show a small news icon linking to filtered news view
3. Trades → Origin: when a trade is generated from sentiment/news AI, the trade detail shows the originating signal (link to AI decisions audit)
4. Pipeline builder → Model Hub: AI node configuration dropdowns pull from `model_registry`
5. Dashboard widget: optional mini-section showing top 5 watchlist tickers with sentiment badges
6. Notification integration: sentiment alerts, news breaking alerts, strategy backtest completion, AI trade decisions all flow through existing notification system

### 6.3 WebSocket Real-Time Push

**Files to modify:**
- `services/api-gateway/main.py` -- add WebSocket endpoint(s)
- `services/dashboard-ui/` -- WebSocket connection hook

**Tasks:**
1. API Gateway: new WebSocket endpoint `/ws/updates` (authenticated via token)
2. Subscribe to Kafka topics (`sentiment-signals`, `news-signals`) in the gateway, push to connected WebSocket clients
3. Frontend: `useWebSocket.ts` hook connecting on app load, dispatching updates to relevant query caches
4. Ticker Sentiment page: real-time row updates when sentiment changes
5. Trending News page: new breaking headlines appear at top with animation

### 6.4 UI Polish

**Tasks:**
1. Sidebar navigation: add new items with appropriate icons (Sentiment, News, Advanced Pipelines, Strategies, Model Hub, Watchlist)
2. Consistent styling across all new dashboards (color scheme, spacing, typography)
3. Loading states: skeleton loaders for all new pages
4. Error states: friendly error messages with retry buttons
5. Empty states: helpful "Get Started" guidance when no data (e.g., "Configure a sentiment source to see ticker sentiment here")
6. Mobile responsiveness: at least readable on tablet for dashboards

### 6.5 Data Migrations for Existing Users

**Tasks:**
1. Backfill `data_sources.source_type = 'trades'` for all existing records
2. Backfill `trade_pipelines.pipeline_type = 'standard'` for all existing records
3. Seed `model_registry` with system models

### Milestone 6 Deliverable

- Model Hub page showing all available models with health status
- Cross-feature navigation between sentiment, news, and trades
- Real-time WebSocket updates for sentiment and news
- Polished UI across all new pages
- Data migrations complete for existing users

### Acceptance Criteria

- [ ] Model Hub shows FinBERT, Mistral, Option Chain Analyzer with correct status
- [ ] Clicking AAPL ticker badge on news navigates to AAPL sentiment view
- [ ] Trade generated from sentiment shows originating signal in trade detail
- [ ] WebSocket push updates sentiment dashboard row without manual refresh
- [ ] All new pages have loading, error, and empty states
- [ ] Existing data sources show `source_type = "trades"` after migration

---

## Milestone 7: Testing, Deployment, Documentation (Weeks 14-16)

**Goal:** Comprehensive testing, Coolify deployment, documentation.

### 7.1 Testing

**Tasks:**
1. **Unit tests:**
   - Ticker extraction: edge cases (`$SPY`, `AMC`, false positives like `A`, `I`, `CEO`, `TD`)
   - Sentiment classification: mapping from FinBERT 3-class to 5-class
   - Market calendar: holidays, early close, pre/post market
   - Story clustering: fuzzy matching with various similarity levels
   - Contract scoring: ranking logic with mock data
   - Strategy parser: structured output from NL input
2. **Integration tests:**
   - Sentiment pipeline: Discord message → Kafka → sentiment-analyzer → DB → API → UI
   - News aggregation: mock API responses → aggregator → DB → API
   - AI trade recommender: sentiment signal → decision → parsed-trades
   - Option chain analyzer: mock UW data → contract ranking → top 3
   - Strategy backtest: NL input → parse → data fetch → backtest → report
3. **Frontend tests:**
   - React Flow pipeline builder: node creation, connection, save/load, undo/redo
   - Ticker Sentiment page: data rendering, filtering, eye icon modal
   - Trending News page: clustering display, source filtering
4. **End-to-end tests:**
   - Full flow: create sentiment source → send Discord message → see sentiment update → AI generates trade → trade appears in dashboard

### 7.2 Docker and Deployment

**Tasks:**
1. Create Dockerfiles for all 5 new services + verify Ollama
2. Update `docker-compose.yaml` with all new services
3. Update `scripts/init.sh` with new Kafka topics
4. Deploy to Coolify:
   - Verify VPS has 32GB+ RAM (existing + Ollama + new services)
   - If GPU available, configure Ollama GPU passthrough
   - Staged rollout: deploy infrastructure (Ollama) first, then services one-by-one
   - Health check all services after deployment
5. Run database migrations on production
6. Pull Mistral 7B model on production Ollama instance

### 7.3 Documentation

**Tasks:**
1. Update README with Phase 2 features overview
2. API documentation for all new endpoints (OpenAPI spec auto-generated by FastAPI)
3. User guide: how to configure sentiment sources, news connections, create advanced pipelines
4. Troubleshooting guide: common issues (Ollama OOM, UW rate limits, news API errors)

### Milestone 7 Deliverable

- All features tested and verified
- Deployed to Coolify with all services healthy
- Documentation updated

### Acceptance Criteria

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All new services healthy on Coolify (`/health` returns 200)
- [ ] Ollama loaded with Mistral 7B, responds within 30s
- [ ] Full end-to-end flow works: sentiment source → analysis → AI trade → execution
- [ ] Documentation covers all new features

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| VPS lacks resources for Ollama (8GB+ RAM) | Medium | High | Use Mistral 7B Q4 quantized (~4GB). If still insufficient, run Ollama on a separate $20/mo VPS. Monitor with `docker stats` |
| Unusual Whales API costs/rate limits | Medium | Medium | Cache aggressively (5-min Redis TTL). Allow user to input their own UW key. Implement fallback to basic quote data |
| FinBERT accuracy on Discord slang/sarcasm | High | Medium | Start with FinBERT baseline. Add rule-based overrides for common patterns ("to the moon" = bullish, "dead cat bounce" = bearish). Log low-confidence classifications for review |
| React Flow complexity for pipeline builder | Medium | Medium | Start with basic 5 node types. Defer complex control flow (IF/Merge) to iteration. Use React Flow Pro examples as reference |
| News API rate limits exhausted | Medium | Low | Stagger poll intervals per source. Cache responses. Show last-known data when rate-limited. Log failures to `news_connections.last_error` |
| LLM hallucination in strategy parsing | High | Medium | Always show parsed JSON for user verification. Add guardrails (validate JSON schema). Allow user to edit parsed strategy before backtesting |
| Historical options data unavailable for backtest | High | Medium | Start with equities-only backtesting. For options, approximate with Black-Scholes + historical IV. Note limitations in report |
| Ollama downtime impacts multiple features | Medium | High | Graceful fallback in `shared/llm/client.py`: return "AI summary unavailable" for summaries, skip AI interpretation for trade signals (fall back to rules-only). Health monitoring with alerts |
| Breaking changes in external APIs | Low | Medium | Adapter pattern isolates API-specific code. Each adapter has its own error handling. Version-pin API clients |

---

## Dependency Summary

```
Milestone 0 (Foundation) ─── No dependencies, runs first
    └── Produces: Ollama, shared modules, watchlist, DB migrations

Milestone 1 (Sentiment) ─── Depends on: M0 (shared NLP, LLM, Ollama)
    └── Produces: sentiment-analyzer, ticker dashboard, alerts

Milestone 2 (News) ─── Depends on: M0 (shared NLP, watchlist)
    ├── Can run in parallel with M1 (after M0 complete)
    └── Produces: news-aggregator, news dashboard

Milestone 3 (AI Trading) ─── Depends on: M0 (UW client, market calendar) + M1 + M2
    └── Produces: ai-trade-recommender, option-chain-analyzer

Milestone 4 (Pipeline Builder) ─── Depends on: M0 (model registry)
    ├── Can start in parallel with M3
    └── Produces: visual pipeline editor

Milestone 5 (Strategy/Backtest) ─── Depends on: M0 (Ollama)
    ├── Can start in parallel with M3/M4
    └── Produces: strategy agent, NL backtesting

Milestone 6 (Integration) ─── Depends on: M1 + M2 + M3 + M4 + M5
    └── Produces: Model Hub, WebSocket, cross-feature links, polish

Milestone 7 (Deploy) ─── Depends on: All previous milestones
    └── Produces: tested, deployed, documented system
```

---

## Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Visual pipeline library | `@xyflow/react` (React Flow) | MIT license, 35K+ stars, built for node-based editors, React-native, used by Stripe |
| LLM hosting | Ollama (self-hosted) | Privacy (no data leaves VPS), no per-token cost, supports Mistral/Llama |
| Primary LLM model | Mistral 7B | Best speed/quality ratio at 4GB, 24 tok/s (GPU), good instruction following |
| Financial sentiment model | FinBERT (ProsusAI/finbert) | Already in codebase (nlp-parser), proven for financial text, lightweight |
| News fuzzy dedup | rapidfuzz | Fast C-based fuzzy matching, MIT license, simple API |
| Historical data | yfinance | Free, reliable for daily OHLCV, widely used, no API key needed |
| Options data | Unusual Whales API | Comprehensive (flow, OI, GEX, Greeks), user already has access |
| Caching | Redis (existing) | Already in stack, perfect for sentiment aggregation, API response caching, dedup cooldowns |
| Market calendar | exchange_calendars | Comprehensive NYSE/NASDAQ schedules with holidays, well-maintained |
| Pipeline state mgmt | React Flow built-in hooks + custom undo stack | Simplest approach, avoid Redux overhead for pipeline-specific state |

---

## Phase 3 Preview (Not Implemented in Phase 2)

| Feature | Est. Effort | Dependencies |
|---|---|---|
| AI Trading Assistant Chatbot | 3-4 weeks | Ollama, RAG (ChromaDB), tool-calling LLM, all data APIs |
| Global Intelligence Dashboard | 2-3 weeks | All Phase 2 dashboards, portfolio data, WebSocket |
| Robinhood-Style Positions Dashboard | 2 weeks | Interactive charting library, broker position API |
| BackStrategy per Discord Channel | 2-3 weeks | Historical raw messages, backtest engine, analyst tracking |
| Strategy Marketplace | 4-5 weeks | Strategy models, user auth, payment integration, social features |
| Portfolio Risk Dashboard | 3-4 weeks | Multi-broker positions, Greeks calc, VaR model, IB integration |
| Multi-Source AI Predictive Signals | 4-5 weeks | Trained ML model (XGBoost/LSTM) on combined features, feature engineering |
