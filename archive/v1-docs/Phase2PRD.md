# Phase 2 - Product Requirements Document (PRD)

## Executive Summary

Phase 2 transforms PhoenixTrade from a Discord-signal copy-trading bot into an AI-powered multi-source trading intelligence platform. The enhancements span eight major feature areas: real-time sentiment analysis across social channels, a trending news aggregation dashboard, AI-driven headlines-to-trades pipelines with Unusual Whales integration, a visual node-based pipeline builder, an automated options contract picker, a natural-language strategy backtesting agent, a Model Hub for centralizing AI components, and a Watchlist system that cross-references sentiment and news. Phase 3 (scoped but not built here) extends to a full AI trading assistant chatbot, global intelligence dashboard, Robinhood-style positions graph, and per-channel back-strategy models.

---

## 1. Sentiment Analysis Data Source & Ticker Sentiment Dashboard

### 1.1 Problem

Traders monitor multiple Discord channels, Reddit threads, and Twitter feeds for market chatter. Manually gauging whether crowd sentiment on a ticker is bullish or bearish is slow, error-prone, and prone to human bias. Discord in particular is messy -- conversations are fast, contextual, and laced with slang and sarcasm. Most sentiment tools target Twitter/Reddit and fail on Discord's conversational format. Important signals can be missed amidst noisy conversations, and there is no automated way to aggregate sentiment by stock ticker across social feeds.

### 1.2 Requirements

#### Data Source Configuration

| Requirement | Details |
|---|---|
| DS-S1 | Add a new `source_type = "sentiment"` for Data Sources (alongside existing `"trades"` type) |
| DS-S2 | Sentiment data sources connect to Discord and allow multi-channel selection (user picks N channels from their connected Discord accounts) |
| DS-S3 | Trade data sources retain current behavior; channels are configured at the pipeline level, not the data source level |
| DS-S4 | Sentiment data sources do NOT have trade pipelines; all sentiment sources feed into a single global sentiment analysis pipeline per user |
| DS-S5 | Support Reddit as a sentiment source connection: user provides subreddit names (e.g., r/wallstreetbets, r/stocks) and the system polls for new posts/comments |
| DS-S6 | Support Twitter/X as a sentiment source connection: user provides API keys and optionally specific handles or lists to follow |
| DS-S7 | Each sentiment source displays connection status (connected/disconnected/error) and last-sync timestamp |
| DS-S8 | Backfill existing data sources with `source_type = 'trades'` during migration |

#### Sentiment Processing

| Requirement | Details |
|---|---|
| SP-1 | Extract ticker symbols from each message using regex patterns (`$AAPL`, `TSLA`, standalone all-caps 1-5 letters) validated against a known ticker list (~8000 US equities + major ETFs + common crypto) |
| SP-2 | Messages mentioning multiple tickers contribute sentiment to all mentioned tickers |
| SP-3 | Messages with no identifiable ticker are ignored and not stored |
| SP-4 | Classify each message as: Very Bullish (+2), Bullish (+1), Neutral (0), Bearish (-1), Very Bearish (-2) |
| SP-5 | Use FinBERT (ProsusAI/finbert) as the primary classifier; the existing NLP parser service already loads it. Map FinBERT's 3-class output (positive/negative/neutral) to 5-class scale using confidence thresholds: positive with score > 0.85 = Very Bullish, > 0.6 = Bullish; negative with score > 0.85 = Very Bearish, > 0.6 = Bearish; otherwise Neutral |
| SP-6 | Aggregate sentiment per ticker using a 30-minute rolling window: compute weighted average score and map to category |
| SP-7 | Store individual message-level sentiment in a new `sentiment_messages` table |
| SP-8 | Store aggregated ticker sentiment in a new `ticker_sentiment` table, updated every 30 minutes |
| SP-9 | Spam/noise filtering: ignore messages from bot users (Discord `is_bot` flag), messages shorter than 5 characters, and duplicate messages (same content + same author within 1 minute) |
| SP-10 | Track sentiment trend: store the previous window's score alongside the current to calculate direction and velocity of change |
| SP-11 | Publish aggregated sentiment to `sentiment-signals` Kafka topic for downstream consumers (AI trade recommender, alerts, WebSocket push) |

#### Ticker Sentiment Dashboard

