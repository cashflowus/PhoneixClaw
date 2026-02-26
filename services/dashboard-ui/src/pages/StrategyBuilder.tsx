import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import {
  Plus, Loader2, Play, Rocket, Trash2, FlaskConical, Code, TrendingUp, XCircle,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip,
} from 'recharts'

interface Strategy {
  id: string
  name: string
  strategy_text: string
  parsed_config: Record<string, unknown>
  backtest_summary: Record<string, unknown> | null
  status: string
  created_at: string
  updated_at: string
}

export default function StrategyBuilder() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', strategy_text: '', ticker: 'SPY' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [backtestResult, setBacktestResult] = useState<Record<string, unknown> | null>(null)

  const { data: strategies, isLoading, isError, refetch } = useQuery<Strategy[]>({
    queryKey: ['strategies'],
    queryFn: () => axios.get('/api/v1/strategies').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: () => axios.post('/api/v1/strategies', form),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['strategies'] })
      setOpen(false)
      setSelectedId(res.data.id)
      setForm({ name: '', strategy_text: '', ticker: 'SPY' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/v1/strategies/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['strategies'] })
      if (selectedId) setSelectedId(null)
    },
  })

  const backtestMutation = useMutation({
    mutationFn: (params: { strategy_id: string; ticker: string }) =>
      axios.post('/api/v1/strategies/backtest', params),
    onSuccess: (res) => {
      setBacktestResult(res.data)
      qc.invalidateQueries({ queryKey: ['strategies'] })
    },
  })

  const deployMutation = useMutation({
    mutationFn: (id: string) => axios.post(`/api/v1/strategies/${id}/deploy`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategies'] }),
  })

  const selected = strategies?.find(s => s.id === selectedId)
  const report = (backtestResult as any)?.report || selected?.backtest_summary

  const equityCurve = report?.equity_curve
    ? report.equity_curve.map((v: number, i: number) => ({ i, value: v }))
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Strategy Builder</h2>
          <p className="text-sm text-muted-foreground">Describe strategies in natural language, backtest, and deploy</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5"><Plus className="h-4 w-4" /> New Strategy</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Strategy</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Strategy Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. SPX Close Momentum" />
              </div>
              <div className="space-y-2">
                <Label>Describe Your Strategy</Label>
                <Textarea
                  value={form.strategy_text}
                  onChange={e => setForm(f => ({ ...f, strategy_text: e.target.value }))}
                  placeholder="e.g. I have a strategy where I buy SPX calls just above the price 5 minutes before market close..."
                  className="min-h-[120px]"
                />
              </div>
              <div className="space-y-2">
                <Label>Primary Ticker</Label>
                <Input value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={!form.name || !form.strategy_text || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Strategies</h3>
          {isError ? (
            <Card className="border-destructive/30">
              <CardContent className="py-8 text-center">
                <XCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
                <p className="text-sm">Failed to load strategies</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : !strategies || strategies.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                <FlaskConical className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                No strategies yet
              </CardContent>
            </Card>
          ) : (
            strategies.map(s => (
              <Card
                key={s.id}
                className={`cursor-pointer transition-all ${selectedId === s.id ? 'border-primary shadow-sm' : 'hover:border-primary/40'}`}
                onClick={() => { setSelectedId(s.id); setBacktestResult(null) }}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{s.strategy_text.slice(0, 80)}...</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={e => { e.stopPropagation(); deleteMutation.mutate(s.id) }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          {!selected ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FlaskConical className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Select a strategy to view details</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{selected.name}</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => backtestMutation.mutate({ strategy_id: selected.id, ticker: 'SPY' })}
                      disabled={backtestMutation.isPending}
                    >
                      {backtestMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      Run Backtest
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => deployMutation.mutate(selected.id)}
                      disabled={!selected.backtest_summary || deployMutation.isPending}
                    >
                      <Rocket className="h-3.5 w-3.5" /> Deploy
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{selected.strategy_text}</p>
                </CardContent>
              </Card>

              {report && (
                <Tabs defaultValue="results">
                  <TabsList>
                    <TabsTrigger value="results"><TrendingUp className="h-3.5 w-3.5 mr-1" /> Results</TabsTrigger>
                    <TabsTrigger value="trades">Trade Log</TabsTrigger>
                    <TabsTrigger value="code"><Code className="h-3.5 w-3.5 mr-1" /> Pseudocode</TabsTrigger>
                  </TabsList>

                  <TabsContent value="results" className="space-y-4">
                    {report.narrative && (
                      <Card className="border-primary/20 bg-primary/5">
                        <CardContent className="p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">AI Analysis</p>
                          <p className="text-sm leading-relaxed">{report.narrative}</p>
                        </CardContent>
                      </Card>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Total Return', value: `${report.metrics?.total_return_pct?.toFixed(1) || 0}%` },
                        { label: 'Sharpe Ratio', value: report.metrics?.sharpe_ratio?.toFixed(2) || '0' },
                        { label: 'Max Drawdown', value: `${report.metrics?.max_drawdown_pct?.toFixed(1) || 0}%` },
                        { label: 'Win Rate', value: `${((report.metrics?.win_rate || 0) * 100).toFixed(0)}%` },
                        { label: 'Profit Factor', value: report.metrics?.profit_factor === Infinity ? '∞' : (report.metrics?.profit_factor?.toFixed(2) || '0') },
                        { label: 'Total Trades', value: report.metrics?.num_trades || 0 },
                      ].map(m => (
                        <Card key={m.label}>
                          <CardContent className="p-3 text-center">
                            <p className="text-[10px] text-muted-foreground uppercase">{m.label}</p>
                            <p className="text-lg font-bold mt-0.5">{m.value}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {equityCurve.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Equity Curve</CardTitle></CardHeader>
                        <CardContent>
                          <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={equityCurve}>
                                <defs>
                                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <XAxis dataKey="i" hide />
                                <YAxis domain={['auto', 'auto']} hide />
                                <RTooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Portfolio']} />
                                <Area type="monotone" dataKey="value" stroke="#22c55e" fill="url(#eqGrad)" strokeWidth={2} dot={false} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="trades">
                    <Card>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Type</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead className="text-right">Price</TableHead>
                              <TableHead className="text-right">Shares</TableHead>
                              <TableHead className="text-right">P&L</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(report.trades || []).map((t: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell>
                                  <Badge variant="outline" className={t.type === 'entry' ? 'text-blue-600' : 'text-orange-600'}>
                                    {t.type}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">{t.date}</TableCell>
                                <TableCell className="text-right font-mono text-xs">${t.price?.toFixed(2)}</TableCell>
                                <TableCell className="text-right text-xs">{t.shares}</TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                  {t.pnl !== undefined ? (
                                    <span className={t.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                                      ${t.pnl.toFixed(2)}
                                    </span>
                                  ) : '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="code">
                    <Card>
                      <CardContent className="p-4">
                        <pre className="text-xs font-mono bg-muted p-4 rounded-lg overflow-auto max-h-80 whitespace-pre-wrap">
                          {report.pseudocode || 'No pseudocode generated'}
                        </pre>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
