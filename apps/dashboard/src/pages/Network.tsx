/**
 * Network page — agent network visualization with @xyflow/react graph.
 * Instance nodes (large), agent nodes (smaller), service nodes. Color-coded status.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import api from '@/lib/api'
import { FlexCard } from '@/components/ui/FlexCard'
import { MetricCard } from '@/components/ui/MetricCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Cpu, Activity, Server, Bot, Wrench } from 'lucide-react'

interface Instance {
  id: string
  name: string
  status: string
  agents: number
  last_heartbeat: string
}

const MOCK_INSTANCES: Instance[] = [
  { id: '1', name: 'openclaw-instance-d', status: 'RUNNING', agents: 3, last_heartbeat: '2025-03-03T10:15:00Z' },
  { id: '2', name: 'openclaw-backtest', status: 'IDLE', agents: 1, last_heartbeat: '2025-03-03T09:00:00Z' },
  { id: '3', name: 'openclaw-prod', status: 'RUNNING', agents: 2, last_heartbeat: '2025-03-03T10:14:00Z' },
]

function statusColor(status: string): string {
  const s = status.toUpperCase()
  if (['RUNNING', 'ONLINE'].includes(s)) return 'bg-emerald-500 border-emerald-600'
  if (['IDLE', 'DEGRADED'].includes(s)) return 'bg-amber-500 border-amber-600'
  if (['ERROR', 'OFFLINE'].includes(s)) return 'bg-red-500 border-red-600'
  return 'bg-zinc-400 border-zinc-500'
}

function InstanceNode({ data }: NodeProps) {
  const color = statusColor(String(data?.status ?? 'unknown'))
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 shadow-lg min-w-[140px] ${color} text-white`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <Server className="h-5 w-5" />
        <span className="font-semibold text-sm">{(data?.label ?? data?.name) as string}</span>
      </div>
      <p className="text-xs opacity-90 mt-1">{(data?.agents ?? 0) as number} agents</p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function AgentNode({ data }: NodeProps) {
  const color = statusColor(String(data?.status ?? 'unknown'))
  return (
    <div className={`px-2 py-1.5 rounded border-2 ${color} text-white text-xs`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-1">
        <Bot className="h-3 w-3" />
        {(data?.label ?? data?.name) as string}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function ServiceNode({ data }: NodeProps) {
  const color = statusColor(String(data?.status ?? 'unknown'))
  return (
    <div className={`px-2 py-1 rounded border ${color} text-white text-xs`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-1">
        <Wrench className="h-3 w-3" />
        {(data?.label ?? data?.name) as string}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

const nodeTypes = { instance: InstanceNode, agent: AgentNode, service: ServiceNode }

function HeartbeatIndicator({ lastHeartbeat }: { lastHeartbeat: string }) {
  const diff = Date.now() - new Date(lastHeartbeat).getTime()
  const isRecent = diff < 60000
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${isRecent ? 'text-emerald-600' : 'text-amber-600'}`}>
      <span className={`w-2 h-2 rounded-full ${isRecent ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
      {isRecent ? 'Live' : `${Math.floor(diff / 60000)}m ago`}
    </span>
  )
}

export default function NetworkPage() {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const fn = () => setIsMobile(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  const { data: instances = MOCK_INSTANCES } = useQuery<Instance[]>({
    queryKey: ['instances'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/instances')
        return res.data
      } catch {
        return MOCK_INSTANCES
      }
    },
    refetchInterval: 10000,
  })

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    let y = 0
    instances.forEach((inst, i) => {
      const instId = `inst-${inst.id}`
      nodes.push({
        id: instId,
        type: 'instance',
        position: { x: 100 + i * 220, y },
        data: { label: inst.name, name: inst.name, status: inst.status, agents: inst.agents },
      })
      for (let a = 0; a < inst.agents; a++) {
        const agentId = `${instId}-agent-${a}`
        nodes.push({
          id: agentId,
          type: 'agent',
          position: { x: 120 + i * 220 + a * 50, y: y + 80 },
          data: { label: `Agent ${a + 1}`, name: `agent-${a + 1}`, status: inst.status },
        })
        edges.push({ id: `${instId}-${agentId}`, source: instId, target: agentId })
      }
      y += 120
    })
    nodes.push({
      id: 'svc-connector',
      type: 'service',
      position: { x: 400, y: 0 },
      data: { label: 'Connector', name: 'connector', status: 'RUNNING' },
    })
    nodes.push({
      id: 'svc-execution',
      type: 'service',
      position: { x: 400, y: 60 },
      data: { label: 'Execution', name: 'execution', status: 'RUNNING' },
    })
    edges.push({ id: 'e1', source: 'inst-1', target: 'svc-connector' })
    edges.push({ id: 'e2', source: 'inst-2', target: 'svc-execution' })
    return { initialNodes: nodes, initialEdges: edges }
  }, [instances])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const running = instances.filter((i) => i.status === 'RUNNING').length

  if (isMobile) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Agent Network</h2>
          <p className="text-muted-foreground">Instance status and agent connections</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard title="Instances" value={instances.length} />
          <MetricCard title="Running" value={running} trend="up" />
          <MetricCard title="Total Agents" value={instances.reduce((a, i) => a + i.agents, 0)} />
          <MetricCard title="Healthy" value={instances.filter((i) => (Date.now() - new Date(i.last_heartbeat).getTime()) < 60000).length} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {instances.map((inst) => (
            <FlexCard key={inst.id} title={inst.name}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <StatusBadge status={inst.status} />
                  <HeartbeatIndicator lastHeartbeat={inst.last_heartbeat} />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <span>{inst.agents} agent{inst.agents !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Activity className="h-3 w-3" />
                  Last heartbeat: {new Date(inst.last_heartbeat).toLocaleString()}
                </div>
              </div>
            </FlexCard>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Agent Network</h2>
        <p className="text-muted-foreground">Instance status and agent connections</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Instances" value={instances.length} />
        <MetricCard title="Running" value={running} trend="up" />
        <MetricCard title="Total Agents" value={instances.reduce((a, i) => a + i.agents, 0)} />
        <MetricCard title="Healthy" value={instances.filter((i) => (Date.now() - new Date(i.last_heartbeat).getTime()) < 60000).length} />
      </div>

      <div className="flex gap-6" style={{ height: 420 }}>
        <div className="flex-1 rounded-lg border bg-muted/20 overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          </ReactFlow>
        </div>

        {selectedNode && (
          <FlexCard title="Node Details" className="w-72 shrink-0 self-start">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{(selectedNode.data?.label ?? selectedNode.id) as string}</span>
                <StatusBadge status={String(selectedNode.data?.status ?? 'unknown')} />
              </div>
              <p className="text-xs text-muted-foreground">Type: {selectedNode.type ?? 'unknown'}</p>
              {selectedNode.data?.agents != null && (
                <p className="text-sm">Agents: {selectedNode.data.agents as number}</p>
              )}
              <button
                onClick={() => setSelectedNode(null)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
          </FlexCard>
        )}
      </div>
    </div>
  )
}