| Requirement | Details |
|---|---|
| TD-1 | New page: "Ticker Sentiment" in the sidebar navigation |
| TD-2 | Table/grid showing: Ticker, Sentiment Category (colored icon: dark green = Very Bullish, light green = Bullish, grey = Neutral, orange = Bearish, red = Very Bearish), Sentiment Score, Mention Count (30m), Mention Change % (vs previous 30m window, with up/down arrow), Sparkline (last 6 windows = 3 hours of sentiment trend), # Trades (from all trade pipelines), Eye icon |
| TD-3 | Auto-refresh every 30 seconds via polling |
| TD-4 | Real-time WebSocket push: when a new `sentiment-signals` event arrives, update the affected ticker row immediately without waiting for poll |
| TD-5 | Clicking the Eye icon opens a modal with: (a) AI-generated summary at top explaining sentiment drivers, (b) table of all contributing messages with columns: Message Excerpt, Sentiment Badge, Source Channel/Server, Author, Timestamp. Table is paginated (20 per page) and sortable by timestamp |
| TD-6 | AI summary generated by local LLM (Ollama) given the last 20 messages for the ticker. Cached for 5 minutes to avoid excessive LLM calls |
| TD-7 | Filtering: by sentiment category (multi-select), minimum mention count, time range (last 1h / 3h / 6h / 24h) |
| TD-8 | Sorting: by mentions (desc), by score (desc/asc), by ticker (alpha), by trend velocity |
| TD-9 | Search bar to filter tickers by name |
| TD-10 | "Watchlist Only" toggle: when enabled, show only tickers in the user's watchlist (see Section 8) |

#### Sentiment Alerts

| Requirement | Details |
|---|---|
| SA-1 | Users can configure sentiment alert rules per ticker or globally |
| SA-2 | Alert conditions: sentiment crosses a threshold (e.g., "Alert me if any ticker turns Very Bearish"), sentiment flips direction (e.g., "Bullish to Bearish within 1 hour"), mention spike (e.g., "50+ mentions in 30 minutes for any ticker") |
| SA-3 | Alert delivery: in-app notification bell (existing), email, and optionally Discord webhook |
| SA-4 | Alert cooldown: do not re-alert for the same ticker + condition within a configurable period (default 1 hour) |
| SA-5 | Alerts stored in `sentiment_alerts` table with user-defined rules; triggered alerts logged in `notification_log` |

### 1.3 User Stories

- As a trader, I want to configure Discord channels as "sentiment sources" so that their messages are analyzed for ticker mentions and sentiment without triggering trades.
- As a trader, I want to see a dashboard showing which tickers are being discussed and whether the crowd is bullish or bearish, with sparkline trends and mention velocity.
- As a trader, I want to click on a ticker and see all the messages that contributed to its sentiment score, along with an AI explanation of why sentiment is what it is.
- As a trader, I want to set alerts for sentiment extremes (e.g., "alert me if TSLA sentiment turns Very Bearish") so I can react quickly.
- As a trader, I want to filter the sentiment dashboard to only show tickers in my watchlist.

---

## 2. Top Trending News Dashboard

### 2.1 Problem

Market-moving news breaks across diverse sources -- Seeking Alpha, Yahoo Finance, Twitter, Reddit, financial blogs. Monitoring all of them is impossible manually. Missing a key headline (FDA approval, earnings surprise, CEO tweet) means missing trades. Traders need a single aggregated view of the most important headlines, tagged to tickers and color-coded by sentiment impact.

### 2.2 Requirements

#### News Aggregation

| Requirement | Details |
|---|---|
| NA-1 | New microservice: `news-aggregator` that polls multiple APIs every 10 minutes |
| NA-2 | Supported sources (configurable via API keys): Finnhub Market News (free tier), Alpha Vantage News Sentiment, NewsAPI.org, Reddit (r/stocks, r/wallstreetbets, r/options), Seeking Alpha (RapidAPI) |
| NA-3 | Each news item normalized to: headline, summary (first 200 chars if available), source_name, source_url, source_icon, tickers[], sentiment_score, sentiment_label, published_at, importance_score, cluster_id |
| NA-4 | Ticker extraction from headlines and summaries using same ticker detection as sentiment (regex + known list) |
| NA-5 | Sentiment/impact classification per headline: Positive (green), Negative (red), Neutral (grey) using FinBERT on headline text |
| NA-6 | Same-story clustering: group headlines about the same event using fuzzy title matching (>85% similarity). Show the primary headline with a "Reported by N sources" badge. Clicking expands to show all source links |
| NA-7 | Data retention: auto-delete news older than 48 hours via hourly cron job |
| NA-8 | Importance scoring: `importance = (source_count * 3) + recency_minutes_inverse + ticker_watchlist_bonus + sentiment_magnitude` |
| NA-9 | Graceful degradation: if a source API returns errors or rate-limits, log the failure, skip that source for this cycle, and serve cached data. Show a subtle indicator on the dashboard that a source is temporarily unavailable |

