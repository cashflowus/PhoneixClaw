import api from '@/lib/api'
import type { PaginatedResponse } from '@/types'

export interface AdminUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'user' | 'viewer'
  is_active: boolean
  last_login_at?: string
  created_at: string
  updated_at: string
}

export interface UpdateUserData {
  name?: string
  role?: AdminUser['role']
  is_active?: boolean
}

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  expires_at?: string
  last_used_at?: string
  created_at: string
}

export interface CreateApiKeyData {
  name: string
  scopes: string[]
  expires_at?: string
}

export interface CreateApiKeyResponse {
  id: string
  name: string
  key: string
  scopes: string[]
  expires_at?: string
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string
  action: string
  resource_type: string
  resource_id: string
  details: Record<string, unknown>
  ip_address: string
  created_at: string
}

export interface AuditLogParams {
  user_id?: string
  action?: string
  resource_type?: string
  limit?: number
  offset?: number
}

export interface UserListParams {
  role?: AdminUser['role']
  is_active?: boolean
  limit?: number
  offset?: number
}

export const adminApi = {
  getUsers: (params?: UserListParams) =>
    api.get<PaginatedResponse<AdminUser>>('/api/v2/admin/users', { params }).then((r) => r.data),

  getUser: (id: string) =>
    api.get<AdminUser>(`/api/v2/admin/users/${id}`).then((r) => r.data),

  updateUser: (id: string, data: UpdateUserData) =>
    api.put<AdminUser>(`/api/v2/admin/users/${id}`, data).then((r) => r.data),

  getApiKeys: () =>
    api.get<ApiKey[]>('/api/v2/admin/api-keys').then((r) => r.data),

  createApiKey: (data: CreateApiKeyData) =>
    api.post<CreateApiKeyResponse>('/api/v2/admin/api-keys', data).then((r) => r.data),

  deleteApiKey: (id: string) =>
    api.delete(`/api/v2/admin/api-keys/${id}`).then((r) => r.data),

  getAuditLogs: (params?: AuditLogParams) =>
    api.get<PaginatedResponse<AuditLog>>('/api/v2/admin/audit-log', { params }).then((r) => r.data),
}
