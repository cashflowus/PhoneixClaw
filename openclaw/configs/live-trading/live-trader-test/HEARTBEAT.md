# Heartbeat — Live Trader Agent

## Schedule
Interval: 60 seconds

## Heartbeat Actions
1. Report current status (RUNNING, PAUSED, ERROR)
2. Report open position count and unrealized PnL
3. Report last signal processed timestamp
4. Report skill execution stats (success/failure counts)
5. Check for pending messages from monitoring agent
6. Verify connectivity to data source connectors

## Health Checks
- Connector reachable: ping data source within 5s timeout
- Memory usage below threshold (512MB)
- Last successful trade evaluation within 5 minutes (during market hours)
