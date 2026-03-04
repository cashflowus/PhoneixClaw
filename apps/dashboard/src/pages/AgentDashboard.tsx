/**
 * AgentDashboard — dedicated per-agent page with Live Trading and Backtesting tabs.
 * Route: /agents/:id
 */
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { MetricCard } from '@/components/ui/MetricCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AreaChart } from '@/components/tremor/AreaChart'
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Rocket,
  Pause,
  Play,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Shield,
} from 'lucide-react'
import type { Agent, AgentBacktest } from '@/types/agent'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface AgentTrade {
  id: string
  symbol: string
  side: string
  qty: number
  fill_price: number | null
  exit_price: number | null
  pnl: number | null
  status: string
  created_at: string
}

interface AgentStats {
  total_pnl: number
  win_rate: number
  sharpe: number
  total_trades: number
}

const MOCK_AGENT_STATS: AgentStats = {
  total_pnl: 5600,
  win_rate: 0.62,
  sharpe: 1.68,
  total_trades: 45,
}

const MOCK_PNL_CURVE = Array.from({ length: 30 }, (_, i) => ({
  date: `Feb ${i + 1}`,
  pnl: Math.round((Math.random() * 800 - 200) * (i + 1) / 10),
})).reduce<{ date: string; pnl: number }[]>((acc, d) => {
  const prev = acc.length ? acc[acc.length - 1].pnl : 0
  acc.push({ date: d.date, pnl: prev + d.pnl })
  return acc
}, [])

const MOCK_TRADES: AgentTrade[] = [
  { id: 't1', symbol: 'SPY', side: 'buy', qty: 100, fill_price: 598.20, exit_price: 601.50, pnl: 330, status: 'CLOSED', created_at: '2025-02-28T14:30:00Z' },
  { id: 't2', symbol: 'QQQ', side: 'sell', qty: 50, fill_price: 510.00, exit_price: 507.20, pnl: 140, status: 'CLOSED', created_at: '2025-02-28T15:10:00Z' },
  { id: 't3', symbol: 'SPY', side: 'buy', qty: 75, fill_price: 601.80, exit_price: 600.10, pnl: -127.5, status: 'CLOSED', created_at: '2025-02-27T10:15:00Z' },
  { id: 't4', symbol: 'AAPL', side: 'buy', qty: 30, fill_price: 225.40, exit_price: null, pnl: null, status: 'OPEN', created_at: '2025-03-01T09:35:00Z' },
  { id: 't5', symbol: 'ES', side: 'sell', qty: 2, fill_price: 5985.00, exit_price: 5972.50, pnl: 250, status: 'CLOSED', created_at: '2025-02-26T13:45:00Z' },
]

const MOCK_BACKTESTS: AgentBacktest[] = [
  {
    id: 'bt1', agent_id: '', status: 'completed', strategy_template: 'momentum', start_date: '2024-01-01', end_date: '2024-12-31',
    parameters: { lookback: 20, threshold: 1.5 }, metrics: { sharpe: 1.68, max_dd: -0.05 },
    equity_curve: [10000, 10200, 10800, 10600, 11200, 11800, 12400, 12100, 12800, 13200, 14000, 14500, 15600],
    total_trades: 45, win_rate: 0.62, sharpe_ratio: 1.68, max_drawdown: -0.05, total_return: 0.56, completed_at: '2025-02-20T08:00:00Z', created_at: '2025-02-20T07:00:00Z',
  },
  {
    id: 'bt2', agent_id: '', status: 'completed', strategy_template: 'momentum-v2', start_date: '2024-06-01', end_date: '2024-12-31',
    parameters: { lookback: 14, threshold: 2.0 }, metrics: { sharpe: 1.42, max_dd: -0.08 },
    equity_curve: [10000, 10100, 10500, 10300, 10900, 11200, 11600, 12000, 12400],
    total_trades: 32, win_rate: 0.56, sharpe_ratio: 1.42, max_drawdown: -0.08, total_return: 0.24, completed_at: '2025-02-18T12:00:00Z', created_at: '2025-02-18T11:00:00Z',
  },
]

