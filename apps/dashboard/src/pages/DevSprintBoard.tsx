/**
 * Dev Sprint Board — admin-only error log tracking and agent fix status.
 * Shows metrics, filterable DataTable, tabs, error detail panel, Trigger Agent Review.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { MetricCard } from '@/components/ui/MetricCard'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Bug, AlertCircle, Wrench, UserCog, CheckCircle, Play } from 'lucide-react'

interface ErrorLog extends Record<string, unknown> {
  id: string
  component: string
  message: string
  stack?: string
  url: string
  source: string
  severity: string
  status: string
  fix_attempt_count: number
  fix_notes?: string
  created_at: string
  updated_at: string
  resolved_at?: string
}

interface Stats {
  total: number
  open: number
  fixed_by_agent: number
  fixed_by_admin: number
  needs_admin: number
  fix_rate_pct: number
}

const statusColors: Record<string, string> = {
  open: 'bg-amber-500/20 text-amber-600',
  investigating: 'bg-blue-500/20 text-blue-600',
  fixed_by_agent: 'bg-emerald-500/20 text-emerald-600',
  fixed_by_admin: 'bg-emerald-500/20 text-emerald-600',
  wont_fix: 'bg-muted text-muted-foreground',
  needs_admin: 'bg-red-500/20 text-red-600',
}

const columns: Column<ErrorLog>[] = [
  { id: 'component', header: 'Component', accessor: 'component', cell: (r) => <span className="font-mono text-xs">{r.component}</span> },
  {
    id: 'message',
    header: 'Message',
    cell: (r) => <span className="max-w-[280px] truncate block" title={r.message}>{r.message}</span>,
  },
  { id: 'source', header: 'Source', accessor: 'source' },
  { id: 'severity', header: 'Severity', cell: (r) => <Badge variant="outline">{r.severity}</Badge> },
  { id: 'status', header: 'Status', cell: (r) => <span className={statusColors[r.status] ?? ''}>{r.status}</span> },
  { id: 'created_at', header: 'First Seen', cell: (r) => new Date(r.created_at).toLocaleString() },
  { id: 'updated_at', header: 'Last Seen', cell: (r) => new Date(r.updated_at).toLocaleString() },
]

export default function DevSprintBoardPage() {
  const qc = useQueryClient()
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data: stats = {} as Stats } = useQuery({
    queryKey: ['error-logs-stats'],
    queryFn: async () => (await api.get('/api/v2/error-logs/stats')).data,
    refetchInterval: 30000,
  })

  const { data: openList = [], refetch: refetchOpen } = useQuery<ErrorLog[]>({
    queryKey: ['error-logs', 'open'],
    queryFn: async () => (await api.get('/api/v2/error-logs', { params: { status: 'open' } })).data,
  })

  const { data: agentFixList = [], refetch: refetchAgent } = useQuery<ErrorLog[]>({
    queryKey: ['error-logs', 'agent-fixes'],
    queryFn: async () => {
      const all = (await api.get('/api/v2/error-logs')).data as ErrorLog[]
      return all.filter((e) => e.status === 'fixed_by_agent' || e.status === 'investigating')
    },
  })

  const { data: needsAdminList = [] } = useQuery<ErrorLog[]>({
    queryKey: ['error-logs', 'needs-admin'],
    queryFn: async () => (await api.get('/api/v2/error-logs', { params: { status: 'needs_admin' } })).data,
  })

  const { data: resolvedList = [] } = useQuery<ErrorLog[]>({
    queryKey: ['error-logs', 'resolved'],
    queryFn: async () => {
      const all = (await api.get('/api/v2/error-logs')).data as ErrorLog[]
      return all.filter((e) => ['fixed_by_agent', 'fixed_by_admin', 'wont_fix'].includes(e.status))
    },
  })

  const triggerReviewMutation = useMutation({
    mutationFn: () => api.post('/api/v2/error-logs/trigger-agent-review'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['error-logs-stats'] })
      refetchOpen()
      refetchAgent()
    },
  })

  const { data: detailLog } = useQuery({
    queryKey: ['error-log-detail', detailId],
    queryFn: async () => (await api.get(`/api/v2/error-logs/${detailId}`)).data,
    enabled: !!detailId,
  })

  const updateStatus = async (id: string, status: string) => {
    await api.patch(`/api/v2/error-logs/${id}`, { status })
    qc.invalidateQueries({ queryKey: ['error-logs-stats'] })
    qc.invalidateQueries({ queryKey: ['error-logs'] })
    if (detailId === id) setDetailId(null)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        icon={Bug}
        title="Dev Sprint Board"
        description="Error logs and agent fix tracking. Admin only."
      >
        <Button
          size="sm"
          onClick={() => triggerReviewMutation.mutate()}
          disabled={triggerReviewMutation.isPending}
        >
          <Play className="h-4 w-4 mr-1" />
          Trigger Agent Review
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Open Errors" value={stats.open ?? 0} icon={AlertCircle} />
        <MetricCard title="Fixed by Agent" value={stats.fixed_by_agent ?? 0} icon={Wrench} />
        <MetricCard title="Needs Admin" value={stats.needs_admin ?? 0} icon={UserCog} />
        <MetricCard title="Fix Rate %" value={`${stats.fix_rate_pct ?? 0}%`} icon={CheckCircle} />
      </div>

      <Tabs defaultValue="open" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="open">Open Errors</TabsTrigger>
          <TabsTrigger value="agent">Agent Fixes</TabsTrigger>
          <TabsTrigger value="admin">Needs Admin</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="space-y-4">
          <div className="overflow-x-auto">
            <DataTable<ErrorLog>
              columns={columns}
              data={openList}
              onRowClick={(row) => setDetailId(row.id)}
              emptyMessage="No open errors"
            />
          </div>
        </TabsContent>
        <TabsContent value="agent" className="space-y-4">
          <div className="overflow-x-auto">
            <DataTable<ErrorLog>
              columns={[...columns, { id: 'fix_attempt_count', header: 'Attempts', accessor: 'fix_attempt_count' }, { id: 'fix_notes', header: 'Notes', cell: (r) => (r.fix_notes ? <span className="max-w-[200px] truncate block">{r.fix_notes}</span> : '—') }]}
              data={agentFixList}
              onRowClick={(row) => setDetailId(row.id)}
              emptyMessage="No agent-fixed errors"
            />
          </div>
        </TabsContent>
        <TabsContent value="admin" className="space-y-4">
          <div className="overflow-x-auto">
            <DataTable<ErrorLog>
              columns={columns}
              data={needsAdminList}
              onRowClick={(row) => setDetailId(row.id)}
              emptyMessage="None need admin attention"
            />
          </div>
        </TabsContent>
        <TabsContent value="resolved" className="space-y-4">
          <div className="overflow-x-auto">
            <DataTable<ErrorLog>
              columns={columns}
              data={resolvedList}
              onRowClick={(row) => setDetailId(row.id)}
              emptyMessage="No resolved errors yet"
            />
          </div>
        </TabsContent>
      </Tabs>

      <Sheet open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Error detail</SheetTitle>
          </SheetHeader>
          {detailLog && !('detail' in detailLog) && (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">Component</p>
                <p className="font-mono">{detailLog.component}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Message</p>
                <p className="break-words">{detailLog.message}</p>
              </div>
              {detailLog.stack && (
                <div>
                  <p className="text-muted-foreground">Stack</p>
                  <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">{detailLog.stack}</pre>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">URL</p>
                <p className="break-all text-xs">{detailLog.url}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p>{detailLog.status}</p>
              </div>
              {detailLog.status === 'open' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => updateStatus(detailLog.id, 'wont_fix')}>
                    Mark Won&apos;t Fix
                  </Button>
                  <Button size="sm" onClick={() => updateStatus(detailLog.id, 'fixed_by_admin')}>
                    Mark Fixed
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
