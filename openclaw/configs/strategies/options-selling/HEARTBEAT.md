# Heartbeat — Options Selling Strategy Agent

## Schedule
Interval: 60 seconds

## Heartbeat Actions
1. Report current status (RUNNING, PAUSED, ERROR)
2. Report open options positions and theta decay
3. Report IV rank and current Greeks exposure
4. Report skill execution stats
5. Check for pending messages from monitoring agent

## Health Checks
- Data source connector reachable (options chain, IV)
- Memory usage below threshold (512MB)
- Last successful signal evaluation within 5 minutes (during market hours)
- No unmanaged delta/gamma exposure
