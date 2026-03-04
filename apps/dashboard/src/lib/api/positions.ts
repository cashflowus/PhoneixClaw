import api from '@/lib/api'
import type { Position } from '@/types/trade'

export interface PositionParams {
  status?: string
  symbol?: string
  agent_id?: string
  limit?: number
  offset?: number
}

export interface PositionSummaryResponse {
  total_open: number
  total_unrealized_pnl: number
  total_realized_pnl: number
  by_symbol: Record<string, { qty: number; unrealized_pnl: number }>
}

export interface ClosePositionData {
  exit_price: number
  exit_reason: string
}

export const positionsApi = {
  getPositions: (params?: PositionParams) =>
    api.get<Position[]>('/api/v2/positions', { params }).then((r) => r.data),

  getClosedPositions: (params?: PositionParams) =>
    api.get<Position[]>('/api/v2/positions/closed', { params }).then((r) => r.data),

  getPositionSummary: () =>
    api.get<PositionSummaryResponse>('/api/v2/positions/summary').then((r) => r.data),

  getPosition: (id: string) =>
    api.get<Position>(`/api/v2/positions/${id}`).then((r) => r.data),

  closePosition: (id: string, data: ClosePositionData) =>
    api.post<Position>(`/api/v2/positions/${id}/close`, data).then((r) => r.data),
}
