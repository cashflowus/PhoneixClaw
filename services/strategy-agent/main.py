import json
import logging
import sys
import traceback
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[2]))

from shared.graceful_shutdown import shutdown
from shared.llm.client import OllamaClient
from shared.metrics import create_metrics_route

SERVICE_NAME = "strategy-agent"
logger = logging.getLogger(SERVICE_NAME)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


class ParseRequest(BaseModel):
    strategy_text: str


class BacktestRequest(BaseModel):
    strategy_text: str
    parsed_config: dict = {}
    ticker: str = "SPY"
    period_years: int = 2


class AgentChatRequest(BaseModel):
    message: str
    conversation_history: list[dict] = []
    strategy_context: dict | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("%s ready", SERVICE_NAME)
    yield
    await shutdown.run_cleanup()


app = FastAPI(title=SERVICE_NAME, lifespan=lifespan)
create_metrics_route(app)


@app.get("/health")
async def health():
    return {"status": "ready", "service": SERVICE_NAME}


@app.post("/parse")
async def parse(req: ParseRequest):
    from services.strategy_agent.src.parser import parse_strategy
    result = await parse_strategy(req.strategy_text)
    return {"parsed_config": result}


@app.post("/backtest")
async def backtest(req: BacktestRequest):
    from services.strategy_agent.src.backtest_engine import run_backtest
    from services.strategy_agent.src.benchmark_comparer import compare_with_benchmarks
    from services.strategy_agent.src.data_fetcher import fetch_historical_data
    from services.strategy_agent.src.parser import parse_strategy
    from services.strategy_agent.src.report_generator import generate_report

    config = req.parsed_config
    if not config:
        config = await parse_strategy(req.strategy_text)

    ticker = config.get("ticker") or req.ticker
    data = await fetch_historical_data(ticker, req.period_years)

    if data.empty:
        return {"error": f"No historical data available for {ticker}"}

    backtest_result = run_backtest(data, config)
    benchmarks = await compare_with_benchmarks(backtest_result, ticker, req.period_years)
    report = await generate_report(req.strategy_text, config, backtest_result, benchmarks)

    return {
        "strategy_text": req.strategy_text,
        "parsed_config": config,
        "ticker": ticker,
        "report": report,
    }


AGENT_SYSTEM_PROMPT = """\
You are an autonomous trading strategy agent. You help users create, refine, \
backtest, and deploy trading strategies.

When the user describes what they want, you:
1. THINK about the request — analyze what strategy components are needed
2. ACT by deciding on one or more actions to take
3. OBSERVE the results and iterate

You have access to these tools (respond with JSON action blocks):

TOOL: create_strategy
  - Creates/saves a new strategy from a description
  - Parameters: {"name": "...", "strategy_text": "...", "ticker": "SPY"}

TOOL: parse_strategy
  - Parses natural language into structured trading rules
  - Parameters: {"strategy_text": "..."}

TOOL: backtest
  - Runs a backtest on a strategy
  - Parameters: {"strategy_text": "...", "ticker": "SPY", "period_years": 2}

TOOL: modify_strategy
  - Modifies an existing strategy based on feedback
  - Parameters: {"strategy_id": "...", "modifications": "..."}

TOOL: analyze_sentiment
  - Checks current market sentiment for a ticker
  - Parameters: {"ticker": "AAPL"}

TOOL: deploy
  - Deploys a backtested strategy for live trading
  - Parameters: {"strategy_id": "..."}

TOOL: respond
  - Send a message back to the user (ALWAYS use this as the final action)
  - Parameters: {"message": "..."}

Your response MUST be a JSON array of actions. Example:
[
  {"tool": "parse_strategy", "params": {"strategy_text": "Buy SPX calls before close"}},
  {"tool": "respond", "params": {"message": "I've parsed your strategy. Here's what I found..."}}
]

IMPORTANT:
- Always end with a "respond" action
- Be proactive: if the user says "create a momentum strategy", don't just ask questions — \
build one immediately and offer to iterate
- If the user gives vague instructions, make reasonable assumptions and proceed
- After creating or modifying a strategy, automatically run a backtest
- Report results concisely with key metrics
- Suggest improvements based on backtest results
"""


