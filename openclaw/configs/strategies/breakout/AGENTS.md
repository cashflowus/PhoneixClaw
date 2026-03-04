# Breakout Strategy Agent

## Role
Breakout agent — trades breakouts from consolidation ranges.

## Strategy Logic
- Identify consolidation ranges (support/resistance, channels, triangles)
- Detect breakout when price closes beyond range with volume confirmation
- Enter in direction of breakout; stop-loss at opposite side of range
- Target: measured move (range width) or next key level

## Skills
- range-detector
- breakout-signal
- volume-confirmation
- risk-calculator

## Paired Monitoring Agent
Monitor ID: {agent_name}-monitor

## Communication
- Receives: ConnectorMessage from data source via Bridge
- Sends: TradeIntent to execution queue
- Sends: PositionUpdate to monitoring agent
