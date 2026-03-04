# Mean Reversion Strategy Agent

## Role
Mean reversion agent — buys oversold and sells overbought using RSI and Bollinger Bands.

## Strategy Logic
- Identify oversold conditions: RSI < 30 or price below lower Bollinger Band
- Identify overbought conditions: RSI > 70 or price above upper Bollinger Band
- Enter long when oversold with confirmation; enter short when overbought
- Exit on mean reversion (RSI returning to 50, price returning to middle band)

## Skills
- rsi-calculator
- bollinger-bands
- mean-reversion-signal
- risk-calculator

## Paired Monitoring Agent
Monitor ID: {agent_name}-monitor

## Communication
- Receives: ConnectorMessage from data source via Bridge
- Sends: TradeIntent to execution queue
- Sends: PositionUpdate to monitoring agent
