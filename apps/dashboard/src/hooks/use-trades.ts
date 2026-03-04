import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { TradeIntent, TradeStatus } from '@/types/trade'

export interface TradeFilters {
  status?: TradeStatus
  symbol?: string
  agent_id?: string
  limit?: number
  offset?: number
}

export interface TradeStats {
  total: number
  by_status: Record<TradeStatus, number>
  filled_today: number
  rejected_today: number
  avg_fill_time_ms: number
}

export function useTrades(filters?: TradeFilters) {
  return useQuery({
    queryKey: ['trades', filters],
    queryFn: () =>
      api.get<TradeIntent[]>('/api/v2/trades', { params: filters }).then((r) => r.data),
  })
}

export function useTradeStats() {
  return useQuery({
    queryKey: ['trade-stats'],
    queryFn: () =>
      api.get<TradeStats>('/api/v2/trades/stats').then((r) => r.data),
  })
}

export function useTrade(id: string) {
  return useQuery({
    queryKey: ['trades', id],
    queryFn: () =>
      api.get<TradeIntent>(`/api/v2/trades/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}
