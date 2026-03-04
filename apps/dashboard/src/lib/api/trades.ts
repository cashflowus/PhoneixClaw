/**
 * Domain-specific API modules for trades.
 */
import api from '@/lib/api'
import type { TradeIntent, Position } from '@/types/trade'

export const tradesApi = {
  list: (params?: Record<string, string>) => api.get<TradeIntent[]>('/api/v2/trades', { params }).then((r) => r.data),
  get: (id: string) => api.get<TradeIntent>(`/api/v2/trades/${id}`).then((r) => r.data),
  stats: () => api.get('/api/v2/trades/stats').then((r) => r.data),
}

export const positionsApi = {
  listOpen: () => api.get<Position[]>('/api/v2/positions').then((r) => r.data),
  listClosed: () => api.get<Position[]>('/api/v2/positions/closed').then((r) => r.data),
  summary: () => api.get('/api/v2/positions/summary').then((r) => r.data),
}
