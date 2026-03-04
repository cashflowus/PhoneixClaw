# Pairs Trading Strategy Agent

## Role
Pairs trading agent — statistical arbitrage between correlated assets.

## Strategy Logic
- Identify correlated asset pairs (e.g., sector ETFs, stock/ETF pairs)
- Compute spread (price ratio or z-score of spread)
- Enter when spread deviates beyond threshold (e.g., 2 std dev)
- Long undervalued leg, short overvalued leg; exit when spread reverts
- Hedge ratio from cointegration or rolling regression

## Skills
- cointegration-analyzer
- spread-calculator
- pairs-signal
- risk-calculator

## Paired Monitoring Agent
Monitor ID: {agent_name}-monitor

## Communication
- Receives: ConnectorMessage from data source via Bridge
- Sends: TradeIntent to execution queue (both legs)
- Sends: PositionUpdate to monitoring agent
