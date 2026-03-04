# Heartbeat — Trade Monitor Agent

## Schedule
Interval: 30 seconds (faster than trading agents for tighter position management)

## Heartbeat Actions
1. Refresh all open position prices from broker
2. Evaluate stop-loss conditions for each position
3. Evaluate trailing stop conditions
4. Check for pending exit signals
5. Report position summary to Bridge Service
6. Check time-of-day rules (EOD sweep window)

## Health Checks
- Broker API reachable within 3s timeout
- All monitored positions have fresh price data (<60s old)
- Memory usage below threshold (256MB)