#### News Dashboard UI

| Requirement | Details |
|---|---|
| ND-1 | New page: "Trending News" in the sidebar |
| ND-2 | Compact, one-line-per-item design inspired by Seeking Alpha's trending feed |
| ND-3 | Each row shows: Rank #, Ticker badge(s) (colored), Headline (clickable link to original source, opens in new tab), Sentiment icon (green up-arrow / red down-arrow / grey dash), Time ago ("5m ago"), Source icon + label (e.g., Finnhub logo, Reddit icon) |
| ND-4 | Hover tooltip on headline shows first 150 chars of article summary (if available from API) |
| ND-5 | Same-story grouping: clustered headlines show "from N sources" badge; clicking expands to list all sources with links |
| ND-6 | "Today" / "Yesterday" date demarcation headers between sections |
| ND-7 | Auto-refresh every 10 minutes. Manual "Refresh Now" button. WebSocket push for breaking headlines (importance > high threshold) |
| ND-8 | Filters: by source (multi-select dropdown), by ticker, "Watchlist Only" toggle |
| ND-9 | Search box to filter by ticker or keyword |
| ND-10 | Pagination: show 50 headlines per page with infinite scroll or "Load More" |
| ND-11 | Configuration tab: "News Connections" where user inputs API keys for each source. Show connection status (active/inactive/error). Allow enabling/disabling individual sources |
| ND-12 | Cross-reference: clicking a ticker badge navigates to that ticker's sentiment detail view (if sentiment data exists) |
| ND-13 | "Quick Trade" button (optional): next to high-sentiment headlines, a small button to initiate a trade pipeline for that ticker (opens pipeline creation pre-filled with ticker) |
| ND-14 | Ranked by composite importance score with trending items (most sources, most recent) at top |

### 2.3 User Stories

- As a trader, I want a single dashboard showing the top trending financial headlines from multiple sources, tagged to tickers, so I don't miss market-moving news.
- As a trader, I want each headline color-coded by sentiment impact (positive/negative) so I can quickly assess whether news is good or bad for a stock.
- As a trader, I want to configure which news sources to pull from by providing my own API keys.
- As a trader, I want to hover over a headline to see a brief summary without leaving the page.
- As a trader, I want same-story headlines grouped together so I can see how widely a story is being reported.
- As a trader, I want to click a ticker in the news to see its sentiment analysis from social channels.
- As a trader, I want breaking headlines pushed to me in real-time, not just every 10 minutes.

---

## 3. Sentiment & News as Data Sources -- Headlines-Based Trading

### 3.1 Problem

Sentiment signals and news headlines provide valuable intel, but they are not actionable trade signals by themselves. Traders need an automated way to convert "AAPL sentiment turned Very Bullish" or "FDA approves XYZ drug" into concrete, executable trade orders. The gap requires an AI decision engine that interprets the signal, determines if it warrants a trade, and uses options flow data (Unusual Whales) to pick the optimal contract. The challenge is also ensuring proper risk management: avoiding overtrading, respecting market hours, and attaching sensible stop-loss/take-profit levels.

### 3.2 Requirements

#### Data Source as Pipeline Trigger

| Requirement | Details |
|---|---|
| HBT-1 | Allow "Sentiment" and "Trending News" as data source types when creating a Trade Pipeline |
| HBT-2 | System creates default internal data sources for "Sentiment Signals" and "News Signals" that emit events when thresholds are met |
| HBT-3 | Sentiment trigger: emit when a ticker's sentiment changes to Very Bullish or Very Bearish with >= N mentions in 30 minutes. N is user-configurable (default: 20) |
| HBT-4 | News trigger: emit when a headline with importance score above threshold appears with clear positive/negative sentiment. Threshold is user-configurable |
| HBT-5 | User-configurable trigger thresholds on the pipeline configuration: minimum sentiment score, minimum mention count, minimum news importance, required sentiment direction |
| HBT-6 | Market hours awareness: by default, only trigger trades during US market hours (9:30 AM - 4:00 PM ET). Option to enable pre-market (4:00 AM) and after-hours (8:00 PM) trading. Option to queue trades for next market open if signal arrives after hours |

#### AI Trade Recommender (MCP Server)

