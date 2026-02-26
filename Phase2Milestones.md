# Phase 2 - Milestone Tracker

## Overview

| Milestone | Name | Timeline | Status | Dependencies |
|---|---|---|---|---|
| M0 | Foundation | Week 1 | Not Started | None |
| M1 | Sentiment Analysis | Weeks 2-3 | Not Started | M0 |
| M2 | Trending News Dashboard | Weeks 4-5 | Not Started | M0 |
| M3 | AI Trade Recommender + Unusual Whales | Weeks 6-8 | Not Started | M0, M1, M2 |
| M4 | Visual Pipeline Builder | Weeks 8-10 | Not Started | M0 |
| M5 | NL Strategy Backtesting | Weeks 10-12 | Not Started | M0 |
| M6 | Model Hub & Integration | Weeks 12-14 | Not Started | M1-M5 |
| M7 | Testing & Deployment | Weeks 14-16 | Not Started | All |

---

## M0: Foundation (Week 1)

**Goal:** Ollama infrastructure, shared NLP/LLM/market modules, Unusual Whales client, Watchlist, DB migrations for all Phase 2 tables.

### Deliverables

- [ ] Ollama service in docker-compose with health check and Mistral 7B
- [ ] `shared/llm/client.py` -- OllamaClient with generate, health, retry, fallback
- [ ] `shared/nlp/ticker_extractor.py` -- regex + known-list ticker detection
- [ ] `shared/nlp/sentiment_classifier.py` -- FinBERT wrapper, 3-class to 5-class mapping
- [ ] `shared/data/tickers.json` -- US equity ticker symbols
- [ ] `shared/market/calendar.py` -- market hours utilities (is_market_open, next_market_open, etc.)
- [ ] `shared/unusual_whales/client.py` -- authenticated HTTP client with Redis caching
- [ ] `shared/unusual_whales/models.py` -- Pydantic response models
- [ ] DB migrations: new tables (user_watchlist, model_registry, sentiment_messages, ticker_sentiment, sentiment_alerts, news_headlines, news_connections, advanced_pipelines, advanced_pipeline_versions, strategy_models, option_analysis_log, ai_trade_decisions), column additions to data_sources and trade_pipelines
- [ ] Watchlist API: GET/POST/DELETE `/api/v1/watchlist`
- [ ] WatchlistButton.tsx component + useWatchlist hook
- [ ] model_registry seeded with system models

### Acceptance Criteria

- [ ] Ollama responds to health check and lists mistral model
- [ ] OllamaClient.generate returns a response within 30s
- [ ] TickerExtractor correctly extracts AAPL from "$AAPL calls looking good"
- [ ] SentimentClassifier classifies "Apple earnings beat expectations" as Bullish or Very Bullish
- [ ] is_market_open() returns correct value for current time
- [ ] Watchlist API: POST adds ticker, GET returns it, DELETE removes it
- [ ] model_registry contains FinBERT and Mistral entries

### Key Files

| Action | File |
|---|---|
| Create | `shared/llm/__init__.py`, `shared/llm/client.py` |
| Create | `shared/nlp/__init__.py`, `shared/nlp/ticker_extractor.py`, `shared/nlp/sentiment_classifier.py` |
| Create | `shared/data/tickers.json` |
| Create | `shared/market/__init__.py`, `shared/market/calendar.py` |
| Create | `shared/unusual_whales/__init__.py`, `shared/unusual_whales/client.py`, `shared/unusual_whales/models.py`, `shared/unusual_whales/cache.py` |
| Modify | `shared/models/trade.py` -- add 12 new model classes |
| Modify | `services/api-gateway/main.py` -- add migrations for new tables/columns |
| Create | `services/api-gateway/src/routes/watchlist.py` |
| Create | `services/dashboard-ui/src/components/WatchlistButton.tsx` |
| Create | `services/dashboard-ui/src/hooks/useWatchlist.ts` |

---

## M1: Sentiment Analysis (Weeks 2-3)

**Goal:** Sentiment data source type, sentiment analyzer service, ticker sentiment dashboard with sparklines, alerts.

### Deliverables

- [ ] Data source UI supports `source_type` = sentiment with multi-channel selection
- [ ] `services/sentiment-analyzer/` microservice consuming raw-sentiment-messages, extracting tickers, classifying sentiment, aggregating 30-min windows
- [ ] Discord ingestor routes messages to correct Kafka topic based on source_type
- [ ] Ticker Sentiment dashboard page with sparklines, mention change %, eye icon drill-down with AI summary
- [ ] Sentiment alert rules configuration (threshold, flip, spike)
- [ ] API routes: `/api/v1/sentiment/tickers`, `/tickers/{ticker}/messages`, `/tickers/{ticker}/summary`, `/sentiment/alerts`

### Acceptance Criteria

- [ ] Creating sentiment data source with 3 channels succeeds
- [ ] Discord message "$AAPL looking strong" produces sentiment record with ticker=AAPL
- [ ] Bot messages are filtered out
- [ ] Dashboard shows ticker with correct sentiment, mentions, trend
- [ ] Eye icon shows AI summary and message list
- [ ] Alert fires when ticker crosses Very Bullish threshold

---

## M2: Trending News Dashboard (Weeks 4-5)

**Goal:** News aggregator service polling multiple APIs, trending news dashboard with clustering.

### Deliverables

