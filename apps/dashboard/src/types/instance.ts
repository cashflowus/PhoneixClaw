/**
 * Instance and network types.
 */

export interface OpenClawInstance {
  id: string
  name: string
  host: string
  port: number
  role: string
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE'
  node_type: 'vps' | 'local'
  capabilities: Record<string, unknown>
  last_heartbeat_at?: string
  created_at: string
}

export interface NetworkNode {
  id: string
  type: 'instance' | 'agent' | 'service'
  label: string
  status: string
  parentId?: string
  data: Record<string, unknown>
}

export interface NetworkEdge {
  id: string
  source: string
  target: string
  label?: string
  animated?: boolean
}

export interface NetworkGraph {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
}
