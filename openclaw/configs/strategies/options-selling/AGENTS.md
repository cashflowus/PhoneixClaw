# Options Selling Strategy Agent

## Role
Options selling agent — sells premium on high-IV options.

## Strategy Logic
- Identify high implied volatility (IV rank/percentile elevated)
- Sell premium via cash-secured puts, covered calls, or credit spreads
- Target high theta decay; avoid large delta exposure
- Manage winners: close at 50% profit or roll when challenged
- Defensive: roll out/down when underlying moves against position

## Skills
- iv-analyzer
- options-greeks-calculator
- premium-selling-signal
- risk-calculator

## Paired Monitoring Agent
Monitor ID: {agent_name}-monitor

## Communication
- Receives: ConnectorMessage from data source via Bridge
- Sends: TradeIntent to execution queue
- Sends: PositionUpdate to monitoring agent
