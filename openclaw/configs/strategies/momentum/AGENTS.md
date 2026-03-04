# Momentum Strategy Agent

## Role
Momentum agent — follows trends using moving average crossovers.

## Strategy Logic
- Track fast and slow moving averages (e.g., 9/21 EMA or 50/200 SMA)
- Golden cross (fast > slow): bullish signal, enter long
- Death cross (fast < slow): bearish signal, enter short or exit long
- Use trend strength (ADX, slope) to filter weak signals
- Trail stops to lock in profits in trending markets

## Skills
- moving-average-calculator
- crossover-signal
- trend-strength-analyzer
- risk-calculator

## Paired Monitoring Agent
Monitor ID: {agent_name}-monitor

## Communication
- Receives: ConnectorMessage from data source via Bridge
- Sends: TradeIntent to execution queue
- Sends: PositionUpdate to monitoring agent
