# Heartbeat — Mean Reversion Strategy Agent

## Schedule
Interval: 60 seconds

## Heartbeat Actions
1. Report current status (RUNNING, PAUSED, ERROR)
2. Report open position count and unrealized PnL
3. Report last RSI/Bollinger values and signal generated
4. Report skill execution stats
5. Check for pending messages from monitoring agent

## Health Checks
- Data source connector reachable
- Memory usage below threshold (512MB)
- Last successful signal evaluation within 5 minutes (during market hours)