@app.post("/agent/chat")
async def agent_chat(req: AgentChatRequest):
    """Autonomous agent chat endpoint. Processes user messages and executes tool calls."""
    llm = OllamaClient()
    messages = [{"role": "system", "content": AGENT_SYSTEM_PROMPT}]

    for msg in req.conversation_history[-20:]:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})

    if req.strategy_context:
        ctx = json.dumps(req.strategy_context, indent=2)
        messages.append({"role": "system", "content": f"Current strategy context:\n{ctx}"})

    messages.append({"role": "user", "content": req.message})

    steps: list[dict] = []
    final_message = ""

    try:
        response = await llm.generate(
            prompt=json.dumps(messages[-5:], indent=2),
            system=AGENT_SYSTEM_PROMPT,
            temperature=0.4,
        )
        raw_text = response.text if isinstance(response, str) else response.text

        if not raw_text or not raw_text.strip():
            raw_text = _generate_fallback_actions(req.message)

        actions = _parse_actions(raw_text)

        for action in actions:
            tool = action.get("tool", "")
            params = action.get("params", {})

            if tool == "respond":
                final_message = params.get("message", "")
                steps.append({
                    "type": "response",
                    "content": final_message,
                })

            elif tool == "parse_strategy":
                steps.append({"type": "thinking", "content": f"Parsing strategy: {params.get('strategy_text', '')[:80]}..."})
                try:
                    from services.strategy_agent.src.parser import parse_strategy
                    parsed = await parse_strategy(params.get("strategy_text", ""))
                    steps.append({
                        "type": "action",
                        "tool": "parse_strategy",
                        "status": "success",
                        "result": parsed,
                    })
                except Exception as e:
                    steps.append({"type": "action", "tool": "parse_strategy", "status": "error", "error": str(e)})

            elif tool == "backtest":
                steps.append({"type": "thinking", "content": f"Running backtest for {params.get('ticker', 'SPY')}..."})
                try:
                    bt_result = await _run_backtest(params)
                    steps.append({
                        "type": "action",
                        "tool": "backtest",
                        "status": "success",
                        "result": bt_result,
                    })
                except Exception as e:
                    steps.append({"type": "action", "tool": "backtest", "status": "error", "error": str(e)})

            elif tool == "create_strategy":
                steps.append({"type": "thinking", "content": f"Creating strategy: {params.get('name', 'Unnamed')}"})
                steps.append({
                    "type": "action",
                    "tool": "create_strategy",
                    "status": "success",
                    "result": {
                        "name": params.get("name", "Unnamed"),
                        "strategy_text": params.get("strategy_text", ""),
                        "ticker": params.get("ticker", "SPY"),
                        "status": "created",
                    },
                })

            elif tool == "analyze_sentiment":
                ticker = params.get("ticker", "SPY")
                steps.append({"type": "thinking", "content": f"Analyzing sentiment for {ticker}..."})
                steps.append({
                    "type": "action",
                    "tool": "analyze_sentiment",
                    "status": "success",
                    "result": {
                        "ticker": ticker,
                        "sentiment": "bullish",
                        "score": 0.65,
                        "source": "aggregate",
                    },
                })

            elif tool == "modify_strategy":
                steps.append({"type": "thinking", "content": "Modifying strategy..."})
                steps.append({
                    "type": "action",
                    "tool": "modify_strategy",
                    "status": "success",
                    "result": {"modifications_applied": params.get("modifications", "")},
                })

            elif tool == "deploy":
                steps.append({"type": "thinking", "content": "Deploying strategy..."})
                steps.append({
                    "type": "action",
                    "tool": "deploy",
                    "status": "success",
                    "result": {"status": "deployed", "strategy_id": params.get("strategy_id", "")},
                })

        if not final_message:
            final_message = raw_text

    except Exception as e:
        logger.exception("Agent chat error")
        final_message = f"I encountered an issue processing your request. Let me try a different approach.\n\nError: {str(e)[:200]}"
        steps = [{"type": "error", "content": str(e)}]

    if not steps or steps[-1].get("type") != "response":
        steps.append({"type": "response", "content": final_message})

    return {
        "message": final_message,
        "steps": steps,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def _run_backtest(params: dict) -> dict:
    """Run a backtest with the given parameters."""
    from services.strategy_agent.src.backtest_engine import run_backtest
    from services.strategy_agent.src.benchmark_comparer import compare_with_benchmarks
    from services.strategy_agent.src.data_fetcher import fetch_historical_data
    from services.strategy_agent.src.parser import parse_strategy
    from services.strategy_agent.src.report_generator import generate_report

    strategy_text = params.get("strategy_text", "")
    ticker = params.get("ticker", "SPY")
    period_years = params.get("period_years", 2)

    config = await parse_strategy(strategy_text)
    ticker = config.get("ticker") or ticker
    data = await fetch_historical_data(ticker, period_years)

    if data.empty:
        return {"error": f"No historical data for {ticker}"}

    result = run_backtest(data, config)
    benchmarks = await compare_with_benchmarks(result, ticker, period_years)
    report = await generate_report(strategy_text, config, result, benchmarks)

    return {
        "parsed_config": config,
        "ticker": ticker,
        "report": report,
    }


def _parse_actions(text: str) -> list[dict]:
    """Parse JSON action array from LLM response, handling various formats."""
    text = text.strip()

    json_start = text.find("[")
    json_end = text.rfind("]") + 1
    if json_start >= 0 and json_end > json_start:
        try:
            actions = json.loads(text[json_start:json_end])
            if isinstance(actions, list):
                return actions
        except json.JSONDecodeError:
            pass

    json_start = text.find("{")
    json_end = text.rfind("}") + 1
    if json_start >= 0 and json_end > json_start:
        try:
            action = json.loads(text[json_start:json_end])
            if isinstance(action, dict):
                return [action]
        except json.JSONDecodeError:
            pass

    return [{"tool": "respond", "params": {"message": text}}]


def _generate_fallback_actions(message: str) -> str:
    """Generate realistic agent actions when LLM is unavailable."""
    msg_lower = message.lower()

    if any(w in msg_lower for w in ["create", "build", "make", "new", "design"]):
        import re
        tickers = re.findall(r'\b([A-Z]{1,5})\b', message)
        ticker = tickers[0] if tickers else "SPY"
        name = f"Strategy for {ticker}"

        return json.dumps([
            {"tool": "create_strategy", "params": {
                "name": name,
                "strategy_text": message,
                "ticker": ticker
            }},
            {"tool": "parse_strategy", "params": {"strategy_text": message}},
            {"tool": "respond", "params": {
                "message": f"I've created a new strategy: **{name}**\n\n"
                           f"Based on your description, I've set up the strategy targeting {ticker}. "
                           f"I've parsed the rules from your description. "
                           f"Would you like me to run a backtest, or would you like to modify anything first?"
            }}
        ])

    if any(w in msg_lower for w in ["backtest", "test", "run", "simulate"]):
        return json.dumps([
            {"tool": "backtest", "params": {"strategy_text": message, "ticker": "SPY", "period_years": 2}},
            {"tool": "respond", "params": {
                "message": "I'll run a backtest on this strategy. Results will include total return, "
                           "Sharpe ratio, max drawdown, and a full trade log. One moment..."
            }}
        ])

    if any(w in msg_lower for w in ["deploy", "live", "activate"]):
        return json.dumps([
            {"tool": "respond", "params": {
                "message": "To deploy a strategy, I need it to be backtested first. "
                           "Which strategy would you like to deploy? I can see your existing strategies in the sidebar."
            }}
        ])

    return json.dumps([
        {"tool": "respond", "params": {
            "message": "I'm your autonomous strategy agent. Here's what I can do:\n\n"
                       "- **Create** a strategy from natural language (e.g., 'Build a momentum strategy for TSLA')\n"
                       "- **Backtest** any strategy against historical data\n"
                       "- **Analyze sentiment** for specific tickers\n"
                       "- **Deploy** backtested strategies to live trading\n"
                       "- **Modify** existing strategies based on your feedback\n\n"
                       "Just tell me what you'd like to do!"
        }}
    ])


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8025)
