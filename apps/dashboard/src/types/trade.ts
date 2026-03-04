/**
 * Trade and Position TypeScript types.
 */

export type TradeStatus = 'PENDING' | 'RISK_CHECK' | 'APPROVED' | 'SUBMITTED' | 'FILLED' | 'REJECTED' | 'FAILED' | 'CANCELLED'

export interface TradeIntent {
  id: string
  agent_id: string
  account_id: string
  symbol: string
  side: 'buy' | 'sell'
  qty: number
  order_type: string
  limit_price?: number
  stop_price?: number
  status: TradeStatus
  risk_check_result?: Record<string, unknown>
  broker_order_id?: string
  fill_price?: number
  filled_at?: string
  rejection_reason?: string
  signal_source?: string
  signal_data?: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type PositionStatus = 'OPEN' | 'CLOSED' | 'PARTIALLY_CLOSED'

export interface Position {
  id: string
  agent_id: string
  account_id: string
  symbol: string
  side: 'long' | 'short'
  qty: number
  entry_price: number
  current_price: number
  stop_loss?: number
  take_profit?: number
  unrealized_pnl: number
  realized_pnl: number
  status: PositionStatus
  exit_price?: number
  exit_reason?: string
  opened_at: string
  closed_at?: string
  trade_intent_id?: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}
