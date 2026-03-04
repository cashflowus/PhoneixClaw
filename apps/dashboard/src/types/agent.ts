/**
 * Agent-related TypeScript types.
 */

export type AgentType = 'trading' | 'strategy' | 'monitoring' | 'task'

export type AgentStatus =
  | 'CREATED'
  | 'APPROVED'
  | 'RUNNING'
  | 'BACKTESTING'
  | 'BACKTEST_COMPLETE'
  | 'REVIEW_PENDING'
  | 'PAPER'
  | 'LIVE'
  | 'PAUSED'
  | 'PAUSED_OFFLINE'
  | 'ERROR'

export interface Agent {
  id: string
  name: string
  type: AgentType
  status: AgentStatus
  instance_id: string
  user_id?: string
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AgentBacktest {
  id: string
  agent_id: string
  status: string
  strategy_template?: string
  start_date?: string
  end_date?: string
  parameters: Record<string, unknown>
  metrics: Record<string, number>
  equity_curve: number[]
  total_trades: number
  win_rate?: number
  sharpe_ratio?: number
  max_drawdown?: number
  total_return?: number
  completed_at?: string
  created_at: string
}

export interface AgentMessage {
  id: string
  from_agent_id: string
  to_agent_id?: string
  pattern: 'request-response' | 'broadcast' | 'pub-sub' | 'chain' | 'consensus'
  intent: string
  data: Record<string, unknown>
  status: string
  created_at: string
}
