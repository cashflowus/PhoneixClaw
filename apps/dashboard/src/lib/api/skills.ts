import api from '@/lib/api'

export interface Skill {
  id: string
  name: string
  description: string
  category: string
  version: string
  instance_id: string
  is_active: boolean
  parameters: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SkillParams {
  category?: string
  instance_id?: string
  is_active?: boolean
  limit?: number
  offset?: number
}

export interface SyncSkillsResponse {
  synced: number
  added: string[]
  removed: string[]
}

export const skillsApi = {
  getSkills: (params?: SkillParams) =>
    api.get<Skill[]>('/api/v2/skills', { params }).then((r) => r.data),

  getSkill: (id: string) =>
    api.get<Skill>(`/api/v2/skills/${id}`).then((r) => r.data),

  syncSkills: (instanceId: string) =>
    api.post<SyncSkillsResponse>(`/api/v2/skills/sync`, { instance_id: instanceId }).then((r) => r.data),
}
