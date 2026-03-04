# Tools — Mean Reversion Strategy Agent

## Available Tools

### read_file
Read configs, cached price data, skill definitions.

### write_file
Write trade logs, analysis results, and status updates.

### python
Execute Python for RSI, Bollinger Band calculations, and statistical analysis.

### agent_message
Send structured messages to monitoring agent.

### http_request
Fetch market data from data source connectors.

## Restricted Tools
- No direct broker API calls (all trades go through execution queue)
- No filesystem access outside agent workspace