| Requirement | Details |
|---|---|
| ATR-1 | New service/module: `ai-trade-recommender` that acts as a pipeline processing node |
| ATR-2 | Receives input: sentiment/news event with ticker, sentiment, context messages |
| ATR-3 | Determines action: BUY (calls/stock) for bullish, BUY (puts) for bearish, or NO ACTION |
| ATR-4 | Queries Unusual Whales API for the ticker: top contracts by open interest, options flow direction, GEX levels |
| ATR-5 | Selects optimal contract: prefer ATM or 1-strike OTM, 2-4 week expiry, high OI, reasonable bid-ask spread |
| ATR-6 | Outputs structured trade signal: ticker, strike, expiration, option_type, action, quantity, confidence_score, rationale, originating_signal_id (reference to the sentiment/news event that triggered it) |
| ATR-7 | Deduplication: do not trade the same ticker+direction within a configurable cooldown window (default 30 min, stored in Redis) |
| ATR-8 | User can configure: auto-execute vs manual-confirm mode, position size limits, confidence threshold (minimum confidence to auto-execute) |
| ATR-9 | Risk management on generated trades: attach default stop-loss (configurable, default -20%) and take-profit (configurable, default +50%) to every AI-generated trade |
| ATR-10 | Conflicting signal detection: if UW options flow shows heavy put buying but sentiment is bullish, flag the discrepancy in the rationale and lower confidence score. Do not auto-execute conflicting signals (route to manual-confirm) |
| ATR-11 | Paper trading first: new sentiment/news pipelines default to paper trading mode. User must explicitly switch to live after reviewing initial performance |
| ATR-12 | Audit trail: every AI trade decision (including NO ACTION decisions) is logged with the full reasoning chain: signal input, LLM interpretation, UW data snapshot, contract selection logic, final decision. Stored in `ai_trade_decisions` table |

#### Unusual Whales Integration

| Requirement | Details |
|---|---|
| UW-1 | New shared module: `shared/unusual_whales/client.py` wrapping the UW REST API |
| UW-2 | Endpoints used: Options Flow, Open Interest Explorer, GEX/DEX data, Market Tide, IV Rank |
| UW-3 | API key stored in system config or per-user (encrypted). Support for UW subscription tiers (delayed data for lower tiers) |
| UW-4 | Rate limiting (respect UW rate limits) and Redis caching (cache OI/chain data for 5 minutes) |
| UW-5 | Fallback: if UW API is unavailable, fall back to broker API (Alpaca) for basic quote data; skip options-specific analysis and log degradation |

### 3.3 User Stories

- As a trader, I want to create a pipeline that automatically trades when sentiment for a ticker turns Very Bullish, using options contracts selected via Unusual Whales data.
- As a trader, I want the AI to explain why it chose a particular options contract (strike, expiry, OI) so I can understand and trust the decision.
- As a trader, I want to configure minimum thresholds for when sentiment/news should trigger trades (e.g., at least 30 mentions, score > 1.5).
- As a trader, I want AI-generated trades to have automatic stop-loss and take-profit levels attached.
- As a trader, I want to see a full audit trail of why the AI decided to trade or not trade on a particular signal.
- As a trader, I want the system to warn me when options flow data conflicts with sentiment direction.
- As a trader, I want sentiment/news pipelines to start in paper trading mode so I can evaluate before going live.

---

## 4. Graphical Pipeline Builder UI (Advanced Trade Pipelines)

### 4.1 Problem

The current pipeline creation is a step-by-step wizard. As pipelines grow more complex (multiple data sources, AI nodes, branching logic, multiple execution targets), a linear form is limiting. Users cannot visualize data flow, cannot branch or merge streams, and cannot easily modify complex strategies. With the addition of new components (sentiment sources, AI models, option chain analyzers), the need for flexible visual composition grows.

### 4.2 Requirements

#### Visual Editor

| Requirement | Details |
|---|---|
| VPB-1 | New page: "Advanced Trade Pipelines" tab in sidebar |
| VPB-2 | Built using React Flow (`@xyflow/react`) for the canvas |
| VPB-3 | Left panel: node palette with draggable node types, organized by category with collapsible sections |
| VPB-4 | Main canvas: drag-drop nodes, connect with edges, zoom/pan, minimap in bottom-right corner |
| VPB-5 | Right panel: node configuration form (appears on node click/select), contextual to node type |
| VPB-6 | Undo/redo: Ctrl+Z / Ctrl+Shift+Z with at least 50-step history |
| VPB-7 | Node copy/paste: Ctrl+C / Ctrl+V to duplicate nodes with their configuration |
| VPB-8 | Canvas annotations: ability to add text labels/notes directly on the canvas for documentation |
| VPB-9 | Keyboard shortcuts: Delete to remove selected, Ctrl+A to select all, Ctrl+S to save |

