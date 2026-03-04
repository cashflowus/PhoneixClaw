# Tools — Pairs Trading Strategy Agent

## Available Tools

### read_file
Read configs, cached price data, cointegration results, skill definitions.

### write_file
Write trade logs, spread analysis, and status updates.

### python
Execute Python for cointegration, spread z-score, hedge ratio calculations.

### agent_message
Send structured messages to monitoring agent.

### http_request
Fetch market data for both legs from data source connectors.

## Restricted Tools
- No direct broker API calls (all trades go through execution queue)
- No filesystem access outside agent workspace
