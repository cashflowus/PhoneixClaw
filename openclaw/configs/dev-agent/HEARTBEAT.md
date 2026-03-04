# Heartbeat — Dev Agent

## Schedule
Interval: 30 seconds

## Heartbeat Actions
1. Report Dev Agent status (RUNNING, PAUSED, ERROR)
2. Poll all OpenClaw agent heartbeats across instances
3. Aggregate agent health: online count, stale count, error count
4. Report last incident detected timestamp
5. Report last auto-repair timestamp
6. Report RL episode count and average reward
7. Verify connectivity to monitoring API and incident store

## Health Checks
- All agent heartbeats ingested within 60s window
- Monitoring API reachable within 5s timeout
- Memory usage below threshold (512MB)
- No unacknowledged critical incidents older than 10 minutes
