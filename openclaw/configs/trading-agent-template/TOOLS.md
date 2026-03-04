# Tools — Trading Agent Template

## Available Tools

### read_file
Read local files (configs, cached data, skill definitions).

### write_file
Write trade logs, analysis results, and status updates.

### web_search
Search for real-time market information and news context.

### http_request
Call external APIs: market data endpoints, broker status.

### python
Execute Python code for calculations, statistical analysis, and model inference.

### shell
Execute shell commands for data retrieval and processing pipelines.

### agent_message
Send structured messages to other agents (monitoring agent, research agent).

## Restricted Tools
- No direct broker API calls (all trades go through execution queue)
- No filesystem access outside agent workspace
