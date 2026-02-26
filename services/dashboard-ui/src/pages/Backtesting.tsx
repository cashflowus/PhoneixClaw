import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Loader2, BarChart3, TrendingUp, TrendingDown, DollarSign, Activity, ChevronRight, X, RefreshCw, Download, ChevronDown } from 'lucide-react'
import { exportToCSV } from '@/lib/csv-export'

interface Source {
  id: string
  display_name: string
  source_type: string
}

interface Channel {
  id: string
  channel_identifier: string
  display_name: string
}

interface Account {
  id: string
  display_name: string
  broker_type: string
}

interface BacktestRun {
  id: string
  name: string | null
  data_source_id: string | null
  channel_id: string | null
  trading_account_id: string | null
  start_date: string
  end_date: string
  status: string
  summary: Record<string, unknown> | null
  error_message: string | null
  created_at: string
}

interface BacktestTrade {
  id: number
  trade_id: string
  ticker: string
  strike: number
  option_type: string
  action: string
  quantity: string
  entry_price: number
  exit_price: number | null
  entry_ts: string
  exit_ts: string | null
  exit_reason: string | null
  realized_pnl: number | null
  raw_message: string | null
}

const wizardSteps = [
  { label: 'Timeframe', key: 'timeframe' },
  { label: 'Data Source & Channel', key: 'source' },
  { label: 'Trading Account', key: 'account' },
  { label: 'Run', key: 'run' },
]

