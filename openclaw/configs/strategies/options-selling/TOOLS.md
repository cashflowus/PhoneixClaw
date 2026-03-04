# Tools — Options Selling Strategy Agent

## Available Tools

### read_file
Read configs, IV data, Greeks cache, skill definitions.

### write_file
Write trade logs, options analysis, and status updates.

### python
Execute Python for IV, Greeks, options pricing calculations.

### agent_message
Send structured messages to monitoring agent.

### http_request
Fetch options chain and IV data from data source connectors.

## Restricted Tools
- No direct broker API calls (all trades go through execution queue)
- No filesystem access outside agent workspace
