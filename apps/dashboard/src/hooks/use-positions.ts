import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Position, PositionStatus } from '@/types/trade'

export interface PositionFilters {
  status?: PositionStatus
  symbol?: string
  agent_id?: string
  limit?: number
  offset?: number
}

export interface PositionSummary {
  total_open: number
  total_unrealized_pnl: number
  total_realized_pnl: number
  by_symbol: Record<string, { qty: number; unrealized_pnl: number }>
}

export interface ClosePositionPayload {
  id: string
  exit_price: number
  exit_reason: string
}

export function usePositions(filters?: PositionFilters) {
  return useQuery({
    queryKey: ['positions', filters],
    queryFn: () =>
      api.get<Position[]>('/api/v2/positions', { params: filters }).then((r) => r.data),
  })
}

export function useClosedPositions() {
  return useQuery({
    queryKey: ['positions', 'closed'],
    queryFn: () =>
      api.get<Position[]>('/api/v2/positions/closed').then((r) => r.data),
  })
}

export function usePositionSummary() {
  return useQuery({
    queryKey: ['position-summary'],
    queryFn: () =>
      api.get<PositionSummary>('/api/v2/positions/summary').then((r) => r.data),
  })
}

export function useClosePosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, exit_price, exit_reason }: ClosePositionPayload) =>
      api.post<Position>(`/api/v2/positions/${id}/close`, { exit_price, exit_reason }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['positions'] })
      qc.invalidateQueries({ queryKey: ['position-summary'] })
    },
  })
}