export default function Backtesting() {
  const qc = useQueryClient()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [form, setForm] = useState({
    start_date: '',
    end_date: '',
    data_source_id: '',
    channel_id: '',
    trading_account_id: '',
    name: '',
    profit_target: '30',
    stop_loss: '20',
  })

  const hasRunningBacktest = (runs?: BacktestRun[]) => runs?.some(r => r.status === 'running')

  const { data: runs, isLoading: runsLoading } = useQuery<BacktestRun[]>({
    queryKey: ['backtest'],
    queryFn: () => axios.get('/api/v1/backtest').then(r => r.data),
    refetchInterval: (query) => hasRunningBacktest(query.state.data) ? 3000 : false,
  })

  const { data: sources } = useQuery<Source[]>({
    queryKey: ['sources'],
    queryFn: () => axios.get('/api/v1/sources').then(r => r.data),
  })

  const { data: channels, isLoading: channelsLoading, refetch: refetchChannels } = useQuery<Channel[]>({
    queryKey: ['channels', form.data_source_id],
    queryFn: () => axios.get(`/api/v1/sources/${form.data_source_id}/channels`).then(r => r.data),
    enabled: !!form.data_source_id,
  })

  const [syncing, setSyncing] = useState(false)
  const handleSyncChannels = async () => {
    if (!form.data_source_id) return
    setSyncing(true)
    try {
      await axios.post(`/api/v1/sources/${form.data_source_id}/sync-channels`)
      await refetchChannels()
    } catch {
      setBtError('Failed to sync channels. Check that the data source has channel IDs configured.')
    }
    setSyncing(false)
  }

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => axios.get('/api/v1/accounts').then(r => r.data),
  })

  const selectedRun = runs?.find(r => r.id === selectedRunId)

  const { data: tradesData } = useQuery<{ trades: BacktestTrade[] }>({
    queryKey: ['backtest', selectedRunId, 'trades'],
    queryFn: () => axios.get(`/api/v1/backtest/${selectedRunId}/trades`).then(r => r.data),
    enabled: !!selectedRunId,
  })

  const [btError, setBtError] = useState<string | null>(null)
  const [btSuccess, setBtSuccess] = useState<string | null>(null)
  const [expandedTradeId, setExpandedTradeId] = useState<number | null>(null)
  const [prevRunningIds, setPrevRunningIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!runs) return
    const currentRunning = new Set(runs.filter(r => r.status === 'running').map(r => r.id))
    for (const id of prevRunningIds) {
      if (!currentRunning.has(id)) {
        const run = runs.find(r => r.id === id)
        if (run?.status === 'completed') {
          const pnl = (run.summary as Record<string, number> | null)?.total_pnl ?? 0
          setBtSuccess(`Backtest "${run.name || run.id.slice(0, 8)}" completed — P&L $${pnl.toFixed(2)}`)
          qc.invalidateQueries({ queryKey: ['notifications-unread'] })
          qc.invalidateQueries({ queryKey: ['notifications'] })
        } else if (run?.status === 'failed') {
          setBtError(`Backtest "${run.name || run.id.slice(0, 8)}" failed: ${run.error_message || 'Unknown error'}`)
        }
      }
    }
    setPrevRunningIds(currentRunning)
  }, [runs, prevRunningIds, qc])

  useEffect(() => {
    if (btError) {
      const t = setTimeout(() => setBtError(null), 8000)
      return () => clearTimeout(t)
    }
  }, [btError])

  useEffect(() => {
    if (btSuccess) {
      const t = setTimeout(() => setBtSuccess(null), 8000)
      return () => clearTimeout(t)
    }
  }, [btSuccess])

  const createMutation = useMutation({
    mutationFn: (payload: object) => axios.post('/api/v1/backtest', payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['backtest'] })
      setWizardOpen(false)
      setStep(0)
      setForm({ start_date: '', end_date: '', data_source_id: '', channel_id: '', trading_account_id: '', name: '', profit_target: '30', stop_loss: '20' })
      setSelectedRunId(res.data.id)
      setBtSuccess('Backtest started — running in background. You will be notified when it completes.')
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) && err.response?.data?.detail
        ? err.response.data.detail
        : 'Failed to create backtest. Please try again.'
      setBtError(msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/v1/backtest/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backtest'] })
      if (selectedRunId) setSelectedRunId(null)
    },
    onError: () => setBtError('Failed to delete backtest run.'),
  })

  const handleDeleteRun = (id: string, name: string | null) => {
    if (window.confirm(`Delete backtest "${name || id.slice(0, 8)}"? This cannot be undone.`)) {
      deleteMutation.mutate(id)
    }
  }

  const handleRun = () => {
    const start = form.start_date ? `${form.start_date}T00:00:00Z` : ''
    const end = form.end_date ? `${form.end_date}T23:59:59Z` : ''
    const pt = parseFloat(form.profit_target) / 100
    const sl = parseFloat(form.stop_loss) / 100
    createMutation.mutate({
      start_date: start,
      end_date: end,
      data_source_id: form.data_source_id,
      channel_id: form.channel_id,
      trading_account_id: form.trading_account_id,
      name: form.name || undefined,
      profit_target: isNaN(pt) ? 0.30 : pt,
      stop_loss: isNaN(sl) ? 0.20 : sl,
    })
  }

  const canProceed = () => {
    if (step === 0) return form.start_date && form.end_date && form.start_date <= form.end_date
    if (step === 1) return form.data_source_id && form.channel_id
    if (step === 2) return form.trading_account_id
    return true
  }

  const summary = selectedRun?.summary as Record<string, number> | undefined
  const trades = tradesData?.trades ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Simulate trading signals from Discord history against your account config
        </p>
        <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setStep(0); setForm({ start_date: '', end_date: '', data_source_id: '', channel_id: '', trading_account_id: '', name: '', profit_target: '30', stop_loss: '20' }) }}>
              <Plus className="mr-2 h-4 w-4" /> New Backtest
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New Backtest</DialogTitle>
              <DialogDescription>Configure and run a backtest over historical Discord messages.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="flex gap-2">
                {wizardSteps.map((s, i) => (
                  <div key={s.key} className="flex items-center gap-1">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${i <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {i + 1}
                    </div>
                    {i < wizardSteps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                ))}
              </div>

              {step === 0 && (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>End Date</Label>
                    <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Data Source</Label>
                    <Select value={form.data_source_id} onValueChange={v => setForm(f => ({ ...f, data_source_id: v, channel_id: '' }))}>
                      <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                      <SelectContent>
                        {sources?.map(s => <SelectItem key={s.id} value={s.id}>{s.display_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Channel</Label>
                    {channelsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading channels...
                      </div>
                    ) : channels && channels.length > 0 ? (
                      <Select value={form.channel_id} onValueChange={v => setForm(f => ({ ...f, channel_id: v }))} disabled={!form.data_source_id}>
                        <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
                        <SelectContent>
                          {channels.map(c => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : form.data_source_id ? (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">No channels found.</p>
                        <Button type="button" variant="outline" size="sm" onClick={handleSyncChannels} disabled={syncing}>
                          {syncing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                          Sync Channels
                        </Button>
                      </div>
                    ) : (
                      <Select disabled><SelectTrigger><SelectValue placeholder="Select a source first" /></SelectTrigger><SelectContent /></Select>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Trading Account</Label>
                    <Select value={form.trading_account_id} onValueChange={v => setForm(f => ({ ...f, trading_account_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.display_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Name (optional)</Label>
                    <Input placeholder="e.g. SPX Weekly Jan 2025" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Take Profit %</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min={1}
                          max={500}
                          value={form.profit_target}
                          onChange={e => setForm(f => ({ ...f, profit_target: e.target.value }))}
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Exit at this profit (default 30%)</p>
                    </div>
                    <div className="grid gap-2">
                      <Label>Stop Loss %</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={form.stop_loss}
                          onChange={e => setForm(f => ({ ...f, stop_loss: e.target.value }))}
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Cut losses at this level (default 20%)</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">Click Run to fetch Discord messages and simulate trades with TP/SL strategy.</p>
                </div>
              )}
            </div>

            <DialogFooter>
              {step > 0 && <Button variant="outline" onClick={() => setStep(s => s - 1)}>Back</Button>}
              {step < 3 ? (
                <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}>Next</Button>
              ) : (
                <Button onClick={handleRun} disabled={!canProceed() || createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Run Backtest
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {btError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-400 flex items-center justify-between">
          <span>{btError}</span>
          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setBtError(null)}>Dismiss</Button>
        </div>
      )}

      {btSuccess && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400 flex items-center justify-between">
          <span>{btSuccess}</span>
          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setBtSuccess(null)}>Dismiss</Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> Backtest Runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {runsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : !runs?.length ? (
              <p className="text-center text-muted-foreground py-8">No backtests yet. Click New Backtest to start.</p>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {runs.map(r => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRunId(r.id)}
                    className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${selectedRunId === r.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                  >
                    <div>
                      <p className="font-medium">{r.name || `${r.start_date?.slice(0, 10)} → ${r.end_date?.slice(0, 10)}`}</p>
                      <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={r.status === 'completed' ? 'default' : r.status === 'failed' ? 'destructive' : 'secondary'} className="gap-1">
                        {r.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
                        {r.status}
                      </Badge>
                      {r.summary && (
                        <span className={`text-sm font-medium ${(r.summary as Record<string, number>).total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${((r.summary as Record<string, number>).total_pnl ?? 0).toFixed(0)}
                        </span>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); handleDeleteRun(r.id, r.name) }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedRun ? (
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>{selectedRun.name || `Run ${selectedRun.id.slice(0, 8)}`}</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedRun.status === 'failed' && (
                <p className="text-destructive text-sm mb-4">{selectedRun.error_message}</p>
              )}
              {summary && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Total Trades</p>
                      <p className="text-lg font-semibold">{summary.total_trades ?? 0}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Win Rate</p>
                      <p className="text-lg font-semibold">{summary.win_rate_pct ?? 0}%</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Total P&L</p>
                      <p className={`text-lg font-semibold ${(summary.total_pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${(summary.total_pnl ?? 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Avg Win</p>
                      <p className="text-lg font-semibold text-green-600">${(summary.avg_win ?? 0).toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Avg Loss</p>
                      <p className="text-lg font-semibold text-red-600">${(summary.avg_loss ?? 0).toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Max Drawdown</p>
                      <p className="text-lg font-semibold">${(summary.max_drawdown ?? 0).toFixed(2)}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium">Trades</h4>
                      {trades.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => {
                            const headers = ['Ticker', 'Strike', 'Type', 'Action', 'Entry', 'Exit', 'P&L', 'Reason', 'Entry Time', 'Exit Time', 'Raw Message']
                            const rows = trades.map(t => [
                              t.ticker,
                              String(t.strike),
                              t.option_type,
                              t.action,
                              t.entry_price.toFixed(2),
                              t.exit_price != null ? t.exit_price.toFixed(2) : '',
                              t.realized_pnl != null ? t.realized_pnl.toFixed(2) : '',
                              t.exit_reason ?? '',
                              t.entry_ts ?? '',
                              t.exit_ts ?? '',
                              t.raw_message ?? '',
                            ])
                            exportToCSV(`backtest-${selectedRun?.name || selectedRun?.id.slice(0, 8)}`, headers, rows)
                          }}
                        >
                          <Download className="h-3 w-3" /> Export CSV
                        </Button>
                      )}
                    </div>
                    <div className="rounded-md border max-h-[300px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-6"></TableHead>
                            <TableHead>Ticker</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Entry</TableHead>
                            <TableHead>Exit</TableHead>
                            <TableHead>P&L</TableHead>
                            <TableHead>Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {trades.map(t => (
                            <>
                              <TableRow key={t.id} className="cursor-pointer" onClick={() => setExpandedTradeId(expandedTradeId === t.id ? null : t.id)}>
                                <TableCell className="px-2">
                                  <ChevronDown className={`h-3 w-3 transition-transform ${expandedTradeId === t.id ? 'rotate-180' : ''}`} />
                                </TableCell>
                                <TableCell className="font-mono">{t.ticker} {t.strike}{t.option_type === 'CALL' ? 'C' : 'P'}</TableCell>
                                <TableCell>{t.action}</TableCell>
                                <TableCell>${t.entry_price.toFixed(2)}</TableCell>
                                <TableCell>{t.exit_price != null ? `$${t.exit_price.toFixed(2)}` : '—'}</TableCell>
                                <TableCell className={t.realized_pnl != null ? (t.realized_pnl >= 0 ? 'text-green-600' : 'text-red-600') : ''}>
                                  {t.realized_pnl != null ? `$${t.realized_pnl.toFixed(2)}` : '—'}
                                </TableCell>
                                <TableCell>
                                  {t.exit_reason ? (
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] ${
                                        t.exit_reason === 'TAKE_PROFIT'
                                          ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400'
                                          : t.exit_reason === 'STOP_LOSS'
                                            ? 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400'
                                            : t.exit_reason === 'MANUAL'
                                              ? 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400'
                                              : t.exit_reason === 'EXPIRED'
                                                ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                                : ''
                                      }`}
                                    >
                                      {t.exit_reason === 'TAKE_PROFIT' ? 'TP' : t.exit_reason === 'STOP_LOSS' ? 'SL' : t.exit_reason}
                                    </Badge>
                                  ) : '—'}
                                </TableCell>
                              </TableRow>
                              {expandedTradeId === t.id && (
                                <TableRow key={`${t.id}-msg`}>
                                  <TableCell colSpan={7} className="bg-muted/30 py-2 px-4">
                                    <div className="space-y-1 text-xs">
                                      <p className="text-muted-foreground font-medium">Raw Discord Message:</p>
                                      <p className="font-mono whitespace-pre-wrap">{t.raw_message || 'No message recorded'}</p>
                                      <div className="flex gap-4 text-muted-foreground pt-1">
                                        <span>Entry: {t.entry_ts ? new Date(t.entry_ts).toLocaleString() : '—'}</span>
                                        <span>Exit: {t.exit_ts ? new Date(t.exit_ts).toLocaleString() : '—'}</span>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}
              {!summary && selectedRun.status === 'completed' && (
                <p className="text-muted-foreground">No summary available.</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Activity className="h-12 w-12 mb-4 opacity-50" />
              <p>Select a backtest run to view results</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
