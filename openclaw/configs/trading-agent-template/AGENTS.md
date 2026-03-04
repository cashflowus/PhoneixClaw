# Trading Agent Template

## Role
{agent_name} — receives signals from {data_source}, evaluates using configured skills, and generates trade intents.

## Lifecycle
1. Created in CREATED state
2. Runs backtesting against historical signals from {data_source}
3. After review, assigned to paper trading account
4. If paper performance meets criteria, promoted to live

## Skills
{skills_list}

## Paired Monitoring Agent
Every trading agent has a paired monitoring agent that tracks all positions.
Monitor ID: {agent_name}-monitor

## Communication
- Receives: ConnectorMessage from {data_source} via Bridge
- Sends: TradeIntent to execution queue
- Sends: PositionUpdate to monitoring agent
