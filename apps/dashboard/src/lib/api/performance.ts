import api from '@/lib/api'

export interface PerformanceSummary {
  total_pnl: number
  win_rate: number
  sharpe_ratio: number
  max_drawdown: number
  total_trades: number
  avg_return: number
  best_trade: number
  worst_trade: number
  profit_factor: number
  avg_hold_time_hours: number
}

export interface TimelinePoint {
  timestamp: string
  cumulative_pnl: number
  drawdown: number
  trade_count: number
}

export interface TimelineParams {
  agent_id?: string
  start?: string
  end?: string
  interval?: 'hour' | 'day' | 'week' | 'month'
}

export const performanceApi = {
  getPerformanceSummary: () =>
    api.get<PerformanceSummary>('/api/v2/performance/summary').then((r) => r.data),

  getPerformanceTimeline: (params?: TimelineParams) =>
    api.get<TimelinePoint[]>('/api/v2/performance/timeline', { params }).then((r) => r.data),
}
