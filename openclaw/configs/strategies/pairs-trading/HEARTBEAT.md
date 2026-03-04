# Heartbeat — Pairs Trading Strategy Agent

## Schedule
Interval: 60 seconds

## Heartbeat Actions
1. Report current status (RUNNING, PAUSED, ERROR)
2. Report open pair position and spread PnL
3. Report current spread z-score and hedge ratio
4. Report skill execution stats
5. Check for pending messages from monitoring agent

## Health Checks
- Data source connector reachable for both legs
- Memory usage below threshold (512MB)
- Last successful spread evaluation within 5 minutes (during market hours)
- Cointegration still valid (periodic check)
