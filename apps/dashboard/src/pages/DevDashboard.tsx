/**
 * Dev Dashboard — admin-only page showing Dev Agent activity,
 * RL metrics, incident feed, and code changes.
 * M3.3.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { MetricCard } from '@/components/ui/MetricCard'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { FlexCard } from '@/components/ui/FlexCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Shield, AlertTriangle, Wrench, Brain } from 'lucide-react'

interface Incident {
  id: string
  type: string
  agent_id: string
  severity: string
  message: string
  detected_at: string
  resolved: boolean
}

interface Repair {
  id: string
  agent_id: string
  action: string
  result: string
  applied_at: string
}

interface DevStatus {
  status: string
  incidents_detected: number
  repairs_applied: number
  rl_episodes: number
  rl_reward_avg: number
}

const incidentColumns: Column<Incident>[] = [
  { id: 'type', header: 'Type', cell: (r) => <Badge variant="outline">{r.type}</Badge> },
  { id: 'agent_id', header: 'Agent', cell: (r) => <span className="font-mono text-xs">{r.agent_id}</span> },
  { id: 'severity', header: 'Severity', cell: (r) => <StatusBadge status={r.severity} /> },
  { id: 'message', header: 'Message', accessor: 'message' },
  { id: 'detected_at', header: 'Detected', cell: (r) => new Date(r.detected_at).toLocaleString() },
  { id: 'resolved', header: 'Resolved', cell: (r) => r.resolved ? 'Yes' : 'No' },
]

const repairColumns: Column<Repair>[] = [
  { id: 'agent_id', header: 'Agent', cell: (r) => <span className="font-mono text-xs">{r.agent_id}</span> },
  { id: 'action', header: 'Action', accessor: 'action' },
  { id: 'result', header: 'Result', cell: (r) => <StatusBadge status={r.result} /> },
  { id: 'applied_at', header: 'Applied', cell: (r) => new Date(r.applied_at).toLocaleString() },
]

export default function DevDashboard() {
  const { data: devStatus } = useQuery<DevStatus>({
    queryKey: ['dev-agent-status'],
    queryFn: async () => (await api.get('/api/v2/dev-agent/status')).data,
    refetchInterval: 10000,
  })

  const { data: incidents = [], isLoading: incidentsLoading } = useQuery<Incident[]>({
    queryKey: ['dev-incidents'],
    queryFn: async () => (await api.get('/api/v2/dev-agent/incidents')).data,
    refetchInterval: 15000,
  })

  const { data: repairs = [], isLoading: repairsLoading } = useQuery<Repair[]>({
    queryKey: ['dev-repairs'],
    queryFn: async () => (await api.get('/api/v2/dev-agent/repairs')).data,
    refetchInterval: 15000,
  })

  const { data: rlMetrics } = useQuery({
    queryKey: ['rl-metrics'],
    queryFn: async () => (await api.get('/api/v2/dev-agent/rl-metrics')).data,
    refetchInterval: 30000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">Dev Dashboard</h2>
          <p className="text-muted-foreground">Admin-only — Dev Agent monitoring and RL metrics</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Dev Agent"
          value={devStatus?.status ?? 'Loading...'}
          trend={devStatus?.status === 'RUNNING' ? 'up' : 'neutral'}
        />
        <MetricCard title="Incidents" value={devStatus?.incidents_detected ?? 0} />
        <MetricCard title="Repairs" value={devStatus?.repairs_applied ?? 0} trend="up" />
        <MetricCard
          title="RL Episodes"
          value={devStatus?.rl_episodes ?? 0}
          subtitle={`Avg reward: ${devStatus?.rl_reward_avg?.toFixed(2) ?? '0.00'}`}
        />
      </div>

      <Tabs defaultValue="incidents">
        <TabsList>
          <TabsTrigger value="incidents" className="gap-2">
            <AlertTriangle className="h-4 w-4" /> Incidents
          </TabsTrigger>
          <TabsTrigger value="repairs" className="gap-2">
            <Wrench className="h-4 w-4" /> Auto-Repairs
          </TabsTrigger>
          <TabsTrigger value="rl" className="gap-2">
            <Brain className="h-4 w-4" /> RL Metrics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incidents" className="mt-4">
          <DataTable
            columns={incidentColumns}
            data={incidents as (Incident & Record<string, unknown>)[]}
            isLoading={incidentsLoading}
            emptyMessage="No incidents detected"
          />
        </TabsContent>

        <TabsContent value="repairs" className="mt-4">
          <DataTable
            columns={repairColumns}
            data={repairs as (Repair & Record<string, unknown>)[]}
            isLoading={repairsLoading}
            emptyMessage="No auto-repairs applied"
          />
        </TabsContent>

        <TabsContent value="rl" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FlexCard title="Q-Learning Stats">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Episodes</span>
                  <span>{rlMetrics?.total_episodes ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average Reward</span>
                  <span>{rlMetrics?.avg_reward?.toFixed(4) ?? '0.0000'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Q-Table Size</span>
                  <span>{rlMetrics?.q_table_size ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Update</span>
                  <span>{rlMetrics?.last_update ?? 'Never'}</span>
                </div>
              </div>
            </FlexCard>
            <FlexCard title="Agent Health Grid">
              <p className="text-sm text-muted-foreground">
                Real-time agent health monitoring will be displayed here
                once agents are running.
              </p>
            </FlexCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
