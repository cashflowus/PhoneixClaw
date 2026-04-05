import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Agent, AgentStatus, AgentType } from '@/types/agent'

export interface AgentFilters {
  type?: AgentType
  status?: AgentStatus
  limit?: number
  offset?: number
}

export interface AgentStats {
  total: number
  by_status: Record<AgentStatus, number>
  by_type: Record<AgentType, number>
  active: number
  errored: number
}

export function useAgents(filters?: AgentFilters) {
  return useQuery({
    queryKey: ['agents', filters],
    queryFn: () =>
      api.get<Agent[]>('/api/v2/agents', { params: filters }).then((r) => r.data),
  })
}

export function useAgentStats() {
  return useQuery({
    queryKey: ['agent-stats'],
    queryFn: () =>
      api.get<AgentStats>('/api/v2/agents/stats').then((r) => r.data),
  })
}

export function useCreateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Agent>) =>
      api.post<Agent>('/api/v2/agents', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
      qc.invalidateQueries({ queryKey: ['agent-stats'] })
    },
  })
}

export function usePauseAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/v2/agents/${id}/pause`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
      qc.invalidateQueries({ queryKey: ['agent-stats'] })
    },
  })
}

export function useResumeAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/v2/agents/${id}/resume`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
      qc.invalidateQueries({ queryKey: ['agent-stats'] })
    },
  })
}

export function useApproveAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/v2/agents/${id}/approve`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
      qc.invalidateQueries({ queryKey: ['agent-stats'] })
    },
  })
}

export function usePromoteAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { id: string; target_status: AgentStatus }) =>
      api.post(`/api/v2/agents/${payload.id}/promote`, { target_status: payload.target_status }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
      qc.invalidateQueries({ queryKey: ['agent-stats'] })
    },
  })
}

export function useDeleteAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/v2/agents/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
      qc.invalidateQueries({ queryKey: ['agent-stats'] })
    },
  })
}