#### Node Types

| Category | Node Types | Icon Color |
|---|---|---|
| Data Sources | Discord Trade Source, Sentiment Source, News Source, Chat Source, Scheduled Trigger (cron), Webhook Trigger | Blue |
| Processing | Trade Parser, Sentiment Analyzer, Custom Filter (expression-based), Data Transform | Green |
| Models/AI | LLM Node (Ollama), AI Trade Recommender, Option Chain Analyzer, Strategy Model Node | Purple |
| Execution | Alpaca Broker, Interactive Brokers (future), Paper Trade, Notification/Alert, Email Alert | Orange |
| Control Flow | IF/Condition (expression), Merge (combine streams), Delay (wait N seconds), Rate Limiter, Split (broadcast to multiple outputs) | Grey |

#### Node Configuration

| Requirement | Details |
|---|---|
| VPB-10 | Each node type has a specific configuration form in the right panel |
| VPB-11 | Data Source nodes: select from existing data sources, configure channels, set polling interval |
| VPB-12 | AI Model nodes: select model from Model Hub (Section 7), edit prompt template, set temperature/parameters |
| VPB-13 | Broker nodes: select trading account, configure order type (market/limit), default position size, stop-loss/take-profit |
| VPB-14 | Control nodes: IF node has an expression editor (e.g., `sentiment_score > 1.5 AND mentions > 20`), Delay node has duration input |
| VPB-15 | Each node shows a mini status badge: configured (green check), unconfigured (yellow warning), error (red X) |

#### Pipeline Persistence & Lifecycle

| Requirement | Details |
|---|---|
| VPB-16 | Pipeline stored as JSON: `{ nodes: [...], edges: [...], config: {...}, version: int }` |
| VPB-17 | New DB table `advanced_pipelines` with columns: id, user_id, name, description, pipeline_json, status, version, template_name, last_run_at, created_at, updated_at |
| VPB-18 | Pipeline versioning: each save increments version. User can view version history and revert to any previous version |
| VPB-19 | Pipeline deployment: user clicks "Deploy" to activate; backend validates the graph (no disconnected nodes, valid connections, all nodes configured) and translates to Kafka consumer/producer wiring |
| VPB-20 | Pipeline simulation: "Test Run" button that pushes sample data through and shows output at each node in a debug panel below the canvas |
| VPB-21 | Live status indicators on nodes when pipeline is deployed: green pulse = receiving data, grey = idle, red = error. Data count badge showing messages processed |
| VPB-22 | Import/export: download pipeline as JSON file, upload JSON to import. Useful for sharing and backup |
| VPB-23 | Pre-built templates: "Discord Copy Trading", "Sentiment-Based Options Trader", "News Alert Pipeline", "Multi-Source Merged Pipeline" |

### 4.3 User Stories

- As a trader, I want to visually build a pipeline by dragging data sources, AI models, and broker nodes onto a canvas and connecting them, like building a workflow in n8n.
- As a trader, I want to test my pipeline with sample data before deploying it live, seeing the data at each step.
- As a trader, I want to use pre-built templates as starting points for common strategies.
- As a trader, I want to undo/redo changes and revert to previous versions of my pipeline.
- As a trader, I want to see live status on each node when my pipeline is running (is it receiving data? any errors?).
- As a trader, I want to export my pipeline as a file to share it or back it up.
- As a trader, I want to add notes/annotations on the canvas to document what each section does.

---

## 5. Option Chain Analysis Model

### 5.1 Problem

When a trade signal says "bullish on AAPL", the trader still needs to decide: which strike? which expiry? which contract? This requires analyzing open interest, volume, Greeks, implied volatility, GEX levels, and technical indicators. Doing this manually for every signal is slow and error-prone. Furthermore, Alpaca does not support options trading, so Interactive Brokers integration is needed for actual options execution.

### 5.2 Requirements