- [ ] `services/news-aggregator/` with pluggable source adapters (Finnhub, NewsAPI, Reddit, Alpha Vantage, Seeking Alpha)
- [ ] Same-story clustering via fuzzy matching
- [ ] News API routes + connection management
- [ ] Trending News page with compact UI, sentiment icons, source badges, clustering
- [ ] News connections configuration UI
- [ ] Auto-delete of news older than 48 hours

### Acceptance Criteria

- [ ] With Finnhub API key configured, headlines appear within 10 minutes
- [ ] Same-story headlines show "from N sources" badge
- [ ] Clicking ticker badge navigates to sentiment view
- [ ] Headlines older than 48h are removed
- [ ] Invalid API key shows error in connections UI

---

## M3: AI Trade Recommender + Unusual Whales (Weeks 6-8)

**Goal:** Option chain analyzer, AI trade recommender, sentiment/news pipeline triggers, audit trail.

### Deliverables

- [ ] `services/option-chain-analyzer/` returning top 3 contracts with metrics and multi-leg suggestions
- [ ] `services/ai-trade-recommender/` converting sentiment/news signals to trades
- [ ] Conflict detection (sentiment vs UW flow)
- [ ] Market hours awareness
- [ ] Risk management (auto stop-loss/take-profit)
- [ ] AI trade decisions audit log
- [ ] Pipeline creation supports sentiment/news data sources with trigger config

### Acceptance Criteria

- [ ] POST /analyze returns 3 contracts with delta, OI, IV rank, rationale
- [ ] Sentiment signal "AAPL Very Bullish 50 mentions" triggers trade in connected pipeline
- [ ] Trade has stop-loss and take-profit attached
- [ ] Conflicting signals route to manual-confirm
- [ ] ai_trade_decisions contains entries for traded and rejected signals

---

## M4: Visual Pipeline Builder (Weeks 8-10)

**Goal:** React Flow graphical pipeline editor with node palette, configuration, versioning, deployment.

### Deliverables

- [ ] Advanced Pipelines list page
- [ ] Pipeline Editor with React Flow canvas, node palette, config panel, toolbar
- [ ] Custom node components (Data Source, Processing, AI, Broker, Control)
- [ ] Undo/redo, copy/paste, keyboard shortcuts
- [ ] Pipeline versioning with revert
- [ ] Test-run with debug panel
- [ ] Import/export JSON
- [ ] 4 pre-built templates

### Acceptance Criteria

- [ ] Drag two nodes onto canvas, connect them, deploy succeeds
- [ ] Undo/redo reverts node additions correctly
- [ ] Test-run shows data at each node in debug panel
- [ ] Version history shows 3+ versions, revert works
- [ ] Export then import produces identical pipeline

---

## M5: NL Strategy Backtesting (Weeks 10-12)

**Goal:** Strategy agent with conversational clarification, 2-year backtesting, variations, benchmarks.

### Deliverables

- [ ] `services/strategy-agent/` with NL parser, data fetcher, backtest engine, report generator
- [ ] Conversational clarification for ambiguous strategies
- [ ] Backtest report: metrics, equity curve, monthly heatmap, trade log, AI narrative
- [ ] Benchmark comparison (vs SPY, vs buy-and-hold)
- [ ] Automatic variation testing
- [ ] Strategy repository listing all saved strategies
- [ ] One-click deploy to advanced pipeline

### Acceptance Criteria

- [ ] "Buy when 50-day MA crosses above 200-day MA for SPY" produces valid strategy
- [ ] Ambiguous strategy triggers clarifying questions
- [ ] Report includes equity curve, Sharpe, drawdown, benchmark comparison
- [ ] Variation test shows 3 parameter combinations
- [ ] Deploy creates a working advanced pipeline

---

## M6: Model Hub & Integration (Weeks 12-14)

**Goal:** Model Hub page, cross-feature integration, WebSocket real-time, UI polish.

### Deliverables

- [ ] Model Hub page showing all registered models with health status
- [ ] Cross-feature navigation (sentiment ↔ news ↔ trades ↔ pipelines)
- [ ] WebSocket real-time push for sentiment and news updates
- [ ] Polished UI across all new pages (loading, error, empty states)
- [ ] Data migrations for existing users (backfill source_type, pipeline_type)
- [ ] Sidebar navigation updated with all new items

### Acceptance Criteria

- [ ] Model Hub shows FinBERT, Mistral, Option Chain Analyzer with correct status
- [ ] Clicking ticker on news navigates to sentiment view
- [ ] Trade from sentiment shows originating signal in detail
- [ ] WebSocket updates sentiment row without manual refresh
- [ ] All pages have loading, error, and empty states

---

## M7: Testing & Deployment (Weeks 14-16)

**Goal:** Comprehensive testing, Coolify deployment, documentation.

### Deliverables

- [ ] Unit tests for ticker extraction, sentiment classification, market calendar, story clustering
- [ ] Integration tests for sentiment pipeline, news aggregation, AI trade recommender
- [ ] Frontend tests for pipeline builder, sentiment dashboard
- [ ] End-to-end test: sentiment source → analysis → AI trade → execution
- [ ] All new services deployed to Coolify
- [ ] Ollama running with Mistral 7B on production
- [ ] Documentation updated

### Acceptance Criteria

- [ ] All unit and integration tests pass
- [ ] All new services healthy on Coolify (/health returns 200)
- [ ] Ollama responds within 30s on production
- [ ] Full end-to-end flow works in production
