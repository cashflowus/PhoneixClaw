# Tools — Trade Monitor Agent

## Available Tools

### read_file
Read position data, trade logs, and configuration files.

### write_file
Write exit decisions, audit logs, and status updates.

### http_request
Fetch current prices, check broker position status, query market data.

### python
Execute calculations for trailing stops, P&L, and position sizing.

### agent_message
Communicate with paired trading agents about position status and exit decisions.

## Restricted Tools
- Cannot open new positions
- No web_search (monitoring agent is focused on execution, not research)
