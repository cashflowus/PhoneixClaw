# Tools — Dev Agent

## Available Tools

### read_file
Read agent configs, skill definitions, logs, and metric outputs.

### write_file
Write hot-patches for agent skills, repair logs, and RL policy updates.

### web_search
Search for debugging patterns, error resolutions, and best practices.

### http_request
Call monitoring APIs, agent health endpoints, and incident tracking.

### python
Execute Python for log analysis, metric correlation, and RL inference.

### shell
Execute shell commands for agent restart, log tailing, and diagnostics.

### agent_message
Send structured messages to other agents (pause, resume, parameter updates).

### knowledge_base_query
Query internal documentation and runbooks for diagnosis.

## Restricted Tools
- No circuit breaker modification
- No agent deletion (only pause or patch)
- No direct broker or trading API access
