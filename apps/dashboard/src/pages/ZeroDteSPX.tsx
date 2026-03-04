/**
 * 0DTE SPX Command Center — EOD SPX/SPY trading dashboard for 0DTE options.
 * Phoenix v2.
 */
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { FlexCard } from '@/components/ui/FlexCard'
import { MetricCard } from '@/components/ui/MetricCard'
import {
  Timer,
  Target,
  Zap,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

// Mock data
const MOCK_SPX = { price: 5987.42, change: 12.35, changePct: 0.21 }
const MOCK_METRICS = {
  vix: 14.2,
  gexNet: -2.4e9,
  dealerGammaZone: 'Negative',
  zeroDteVolume: 1.2e6,
  putCallRatio: 0.89,
  mocImbalance: -847e6,
}
const MOCK_GAMMA_LEVELS = [
  { strike: 5975, gex: 1.2e9, type: 'Support', distance: -12 },
  { strike: 5980, gex: 0.8e9, type: 'Support', distance: -7 },
  { strike: 5985, gex: -0.3e9, type: 'Flip', distance: -2 },
  { strike: 5990, gex: -1.1e9, type: 'Wall', distance: 3 },
  { strike: 5995, gex: -0.9e9, type: 'Resistance', distance: 8 },
  { strike: 6000, gex: -0.5e9, type: 'Resistance', distance: 13 },
]
const MOCK_MOC = {
  direction: 'Sell',
  amount: -847e6,
  historicalAvg: -420e6,
  predictedImpact: -0.12,
  tradeSignal: 'Bearish',
  releaseTime: '15:50',
}
const MOCK_VANNA_CHARM = {
  vannaLevel: 0.42,
  vannaDirection: 'up',
  charmBidActive: true,
  strikes: [
    { strike: 5975, vanna: 0.12, charm: -0.08 },
    { strike: 5985, vanna: 0.22, charm: -0.15 },
    { strike: 5995, vanna: 0.18, charm: -0.12 },
  ],
}
const MOCK_VOLUME = {
  callVolume: 680000,
  putVolume: 520000,
  ratio: 1.31,
  volumeByStrike: [
    { strike: 5975, calls: 45, puts: 32 },
    { strike: 5980, calls: 62, puts: 48 },
    { strike: 5985, calls: 78, puts: 55 },
    { strike: 5990, calls: 55, puts: 72 },
    { strike: 5995, calls: 42, puts: 58 },
    { strike: 6000, calls: 38, puts: 45 },
  ],
  largestTrades: [
    { strike: 5985, type: 'Call', size: 500, premium: 2.4e6 },
    { strike: 5990, type: 'Put', size: 400, premium: 1.8e6 },
  ],
  gammaSqueezeSignal: false,
}
const MOCK_TRADE_PLAN = {
  direction: 'SHORT',
  instrument: 'SPX',
  strikes: '5990P / 5980P',
  size: '2 contracts',
  entry: 'Market at 3:50',
  stop: '5995',
  target: '5970',
  signals: ['GEX bearish', 'MOC sell imbalance', 'Charm bid active', '0DTE put flow'],
}

const MOCK_INSTANCES = [
  { id: 'inst-1', name: 'Instance A (Paper)' },
  { id: 'inst-2', name: 'Instance B (Live)' },
]

function useCountdownTo(targetHour: number, targetMin: number) {
  const [remaining, setRemaining] = useState<string>('')
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const target = new Date(et)
      target.setHours(targetHour, targetMin, 0, 0)
      if (et >= target) target.setDate(target.getDate() + 1)
      const ms = target.getTime() - et.getTime()
      const m = Math.floor(ms / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      setRemaining(`${m}m ${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetHour, targetMin])
  return remaining
}

export default function ZeroDteSPXPage() {
  const [selectedInstance, setSelectedInstance] = useState<string>('')
  const [tradingMode, setTradingMode] = useState<'observe' | 'paper' | 'live'>('observe')
  const [maxRiskPct, setMaxRiskPct] = useState(1)
  const [autoExecute, setAutoExecute] = useState(false)
  const queryClient = useQueryClient()
  const countdownToClose = useCountdownTo(16, 0)
  const countdownToMoc = useCountdownTo(15, 50)

  const { data: gammaLevels = MOCK_GAMMA_LEVELS } = useQuery({
    queryKey: ['zero-dte', 'gamma-levels'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/zero-dte/gamma-levels')
        return res.data
      } catch {
        return MOCK_GAMMA_LEVELS
      }
    },
    refetchInterval: 30000,
  })

  const { data: mocData = MOCK_MOC } = useQuery({
    queryKey: ['zero-dte', 'moc-imbalance'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/zero-dte/moc-imbalance')
        return res.data
      } catch {
        return MOCK_MOC
      }
    },
    refetchInterval: 60000,
  })

  const { data: vannaCharm = MOCK_VANNA_CHARM } = useQuery({
    queryKey: ['zero-dte', 'vanna-charm'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/zero-dte/vanna-charm')
        return res.data
      } catch {
        return MOCK_VANNA_CHARM
      }
    },
    refetchInterval: 30000,
  })

  const { data: volume = MOCK_VOLUME } = useQuery({
    queryKey: ['zero-dte', 'volume'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/zero-dte/volume')
        return res.data
      } catch {
        return MOCK_VOLUME
      }
    },
    refetchInterval: 15000,
  })

  const { data: tradePlan = MOCK_TRADE_PLAN } = useQuery({
    queryKey: ['zero-dte', 'trade-plan'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/zero-dte/trade-plan')
        return res.data
      } catch {
        return MOCK_TRADE_PLAN
      }
    },
    refetchInterval: 60000,
  })

  const deployMutation = useMutation({
    mutationFn: async () => {
      await api.post('/api/v2/zero-dte/agent/create', { instance_id: selectedInstance || 'inst-1' })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zero-dte'] }),
  })

  const executeMutation = useMutation({
    mutationFn: async () => {
      await api.post('/api/v2/zero-dte/execute', { plan: tradePlan })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zero-dte'] }),
  })

  const formatGex = (v: number) =>
    v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : `${(v / 1e3).toFixed(0)}K`
  const formatMoc = (v: number) => `${(v / 1e6).toFixed(0)}M`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">0DTE SPX Command Center</h2>
          <div className="flex items-center gap-4 mt-2 text-muted-foreground">
            <span className="font-mono text-lg font-semibold text-foreground">
              SPX {MOCK_SPX.price.toLocaleString()}
            </span>
            <span className={MOCK_SPX.change >= 0 ? 'text-emerald-600' : 'text-red-600'}>
              {MOCK_SPX.change >= 0 ? '+' : ''}{MOCK_SPX.change} ({MOCK_SPX.changePct}%)
            </span>
            <span className="flex items-center gap-1">
              <Timer className="h-4 w-4" />
              Close in {countdownToClose}
            </span>
          </div>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <MetricCard title="SPX Price" value={MOCK_SPX.price.toLocaleString()} />
        <MetricCard title="VIX" value={MOCK_METRICS.vix} />
        <MetricCard
          title="GEX Net"
          value={formatGex(MOCK_METRICS.gexNet)}
          trend={MOCK_METRICS.gexNet >= 0 ? 'up' : 'down'}
        />
        <MetricCard
          title="Dealer Gamma Zone"
          value={MOCK_METRICS.dealerGammaZone}
          trend={MOCK_METRICS.dealerGammaZone === 'Positive' ? 'up' : 'down'}
        />
        <MetricCard title="0DTE Volume" value={formatGex(MOCK_METRICS.zeroDteVolume)} />
        <MetricCard title="Put/Call Ratio" value={MOCK_METRICS.putCallRatio.toFixed(2)} />
        <MetricCard
          title="MOC Imbalance"
          value={`$${formatMoc(Math.abs(MOCK_METRICS.mocImbalance))}`}
          trend={MOCK_METRICS.mocImbalance >= 0 ? 'up' : 'down'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main Tabs */}
        <div className="lg:col-span-3">
          <FlexCard>
            <Tabs defaultValue="gamma">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="gamma">Gamma Levels</TabsTrigger>
                <TabsTrigger value="moc">MOC Imbalance</TabsTrigger>
                <TabsTrigger value="vanna">Vanna & Charm</TabsTrigger>
                <TabsTrigger value="volume">0DTE Volume</TabsTrigger>
                <TabsTrigger value="plan">EOD Trade Plan</TabsTrigger>
              </TabsList>

              <TabsContent value="gamma" className="space-y-4">
                <div className="flex gap-2 text-sm">
                  <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    Positive Gamma
                  </span>
                  <span className="px-2 py-1 rounded bg-red-500/20 text-red-600 dark:text-red-400">
                    Negative Gamma
                  </span>
                </div>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Strike</TableHead>
                        <TableHead>GEX Value</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Distance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gammaLevels.map((row: { strike: number; gex: number; type: string; distance: number }) => (
                        <TableRow
                          key={row.strike}
                          className={
                            row.type === 'Flip'
                              ? 'bg-yellow-500/20 font-bold'
                              : row.gex > 0
                                ? 'bg-emerald-500/5'
                                : 'bg-red-500/5'
                          }
                        >
                          <TableCell className="font-mono">{row.strike}</TableCell>
                          <TableCell>{formatGex(row.gex)}</TableCell>
                          <TableCell>
                            {row.type === 'Flip' ? (
                              <Badge className="bg-yellow-500 text-yellow-950">Gamma Flip</Badge>
                            ) : (
                              row.type
                            )}
                          </TableCell>
                          <TableCell>{row.distance > 0 ? `+${row.distance}` : row.distance}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="moc" className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    MOC released at 3:50 PM ET — Countdown: <strong>{countdownToMoc}</strong>
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard title="Direction" value={mocData.direction} trend={mocData.direction === 'Buy' ? 'up' : 'down'} />
                  <MetricCard title="Amount" value={`$${formatMoc(Math.abs(mocData.amount))}`} />
                  <MetricCard title="Historical Avg" value={`$${formatMoc(Math.abs(mocData.historicalAvg))}`} />
                  <MetricCard title="Predicted Impact" value={`${mocData.predictedImpact > 0 ? '+' : ''}${mocData.predictedImpact}%`} />
                </div>
                <div className="p-4 rounded-lg border">
                  <h4 className="font-medium mb-2">Trade Signal</h4>
                  <Badge variant={mocData.tradeSignal === 'Bullish' ? 'default' : 'destructive'} className="text-sm">
                    {mocData.tradeSignal}
                  </Badge>
                </div>
              </TabsContent>

              <TabsContent value="vanna" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <MetricCard
                    title="Vanna Level"
                    value={vannaCharm.vannaLevel.toFixed(2)}
                    trend={vannaCharm.vannaDirection === 'up' ? 'up' : 'down'}
                  />
                  <MetricCard
                    title="Charm Bid"
                    value={vannaCharm.charmBidActive ? 'Active' : 'Inactive'}
                    trend={vannaCharm.charmBidActive ? 'up' : 'down'}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Vanna exposure chart (mock) — Charm decay curve: dealer buying pressure as 0DTE expires.
                </p>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Strike</TableHead>
                        <TableHead>Vanna</TableHead>
                        <TableHead>Charm</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vannaCharm.strikes.map((s: { strike: number; vanna: number; charm: number }) => (
                        <TableRow key={s.strike}>
                          <TableCell className="font-mono">{s.strike}</TableCell>
                          <TableCell>{s.vanna.toFixed(2)}</TableCell>
                          <TableCell>{s.charm.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="volume" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard title="Call Volume" value={volume.callVolume?.toLocaleString() ?? '-'} />
                  <MetricCard title="Put Volume" value={volume.putVolume?.toLocaleString() ?? '-'} />
                  <MetricCard title="C/P Ratio" value={volume.ratio?.toFixed(2) ?? '-'} />
                  <MetricCard
                    title="Gamma Squeeze"
                    value={volume.gammaSqueezeSignal ? 'Yes' : 'No'}
                    trend={volume.gammaSqueezeSignal ? 'up' : 'neutral'}
                  />
                </div>
                <div>
                  <h4 className="font-medium mb-2">Volume by Strike (heatmap)</h4>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {volume.volumeByStrike?.map((v: { strike: number; calls: number; puts: number }) => {
                      const total = v.calls + v.puts
                      const intensity = Math.min(100, (total / 150) * 100)
                      return (
                        <div
                          key={v.strike}
                          className="p-2 rounded text-center text-xs"
                          style={{ backgroundColor: `rgba(34, 197, 94, ${intensity / 100})` }}
                        >
                          <div className="font-mono font-medium">{v.strike}</div>
                          <div>C:{v.calls} P:{v.puts}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Largest Trades</h4>
                  <div className="space-y-2">
                    {volume.largestTrades?.map((t: { strike: number; type: string; size: number; premium: number }, i: number) => (
                      <div key={i} className="flex justify-between text-sm p-2 rounded border">
                        <span className="font-mono">{t.strike}{t.type}</span>
                        <span>{t.size} @ ${(t.premium / t.size / 100).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="plan" className="space-y-4">
                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="font-semibold">AI Composite Trade Plan</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Direction</span>
                    <Badge variant={tradePlan.direction === 'LONG' ? 'default' : 'destructive'}>{tradePlan.direction}</Badge>
                    <span className="text-muted-foreground">Instrument</span>
                    <span>{tradePlan.instrument}</span>
                    <span className="text-muted-foreground">Strikes</span>
                    <span className="font-mono">{tradePlan.strikes}</span>
                    <span className="text-muted-foreground">Size</span>
                    <span>{tradePlan.size}</span>
                    <span className="text-muted-foreground">Entry</span>
                    <span>{tradePlan.entry}</span>
                    <span className="text-muted-foreground">Stop</span>
                    <span>{tradePlan.stop}</span>
                    <span className="text-muted-foreground">Target</span>
                    <span>{tradePlan.target}</span>
                  </div>
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-1">Signals:</p>
                    <div className="flex flex-wrap gap-1">
                      {tradePlan.signals?.map((s: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    className="w-full mt-4"
                    onClick={() => executeMutation.mutate()}
                    disabled={executeMutation.isPending || tradingMode === 'observe'}
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Execute Plan
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </FlexCard>
        </div>

        {/* Agent Config Sidebar */}
        <FlexCard title="Agent Config">
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Instance</Label>
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select instance" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_INSTANCES.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => deployMutation.mutate()}
              disabled={deployMutation.isPending}
            >
              <Zap className="h-4 w-4 mr-2" />
              Deploy 0DTE Agent
            </Button>
            <div>
              <Label className="text-sm">Trading Mode</Label>
              <Select value={tradingMode} onValueChange={(v) => setTradingMode(v as 'observe' | 'paper' | 'live')}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="observe">Observe Only</SelectItem>
                  <SelectItem value="paper">Paper</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Max Risk per Trade: {maxRiskPct}%</Label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.5"
                value={maxRiskPct}
                onChange={(e) => setMaxRiskPct(parseFloat(e.target.value))}
                className="w-full mt-1"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Auto-execute</Label>
              <Switch checked={autoExecute} onCheckedChange={setAutoExecute} />
            </div>
          </div>
        </FlexCard>
      </div>
    </div>
  )
}
