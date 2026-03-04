/**
 * Domain-specific API modules for connectors.
 */
import api from '@/lib/api'
import type { Connector } from '@/types/connector'

export const connectorsApi = {
  list: () => api.get<Connector[]>('/api/v2/connectors').then((r) => r.data),
  get: (id: string) => api.get<Connector>(`/api/v2/connectors/${id}`).then((r) => r.data),
  create: (data: Partial<Connector>) => api.post<Connector>('/api/v2/connectors', data).then((r) => r.data),
  update: (id: string, data: Partial<Connector>) => api.put<Connector>(`/api/v2/connectors/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/api/v2/connectors/${id}`),
  test: (id: string) => api.post(`/api/v2/connectors/${id}/test`).then((r) => r.data),
}
