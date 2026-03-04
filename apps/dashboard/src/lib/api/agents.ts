/**
 * Domain-specific API modules for agents.
 */
import api from '@/lib/api'
import type { Agent, AgentBacktest } from '@/types/agent'

export const agentsApi = {
  list: () => api.get<Agent[]>('/api/v2/agents').then((r) => r.data),
  get: (id: string) => api.get<Agent>(`/api/v2/agents/${id}`).then((r) => r.data),
  create: (data: Partial<Agent>) => api.post<Agent>('/api/v2/agents', data).then((r) => r.data),
  update: (id: string, data: Partial<Agent>) => api.put<Agent>(`/api/v2/agents/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/api/v2/agents/${id}`),
  pause: (id: string) => api.post(`/api/v2/agents/${id}/pause`),
  resume: (id: string) => api.post(`/api/v2/agents/${id}/resume`),
  stats: (id: string) => api.get(`/api/v2/agents/${id}/stats`).then((r) => r.data),
  backtests: (id: string) => api.get<AgentBacktest[]>(`/api/v2/backtests?agent_id=${id}`).then((r) => r.data),
}