const LIVE_STATUSES = new Set(['LIVE', 'PAPER', 'RUNNING'])

const tradeColumns: Column<AgentTrade>[] = [
  { id: 'symbol', header: 'Symbol', cell: (r) => <span className="font-mono font-semibold">{r.symbol}</span> },
  {
    id: 'side', header: 'Side',
    cell: (r) => <Badge variant={r.side === 'buy' ? 'default' : 'destructive'} className="uppercase text-xs">{r.side}</Badge>,
  },
  { id: 'qty', header: 'Size', cell: (r) => r.qty },
  { id: 'fill_price', header: 'Entry', cell: (r) => r.fill_price ? `$${r.fill_price.toFixed(2)}` : '—' },
  { id: 'exit_price', header: 'Exit', cell: (r) => r.exit_price ? `$${r.exit_price.toFixed(2)}` : '—' },
  {
    id: 'pnl', header: 'P&L',
    cell: (r) => r.pnl != null ? (
      <span className={cn('font-mono font-medium', r.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
        {r.pnl >= 0 ? '+' : ''}${r.pnl.toFixed(2)}
      </span>
    ) : '—',
  },
  {
    id: 'status', header: 'Status',
    cell: (r) => <StatusBadge status={r.status} />,
  },
  {
    id: 'created_at', header: 'Time',
    cell: (r) => new Date(r.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
  },
]

const backtestColumns: Column<AgentBacktest>[] = [
  { id: 'strategy_template', header: 'Strategy', cell: (r) => <span className="font-medium">{r.strategy_template ?? '—'}</span> },
  { id: 'start_date', header: 'Start', cell: (r) => r.start_date ?? '—' },
  { id: 'end_date', header: 'End', cell: (r) => r.end_date ?? '—' },
  {
    id: 'total_return', header: 'Return',
    cell: (r) => {
      const ret = r.total_return ?? 0
      return <span className={cn('font-mono font-medium', ret >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
        {ret >= 0 ? '+' : ''}{(ret * 100).toFixed(1)}%
      </span>
    },
  },
  { id: 'sharpe_ratio', header: 'Sharpe', cell: (r) => (r.sharpe_ratio ?? 0).toFixed(2) },
  { id: 'total_trades', header: 'Trades', cell: (r) => r.total_trades },
  { id: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
]

export default function AgentDashboardPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [configOpen, setConfigOpen] = useState(false)
  const [selectedBt, setSelectedBt] = useState<AgentBacktest | null>(null)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [approveForm, setApproveForm] = useState({
    trading_mode: 'paper',
    account_id: '',
    stop_loss_pct: 2.0,
    target_profit_pct: 5.0,
    max_daily_loss_pct: 5.0,
    max_position_pct: 10.0,
  })

  const openApproveDialog = () => {
    const cfg = (agent?.config ?? {}) as Record<string, unknown>
    setApproveForm({
      trading_mode: 'paper',
      account_id: '',
      stop_loss_pct: typeof cfg.stop_loss_pct === 'number' ? cfg.stop_loss_pct : 2.0,
      target_profit_pct: typeof cfg.target_profit_pct === 'number' ? cfg.target_profit_pct : 5.0,
      max_daily_loss_pct: typeof cfg.max_daily_loss_pct === 'number' ? cfg.max_daily_loss_pct : 5.0,
      max_position_pct: typeof cfg.max_position_pct === 'number' ? cfg.max_position_pct : 10.0,
    })
    setApproveDialogOpen(true)
  }

  const { data: agent, isLoading: agentLoading } = useQuery<Agent>({
    queryKey: ['agent', id],
    queryFn: async () => {
      try {
        const res = await api.get(`/api/v2/agents/${id}`)
        return res.data
      } catch {
        return {
          id: id ?? 'unknown',
          name: 'SPY-Momentum',
          type: 'trading',
          status: 'CREATED',
          instance_id: 'inst-1',
          config: { max_daily_loss_pct: 5, max_position_pct: 10, stop_loss_pct: 2 },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } satisfies Agent
      }
    },
    enabled: !!id,
  })

  const { data: agentStats = MOCK_AGENT_STATS } = useQuery<AgentStats>({
    queryKey: ['agent-stats', id],
    queryFn: async () => {
      try {
        return await (await api.get(`/api/v2/agents/${id}/stats`)).data
      } catch {
        return MOCK_AGENT_STATS
      }
    },
    enabled: !!id,
  })

  const { data: agentTrades = MOCK_TRADES } = useQuery<AgentTrade[]>({
    queryKey: ['agent-trades', id],
    queryFn: async () => {
      try {
        const result = (await api.get(`/api/v2/trades?agent_id=${id}`)).data
        return result?.length ? result : MOCK_TRADES
      } catch {
        return MOCK_TRADES
      }
    },
    enabled: !!id,
    refetchInterval: 10000,
  })

  const { data: backtests = MOCK_BACKTESTS } = useQuery<AgentBacktest[]>({
    queryKey: ['agent-backtests', id],
    queryFn: async () => {
      try {
        const result = (await api.get(`/api/v2/backtests?agent_id=${id}`)).data
        return result?.length ? result : MOCK_BACKTESTS
      } catch {
        return MOCK_BACKTESTS
      }
    },
    enabled: !!id,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['agent', id] })
    queryClient.invalidateQueries({ queryKey: ['agent-stats', id] })
  }

  const { data: brokerAccounts = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['broker-accounts'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/connectors')
        return (res.data || []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))
      } catch {
        return [
          { id: 'paper-default', name: 'Paper Trading (Default)' },
          { id: 'ib-live', name: 'Interactive Brokers - Live' },
          { id: 'td-live', name: 'TD Ameritrade - Live' },
        ]
      }
    },
  })

  const approveMutation = useMutation({
    mutationFn: (payload: typeof approveForm) =>
      api.post(`/api/v2/agents/${id}/approve`, payload),
    onSuccess: () => {
      invalidate()
      setApproveDialogOpen(false)
      toast.success('Agent approved successfully')
    },
    onError: () => {
      toast.error('Failed to approve agent')
    },
  })
  const promoteMutation = useMutation({
    mutationFn: () => api.post(`/api/v2/agents/${id}/promote`),
    onSuccess: invalidate,
  })
  const pauseMutation = useMutation({
    mutationFn: () => api.post(`/api/v2/agents/${id}/pause`),
    onSuccess: invalidate,
  })
  const resumeMutation = useMutation({
    mutationFn: () => api.post(`/api/v2/agents/${id}/resume`),
    onSuccess: invalidate,
  })

  if (agentLoading || !agent) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  const isLive = LIVE_STATUSES.has(agent.status)

  const equityCurveData = selectedBt
    ? selectedBt.equity_curve.map((v, i) => ({ period: `${i + 1}`, equity: v }))
    : []

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate('/agents')} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Bot className="h-6 w-6 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">{agent.name}</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <Badge variant="outline" className="text-xs">{agent.type}</Badge>
              <StatusBadge status={agent.status} />
              <span className="text-xs text-muted-foreground">ID: {agent.id.slice(0, 8)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(agent.status === 'CREATED' || agent.status === 'BACKTESTING' || agent.status === 'BACKTEST_COMPLETE') && (
            <Button variant="outline" size="sm" onClick={openApproveDialog}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
            </Button>
          )}
          {(agent.status === 'APPROVED' || agent.status === 'BACKTEST_COMPLETE' || agent.status === 'REVIEW_PENDING') && (
            <Button size="sm" onClick={() => promoteMutation.mutate()} disabled={promoteMutation.isPending}>
              <Rocket className="h-4 w-4 mr-1" /> Promote
            </Button>
          )}
          {agent.status === 'RUNNING' || agent.status === 'LIVE' ? (
            <Button variant="outline" size="sm" onClick={() => pauseMutation.mutate()} disabled={pauseMutation.isPending}>
              <Pause className="h-4 w-4 mr-1" /> Pause
            </Button>
          ) : null}
          {agent.status === 'PAUSED' && (
            <Button size="sm" onClick={() => resumeMutation.mutate()} disabled={resumeMutation.isPending}>
              <Play className="h-4 w-4 mr-1" /> Resume
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="live">
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="live">Live Trading</TabsTrigger>
          <TabsTrigger value="backtest">Backtesting</TabsTrigger>
        </TabsList>

        {/* === Live Trading Tab === */}
        <TabsContent value="live" className="space-y-4 mt-4">
          {!isLive ? (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 sm:p-6">
                <AlertTriangle className="h-8 w-8 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">This agent is not approved for live trading yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Current status: <strong>{agent.status}</strong>. Approve and promote the agent to start live trading.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {(agent.status === 'CREATED' || agent.status === 'BACKTESTING' || agent.status === 'BACKTEST_COMPLETE') && (
                    <Button size="sm" onClick={openApproveDialog}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                    </Button>
                  )}
                  {(agent.status === 'APPROVED' || agent.status === 'BACKTEST_COMPLETE') && (
                    <Button size="sm" onClick={() => promoteMutation.mutate()} disabled={promoteMutation.isPending}>
                      <Rocket className="h-4 w-4 mr-1" /> Promote
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <MetricCard
              title="Total P&L"
              value={`$${agentStats.total_pnl.toLocaleString()}`}
              trend={agentStats.total_pnl >= 0 ? 'up' : 'down'}
            />
            <MetricCard
              title="Win Rate"
              value={`${(agentStats.win_rate * 100).toFixed(1)}%`}
            />
            <MetricCard
              title="Sharpe Ratio"
              value={agentStats.sharpe.toFixed(2)}
            />
            <MetricCard
              title="Total Trades"
              value={agentStats.total_trades}
            />
          </div>

          {/* P&L Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cumulative P&L</CardTitle>
            </CardHeader>
            <CardContent>
              <AreaChart
                data={MOCK_PNL_CURVE as Record<string, unknown>[]}
                index="date"
                categories={['pnl']}
                colors={['hsl(var(--chart-1))']}
                showLegend={false}
                valueFormatter={(v) => `$${v.toLocaleString()}`}
                className="h-48 sm:h-64"
              />
            </CardContent>
          </Card>

          {/* Recent Trades */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Recent Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <DataTable
                  columns={tradeColumns}
                  data={agentTrades as (AgentTrade & Record<string, unknown>)[]}
                  emptyMessage="No trades yet for this agent."
                />
              </div>
            </CardContent>
          </Card>

          {/* Agent Config */}
          {agent.config && Object.keys(agent.config).length > 0 && (
            <Card>
              <CardHeader
                className="pb-2 cursor-pointer select-none"
                onClick={() => setConfigOpen(!configOpen)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Agent Configuration</CardTitle>
                  {configOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </CardHeader>
              {configOpen && (
                <CardContent>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-60 font-mono">
                    {JSON.stringify(agent.config, null, 2)}
                  </pre>
                </CardContent>
              )}
            </Card>
          )}
        </TabsContent>

        {/* === Backtesting Tab === */}
        <TabsContent value="backtest" className="space-y-4 mt-4">
          {/* Backtest summary from latest run */}
          {backtests.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <MetricCard
                title="Total Return"
                value={`${((backtests[0].total_return ?? 0) * 100).toFixed(1)}%`}
                trend={(backtests[0].total_return ?? 0) >= 0 ? 'up' : 'down'}
              />
              <MetricCard
                title="Win Rate"
                value={`${((backtests[0].win_rate ?? 0) * 100).toFixed(1)}%`}
              />
              <MetricCard
                title="Sharpe Ratio"
                value={(backtests[0].sharpe_ratio ?? 0).toFixed(2)}
              />
              <MetricCard
                title="Max Drawdown"
                value={`${((backtests[0].max_drawdown ?? 0) * 100).toFixed(1)}%`}
                trend="down"
              />
            </div>
          )}

          {/* Equity Curve */}
          {selectedBt && equityCurveData.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Equity Curve — {selectedBt.strategy_template}
                  <Button variant="ghost" size="sm" className="ml-2 text-xs h-6" onClick={() => setSelectedBt(null)}>
                    Clear
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AreaChart
                  data={equityCurveData as Record<string, unknown>[]}
                  index="period"
                  categories={['equity']}
                  colors={['hsl(var(--chart-2))']}
                  showLegend={false}
                  valueFormatter={(v) => `$${v.toLocaleString()}`}
                  className="h-48 sm:h-64"
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Click a backtest row below to view its equity curve.
              </CardContent>
            </Card>
          )}

          {/* Backtest Runs Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Backtest Runs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <DataTable
                  columns={backtestColumns}
                  data={backtests as (AgentBacktest & Record<string, unknown>)[]}
                  emptyMessage="No backtest runs yet."
                  onRowClick={(row) => setSelectedBt(row as unknown as AgentBacktest)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Approve Agent: {agent.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Trading Mode */}
            <div>
              <Label className="mb-2 block">Trading Account</Label>
              <div className="flex gap-3">
                <label className={cn(
                  'flex-1 flex items-center gap-2 rounded-lg border-2 p-3 cursor-pointer transition-all',
                  approveForm.trading_mode === 'paper'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30',
                )}>
                  <input
                    type="radio"
                    name="trading_mode"
                    value="paper"
                    checked={approveForm.trading_mode === 'paper'}
                    onChange={() => setApproveForm((f) => ({ ...f, trading_mode: 'paper', account_id: '' }))}
                    className="accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium">Paper Trading</p>
                    <p className="text-xs text-muted-foreground">Simulated trades, no real capital</p>
                  </div>
                </label>
                <label className={cn(
                  'flex-1 flex items-center gap-2 rounded-lg border-2 p-3 cursor-pointer transition-all',
                  approveForm.trading_mode === 'live'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30',
                )}>
                  <input
                    type="radio"
                    name="trading_mode"
                    value="live"
                    checked={approveForm.trading_mode === 'live'}
                    onChange={() => setApproveForm((f) => ({ ...f, trading_mode: 'live' }))}
                    className="accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium">Live Trading</p>
                    <p className="text-xs text-muted-foreground">Real trades with real capital</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Broker Account (only if live) */}
            {approveForm.trading_mode === 'live' && (
              <div>
                <Label>Broker Account</Label>
                <Select value={approveForm.account_id} onValueChange={(v) => setApproveForm((f) => ({ ...f, account_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select broker account..." /></SelectTrigger>
                  <SelectContent>
                    {brokerAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Risk Parameters */}
            <div>
              <Label className="mb-2 block">Risk Parameters</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Stop Loss %</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0.1"
                    max="50"
                    value={approveForm.stop_loss_pct}
                    onChange={(e) => setApproveForm((f) => ({ ...f, stop_loss_pct: parseFloat(e.target.value) || 2 }))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Target Profit %</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0.1"
                    max="100"
                    value={approveForm.target_profit_pct}
                    onChange={(e) => setApproveForm((f) => ({ ...f, target_profit_pct: parseFloat(e.target.value) || 5 }))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Max Daily Loss %</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0.1"
                    max="50"
                    value={approveForm.max_daily_loss_pct}
                    onChange={(e) => setApproveForm((f) => ({ ...f, max_daily_loss_pct: parseFloat(e.target.value) || 5 }))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Max Position Size %</Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    max="100"
                    value={approveForm.max_position_pct}
                    onChange={(e) => setApproveForm((f) => ({ ...f, max_position_pct: parseFloat(e.target.value) || 10 }))}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setApproveDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => approveMutation.mutate(approveForm)}
                disabled={approveMutation.isPending || (approveForm.trading_mode === 'live' && !approveForm.account_id)}
              >
                {approveMutation.isPending ? 'Approving...' : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Approve & Launch
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