| Requirement | Details |
|---|---|
| OCA-1 | New service: `option-chain-analyzer` (MCP Server pattern) |
| OCA-2 | Input: ticker, direction (bullish/bearish), optional context message, optional preferences (min delta, max expiry days, strategy type) |
| OCA-3 | Fetches: full option chain from Unusual Whales or broker API, current underlying price, 52-week range, technical indicators (RSI, 50/200 MA), GEX levels, IV rank/percentile |
| OCA-4 | Analysis: ranks contracts by composite score = f(OI, volume, delta, IV percentile, bid-ask spread, GEX proximity) |
| OCA-5 | Returns top 3 contracts (not just 1) with rationale for each, ranked by composite score. User/pipeline can select which to use |
| OCA-6 | Output metrics per contract: strike, expiry, option_type, delta, gamma, theta, vega, IV rank, breakeven price, probability of profit (from delta approximation), max gain/loss, current bid/ask, OI, volume, GEX context |
| OCA-7 | Strategy suggestions: beyond single-leg, suggest relevant multi-leg strategies when appropriate. E.g., for a bullish play, also suggest a bull call spread (lower cost, defined risk). For neutral high-IV situations, suggest iron condors |
| OCA-8 | Pluggable into any pipeline as a processing node (via React Flow pipeline builder) |
| OCA-9 | Can be called from the AI chatbot for manual queries ("What option should I buy for TSLA?") and from the dashboard via a "Analyze Options" button on any ticker |
| OCA-10 | Historical tracking: store all recommendations in `option_analysis_log` table. After expiration or close, record actual outcome (P&L). Use outcome data to track recommendation accuracy over time |
| OCA-11 | Learning dashboard: show accuracy metrics -- % of recommendations that were profitable, average P&L, best/worst picks. Visible under a "Model Performance" section |
| OCA-12 | User feedback: when a recommendation is overridden by the user (they pick a different contract), log the override for future model improvement |

### 5.3 User Stories

- As a trader, I want the system to suggest the top 3 options contracts when a trade signal is generated, with metrics and rationale for each.
- As a trader, I want to see multi-leg strategy suggestions (spreads, straddles) when they make sense for the situation.
- As a trader, I want to track how accurate the option recommendations have been historically.
- As a trader, I want to manually ask "What option should I trade for GOOGL?" and get an AI-powered recommendation.

---

## 6. Natural Language Strategy Definition & Backtesting

### 6.1 Problem

Traders have strategy ideas in their heads but lack the coding skills to formalize and backtest them. Even skilled traders spend hours writing backtest code. The platform needs an agent that takes a plain English strategy description, extracts features and rules, fetches historical data, runs a 2-year backtest, and produces a detailed performance report. The process should be conversational -- the agent should ask clarifying questions when the description is ambiguous.

### 6.2 Requirements

| Requirement | Details |
|---|---|
| NLS-1 | New UI section under "Backtesting": "Strategy from Description" with a large text area for plain English input and example placeholders |
| NLS-2 | LLM agent (Ollama) parses the description to extract: instrument, entry conditions, exit conditions, timing, risk parameters, position sizing |
| NLS-3 | Agent generates structured strategy definition (JSON) from the parsed description. JSON is displayed in an editable code view so the user can review and adjust before backtesting |
| NLS-4 | Conversational clarification: if the description is ambiguous, the agent asks clarifying questions via a chat-like interface embedded in the strategy builder. E.g., "You mentioned buying calls 'just above the price' -- should I use the nearest OTM strike or 1-2 strikes above?" |
| NLS-5 | Data retrieval: fetch historical price data (daily OHLCV) from Yahoo Finance (yfinance) for relevant tickers, up to 2 years. For intraday strategies, fetch intraday data if available (1-min or 5-min bars) |
| NLS-6 | Backtest engine: run the strategy on historical data using the existing `shared/backtest/` module or a new engine. Support event-driven strategies (time-based triggers, price-based triggers, indicator-based triggers) |
| NLS-7 | Background execution: run in background, show progress bar with estimated completion, send notification on completion |
| NLS-8 | Report output: total return, annualized return, CAGR, win rate, max drawdown, Sharpe ratio, Sortino ratio, Calmar ratio, total trades, average trade duration, average win/loss size, profit factor |
| NLS-9 | Report visualizations: equity curve chart, drawdown chart, monthly returns heatmap, trade distribution histogram, win/loss scatter plot |
| NLS-10 | Benchmark comparison: always show strategy performance vs buy-and-hold of the underlying, and vs S&P 500 (SPY) over the same period. Show alpha and beta |
| NLS-11 | AI-generated narrative explaining performance ("Strategy profits from overnight gaps. Largest losses occur during low-volatility periods. The strategy underperforms buy-and-hold but with significantly lower drawdown.") |
| NLS-12 | Transaction cost settings: user can configure commission per trade (default $0), slippage estimate (default 0.1%), and these are factored into the backtest |
| NLS-13 | Strategy variation testing: after initial backtest, the agent automatically tests 2-3 variations of key parameters (e.g., different entry timing, different strike selection) and shows comparative results in a table |
| NLS-14 | Strategy code transparency: show the generated Python pseudocode or logic that the backtest engine executed, so the user can verify the interpretation |
| NLS-15 | Option to "Deploy as Pipeline" to create an advanced pipeline from the backtested strategy |
| NLS-16 | Strategy stored in `strategy_models` table for reuse in pipelines and in the Model Hub |
| NLS-17 | Strategy repository: a list view showing all saved strategies with their key metrics (return, Sharpe, drawdown), status (draft/tested/deployed), and actions (re-test, deploy, delete) |

