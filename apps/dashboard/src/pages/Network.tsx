/**
 * Network page — tabbed view with Graph visualization and Instance management.
 * Graph tab: @xyflow/react agent network visualization.
 * Instances tab: CRUD table to add/edit/delete OpenClaw instances.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { PageHeader } from '@/components/ui/PageHeader'
import { FlexCard } from '@/components/ui/FlexCard'
import { MetricCard } from '@/components/ui/MetricCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  Cpu, Activity, Network, Server, Bot, Wrench, Plus, Pencil, Trash2, Wifi,
} from 'lucide-react'

// ─── Types matching API InstanceResponse ────────────────────────────────────

interface Instance {
  id: string
  name: string
  host: string
  port: number
  role: string
  status: string
  node_type: string
  capabilities: Record<string, unknown>
  last_heartbeat_at: string | null
  created_at: string
}

interface InstanceFormData {
  name: string
  host: string
  port: number
  role: string
  node_type: string
}

const ROLES = ['general', 'strategy-lab', 'data-research', 'risk-promote', 'live-trading']
const NODE_TYPES = ['vps', 'local']
const EMPTY_FORM: InstanceFormData = { name: '', host: '', port: 18800, role: 'general', node_type: 'vps' }

// ─── Helpers ────────────────────────────────────────────────────────────────

function agentCount(inst: Instance): number {
  const hb = inst.capabilities?.last_heartbeat as Record<string, unknown> | undefined
  return (hb?.agent_count as number) ?? 0
}

function statusColor(status: string): string {
  const s = status.toUpperCase()
  if (['RUNNING', 'ONLINE'].includes(s)) return 'bg-emerald-500 border-emerald-600'
  if (['IDLE', 'DEGRADED'].includes(s)) return 'bg-amber-500 border-amber-600'
  if (['ERROR', 'OFFLINE'].includes(s)) return 'bg-red-500 border-red-600'
  return 'bg-zinc-400 border-zinc-500'
}

function statusDot(status: string): string {
  const s = status.toUpperCase()
  if (['RUNNING', 'ONLINE'].includes(s)) return 'bg-emerald-500'
  if (['IDLE', 'DEGRADED'].includes(s)) return 'bg-amber-500'
  if (['ERROR', 'OFFLINE'].includes(s)) return 'bg-red-500'
  return 'bg-zinc-400'
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

// ─── Graph nodes ────────────────────────────────────────────────────────────

function InstanceNode({ data }: NodeProps) {
  const color = statusColor(String(data?.status ?? 'unknown'))
  return (
    <div className={`px-4 py-3 rounded-xl border border-white/20 shadow-lg min-w-[140px] backdrop-blur-sm ${color} text-white`}>
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
    <div className={`px-2 py-1.5 rounded-lg border border-white/20 ${color} text-white text-xs`}>
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

function HeartbeatIndicator({ lastHeartbeat }: { lastHeartbeat: string | null }) {
  if (!lastHeartbeat) return <span className="text-xs text-muted-foreground">No heartbeat</span>
  const diff = Date.now() - new Date(lastHeartbeat).getTime()
  const isRecent = diff < 60000
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${isRecent ? 'text-emerald-600' : 'text-amber-600'}`}>
      <span className={`w-2 h-2 rounded-full ${isRecent ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
      {isRecent ? 'Live' : `${Math.floor(diff / 60000)}m ago`}
    </span>
  )
}

// ─── Instance Form Modal ────────────────────────────────────────────────────

function InstanceFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  title,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: InstanceFormData
  onSubmit: (data: InstanceFormData) => Promise<void>
  title: string
}) {
  const [form, setForm] = useState<InstanceFormData>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (open) { setForm(initial); setError('') } }, [open, initial])

  const handleSave = async () => {
    if (!form.name.trim() || !form.host.trim()) {
      setError('Name and Host are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit(form)
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Configure the OpenClaw instance connection details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="inst-name">Name</Label>
            <Input
              id="inst-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="openclaw-prod-1"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="inst-host">Host</Label>
              <Input
                id="inst-host"
                value={form.host}
                onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                placeholder="192.168.1.100"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inst-port">Port</Label>
              <Input
                id="inst-port"
                type="number"
                value={form.port}
                onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) || 18800 }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Node Type</Label>
              <Select value={form.node_type} onValueChange={(v) => setForm((f) => ({ ...f, node_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NODE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Instances Tab ──────────────────────────────────────────────────────────

function InstancesPanel({ instances }: { instances: Instance[] }) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editInstance, setEditInstance] = useState<Instance | null>(null)
  const [deleteInstance, setDeleteInstance] = useState<Instance | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, 'ok' | 'fail' | null>>({})

  const createMutation = useMutation({
    mutationFn: async (data: InstanceFormData) => {
      const res = await api.post('/api/v2/instances', data)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instances'] }),
    onError: (err: unknown) => {
      throw err instanceof Error ? err : new Error('Create failed')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InstanceFormData> }) => {
      const res = await api.patch(`/api/v2/instances/${id}`, data)
      return res.data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['instances'] }); setEditInstance(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/v2/instances/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instances'] }),
  })

  const handleTestConnection = async (inst: Instance) => {
    setTestingId(inst.id)
    setTestResult((prev) => ({ ...prev, [inst.id]: null }))
    try {
      await fetch(`http://${inst.host}:${inst.port}/health`, { signal: AbortSignal.timeout(5000) })
      setTestResult((prev) => ({ ...prev, [inst.id]: 'ok' }))
    } catch {
      setTestResult((prev) => ({ ...prev, [inst.id]: 'fail' }))
    } finally {
      setTestingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {instances.length} instance{instances.length !== 1 ? 's' : ''} registered
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Instance
        </Button>
      </div>

      {instances.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
          <Server className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">No OpenClaw instances registered yet.</p>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Your First Instance
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Host:Port</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Heartbeat</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {instances.map((inst) => (
                  <tr key={inst.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${statusDot(inst.status)}`} />
                        <span className="font-medium">{inst.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {inst.host}:{inst.port}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-xs">
                        {inst.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{inst.node_type}</td>
                    <td className="px-4 py-3"><StatusBadge status={inst.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {timeAgo(inst.last_heartbeat_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Test connection"
                          disabled={testingId === inst.id}
                          onClick={() => handleTestConnection(inst)}
                        >
                          <Wifi className={`h-3.5 w-3.5 ${
                            testResult[inst.id] === 'ok' ? 'text-emerald-500' :
                            testResult[inst.id] === 'fail' ? 'text-red-500' : ''
                          }`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Edit"
                          onClick={() => setEditInstance(inst)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                          title="Delete"
                          onClick={() => setDeleteInstance(inst)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create modal */}
      <InstanceFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initial={EMPTY_FORM}
        title="Add OpenClaw Instance"
        onSubmit={async (data) => { await createMutation.mutateAsync(data) }}
      />

      {/* Edit modal */}
      {editInstance && (
        <InstanceFormDialog
          open={!!editInstance}
          onOpenChange={(v) => { if (!v) setEditInstance(null) }}
          initial={{
            name: editInstance.name,
            host: editInstance.host,
            port: editInstance.port,
            role: editInstance.role,
            node_type: editInstance.node_type,
          }}
          title={`Edit: ${editInstance.name}`}
          onSubmit={async (data) => { await updateMutation.mutateAsync({ id: editInstance.id, data }) }}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteInstance}
        onOpenChange={(v) => { if (!v) setDeleteInstance(null) }}
        title="Delete Instance"
        description={`Are you sure you want to remove "${deleteInstance?.name}"? This will unregister the instance from the control plane.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (deleteInstance) await deleteMutation.mutateAsync(deleteInstance.id)
          setDeleteInstance(null)
        }}
      />
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

type Tab = 'graph' | 'instances'

export default function NetworkPage() {
  const [tab, setTab] = useState<Tab>('graph')
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const fn = () => setIsMobile(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  const { data: instances = [] } = useQuery<Instance[]>({
    queryKey: ['instances'],
    queryFn: async () => {
      const res = await api.get('/api/v2/instances')
      return res.data
    },
    refetchInterval: 10000,
  })

  // ── Graph layout ───
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    let y = 0
    instances.forEach((inst, i) => {
      const ac = agentCount(inst)
      const instId = `inst-${inst.id}`
      nodes.push({
        id: instId,
        type: 'instance',
        position: { x: 100 + i * 220, y },
        data: { label: inst.name, name: inst.name, status: inst.status, agents: ac },
      })
      for (let a = 0; a < ac; a++) {
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
    if (instances.length > 0) {
      edges.push({ id: 'e-svc-conn', source: `inst-${instances[0].id}`, target: 'svc-connector' })
    }
    if (instances.length > 1) {
      edges.push({ id: 'e-svc-exec', source: `inst-${instances[1].id}`, target: 'svc-execution' })
    }
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

  const running = instances.filter((i) => ['RUNNING', 'ONLINE'].includes(i.status.toUpperCase())).length
  const totalAgents = instances.reduce((a, i) => a + agentCount(i), 0)
  const healthy = instances.filter((i) => i.last_heartbeat_at && (Date.now() - new Date(i.last_heartbeat_at).getTime()) < 60000).length

  // ── Tab buttons ───
  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === t
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
    }`

  if (isMobile) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <PageHeader icon={Network} title="Agent Network" description="Instance status and agent connections" />

        <div className="flex gap-2 px-1">
          <button className={tabClass('graph')} onClick={() => setTab('graph')}>Graph</button>
          <button className={tabClass('instances')} onClick={() => setTab('instances')}>Instances</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard title="Instances" value={instances.length} />
          <MetricCard title="Running" value={running} trend="up" />
          <MetricCard title="Total Agents" value={totalAgents} />
          <MetricCard title="Healthy" value={healthy} />
        </div>

        {tab === 'graph' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {instances.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-white/10 p-8 text-center text-muted-foreground">
                No instances — switch to the Instances tab to add one.
              </div>
            ) : (
              instances.map((inst) => (
                <FlexCard key={inst.id} title={inst.name}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <StatusBadge status={inst.status} />
                      <HeartbeatIndicator lastHeartbeat={inst.last_heartbeat_at} />
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      <span>{agentCount(inst)} agent{agentCount(inst) !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Activity className="h-3 w-3" />
                      {inst.host}:{inst.port} · {inst.role}
                    </div>
                  </div>
                </FlexCard>
              ))
            )}
          </div>
        ) : (
          <InstancesPanel instances={instances} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <PageHeader icon={Network} title="Agent Network" description="Instance status and agent connections" />
        <div className="flex gap-2">
          <button className={tabClass('graph')} onClick={() => setTab('graph')}>Graph</button>
          <button className={tabClass('instances')} onClick={() => setTab('instances')}>Instances</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Instances" value={instances.length} />
        <MetricCard title="Running" value={running} trend="up" />
        <MetricCard title="Total Agents" value={totalAgents} />
        <MetricCard title="Healthy" value={healthy} />
      </div>

      {tab === 'graph' ? (
        <div className="rounded-xl border border-white/10 bg-card p-2 sm:p-3 dark:bg-white/[0.02]">
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-4 overflow-x-auto">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Running</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Idle</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Error</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-400" /> Unknown</span>
          </p>
          {instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
              <Server className="h-10 w-10 mb-3" />
              <p>No instances registered. Switch to the <button className="text-primary underline" onClick={() => setTab('instances')}>Instances</button> tab to add one.</p>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 h-[300px] sm:h-[400px] lg:h-[500px]">
              <div className="flex-1 rounded-lg overflow-hidden min-h-0">
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
                <FlexCard title="Node Details" className="w-full lg:w-72 shrink-0 self-start">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{(selectedNode.data?.label ?? selectedNode.id) as string}</span>
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
          )}
        </div>
      ) : (
        <InstancesPanel instances={instances} />
      )}
    </div>
  )
}