### 6.3 User Stories

- As a trader, I want to describe a strategy in plain English (e.g., "Buy SPX call just above price 5 minutes before market close") and have the system automatically backtest it over 2 years and show me the results.
- As a trader, I want the agent to ask me clarifying questions when my strategy description is ambiguous.
- As a trader, I want to see how my strategy compares to simply buying and holding the stock or the S&P 500.
- As a trader, I want the agent to automatically test a few variations of my strategy parameters and show which works best.
- As a trader, I want to see the logic the system used to backtest my strategy so I can verify it interpreted my description correctly.
- As a trader, I want to deploy a successful backtested strategy as a live pipeline with one click.
- As a trader, I want to browse all my saved strategies with their performance metrics.

---

## 7. Model Hub

### 7.1 Problem

The platform has multiple AI/ML models (FinBERT, Ollama LLMs, Option Chain Analyzer, custom strategy models, future user-trained models) but no central place to manage, discover, or configure them. When building pipelines, users need to select which model to use for a given node. Without a registry, model management is fragmented and opaque.

### 7.2 Requirements

| Requirement | Details |
|---|---|
| MH-1 | New page: "Model Hub" in the sidebar navigation |
| MH-2 | Model registry: central catalog of all available models with metadata: name, description, type (sentiment, trade-recommendation, option-analysis, strategy, general-LLM), input schema, output schema, status (available/loading/error), performance metrics |
| MH-3 | System-provided models (pre-registered): FinBERT Sentiment Classifier, AI Trade Recommender, Option Chain Analyzer, Strategy Parser |
| MH-4 | User-created models: strategy models created via NL backtesting (Section 6) automatically appear in the Model Hub |
| MH-5 | Ollama model management: show which Ollama models are downloaded/available, allow downloading new models from the Ollama registry, show model size and memory requirements |
| MH-6 | Model cards: each model has a detail page showing: description, input/output schema, usage instructions, performance history (if tracked), configuration options |
| MH-7 | Pipeline integration: when configuring an AI/Model node in the pipeline builder, the node's dropdown pulls from the Model Hub registry |
| MH-8 | Model health monitoring: periodic health checks on all models (is FinBERT loaded? is Ollama responding? is UW API accessible?). Show status on the hub page |
| MH-9 | Model DB table: `model_registry` with columns: id, name, description, model_type, provider (system/user/ollama), config_json, input_schema, output_schema, status, performance_metrics, created_at |

### 7.3 User Stories

- As a trader, I want to see all available AI models in one place with their descriptions, capabilities, and health status.
- As a trader, I want to select models from the Model Hub when configuring pipeline nodes.
- As a trader, I want my backtested strategy models to automatically appear in the Model Hub so I can use them in pipelines.
- As a trader, I want to manage which Ollama LLM models are downloaded and available on my server.

---

## 8. Watchlist

### 8.1 Problem

Multiple features reference "My Watchlist" (sentiment filtering, news filtering, importance scoring) but no watchlist system exists. Users need a simple way to track tickers they care about, which then cross-references with sentiment, news, and trades across the platform.

### 8.2 Requirements

| Requirement | Details |
|---|---|
| WL-1 | Users can add/remove tickers to their watchlist from any page (quick-add button on sentiment dashboard, news dashboard, trade detail) |
| WL-2 | Watchlist stored in `user_watchlist` table: user_id, ticker, added_at |
| WL-3 | Watchlist accessible via API: `GET/POST/DELETE /api/v1/watchlist` |
| WL-4 | Watchlist integration: sentiment dashboard "Watchlist Only" toggle, news dashboard "Watchlist Only" toggle, news importance scoring gives bonus to watchlist tickers |
| WL-5 | Optional: watchlist widget on the main Dashboard page showing quick-glance sentiment + last price for watched tickers |

### 8.3 User Stories

- As a trader, I want to maintain a list of tickers I'm watching and filter sentiment and news dashboards to only show those tickers.
- As a trader, I want to quickly add a ticker to my watchlist from any page where I see it.

---

## 9. Market Hours & Trading Calendar

### 9.1 Problem

AI-generated trades from sentiment and news pipelines can fire at any time, including when the market is closed. Trading after hours has different liquidity and risk characteristics. The system needs awareness of market schedules.

### 9.2 Requirements

| Requirement | Details |
|---|---|
| TC-1 | Shared utility: `shared/market/calendar.py` with functions: `is_market_open()`, `next_market_open()`, `is_premarket()`, `is_afterhours()` |
| TC-2 | Uses `exchange_calendars` Python library for NYSE/NASDAQ schedules including holidays |
| TC-3 | Pipeline configuration: each pipeline can set market hours mode: "Regular hours only", "Extended hours", "24/7" (for crypto), "Queue for next open" |
| TC-4 | When a trade signal arrives outside configured hours, behavior depends on mode: reject, queue, or execute (extended hours) |

---

## Phase 3 (Scoped, Not Built in Phase 2)

### P3-1: AI Trading Assistant Chatbot

Enhance the existing chat widget into a full conversational AI assistant powered by RAG (Retrieval Augmented Generation). The assistant can:
- Answer questions about portfolio, sentiment, news, positions
- Execute trades by command ("Buy 100 AAPL at market")
- Explain strategy performance and pipeline behavior
- Query the option chain analyzer ("What's the best TSLA call right now?")
- Provide advisory insights by combining sentiment, news, and position data
- Use tool-calling with all platform APIs as tools

Uses a local Ollama model with function-calling capabilities and a vector database (ChromaDB) for document retrieval.

### P3-2: Global Intelligence Dashboard

A single-pane "command center" dashboard combining: portfolio equity curve, sentiment heatmap (tickers grid colored by sentiment), live trending news ticker (scrolling bar), active pipeline status cards, risk exposure summary, AI signal feed, and market status indicator. Designed for at-a-glance market awareness on a second monitor.

### P3-3: BackStrategy Model per Discord Channel

Automatically backtest historical performance of each Discord trade channel using stored raw messages and historical price data. Generate a "channel quality score" and "analyst leaderboard" showing which alert channels and which analysts within those channels have been most profitable historically. Helps users decide which channels to subscribe to.

### P3-4: Robinhood-Style Positions Dashboard

Redesign the positions page to match Robinhood's account dashboard: interactive portfolio value graph (1D/1W/1M/3M/1Y/ALL), trade fill markers on the graph, color-coded P&L, clean card-based position list with real-time quotes, and drill-down into individual position history.

### P3-5: Strategy Marketplace

Allow users to publish their strategies (from NL backtesting) to a marketplace where other users can browse, copy, and optionally subscribe to live signals. Features include performance transparency, ratings, discussion threads, and optional monetization.

### P3-6: Portfolio Risk Monitoring & AI Alerts

Unified portfolio view across all brokers, sector/industry exposure breakdown, options Greeks at portfolio level (net delta, gamma, theta), Value-at-Risk calculation, AI-generated risk commentary, stress test scenarios, and auto-hedge suggestions.

---

## Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | Sentiment processing: handle 100 messages/second across all channels |
| Performance | News dashboard: initial load < 2 seconds, incremental refresh < 500ms |
| Performance | Pipeline builder: smooth 60fps canvas interaction with up to 50 nodes |
| Performance | Option chain analysis: respond within 5 seconds including UW API calls |
| Scalability | Support up to 50 sentiment channels per user, up to 20 news sources |
| Security | All API keys (UW, news sources, broker) encrypted at rest using existing `encrypt_credentials` |
| Privacy | Local LLM inference via Ollama; no user data sent to external AI services (except to configured news/data APIs for fetching public data) |
| Reliability | Sentiment aggregation tolerates service restarts (persisted state in DB + Redis, not in-memory only) |
| Reliability | Graceful degradation: if Ollama is down, AI summaries return "AI summary temporarily unavailable" instead of failing. If UW API is down, option analysis falls back to basic quote data |
| Data Retention | News older than 48 hours auto-deleted; Sentiment messages retained for 30 days; AI trade decision audit log retained for 1 year |
| Observability | All new services expose `/health` endpoint. Prometheus metrics for: messages processed/sec, sentiment classifications/sec, news items ingested, AI trade decisions made, LLM request latency |
| Audit | Every AI-generated trade has a full traceability chain: originating signal → AI decision → contract selection → execution result. Stored in `ai_trade_decisions` table |
| Migration | Existing data sources automatically receive `source_type = 'trades'` during migration. No manual intervention required for existing users |
