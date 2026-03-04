/**
 * Risk & Compliance — Real-time risk monitoring from the Risk Guardian agent.
 * Phoenix v2.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { FlexCard } from '@/components/ui/FlexCard'
import { MetricCard } from '@/components/ui/MetricCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Shield, AlertTriangle, Lock, BarChart3, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

const MOCK_INSTANCES = [
  { id: 'inst-1', name: 'Instance A (Paper)' },
  { id: 'inst-2', name: 'Instance B (Live)' },
]

type CircuitState = 'NORMAL' | 'WARNING' | 'TRIPPED' | 'COOLDOWN'

const MOCK_CIRCUIT = {
  state: 'NORMAL' as CircuitState,
  dailyLossPct: -1.2,
  thresholdPct: -5,
  confidence: 0.92,
  consecutiveLosses: 0,
}

const MOCK_POSITION_LIMITS = {
  sectors: [
    { name: 'Technology', exposure: 32, max: 40 },
    { name: 'Healthcare', exposure: 18, max: 25 },
    { name: 'Financials', exposure: 22, max: 30 },
    { name: 'Energy', exposure: 8, max: 15 },
  ],
  tickerConcentration: [
    { ticker: 'NVDA', pct: 12 },
    { ticker: 'AAPL', pct: 8 },
    { ticker: 'MSFT', pct: 7 },
  ],
  marginUsagePct: 45,
}

const MOCK_RISK_CHECKS = [
  { ts: new Date().toISOString(), symbol: 'NVDA', checkType: 'position_limit', result: 'PASS', reason: 'Within limit' },
  { ts: new Date(Date.now() - 60000).toISOString(), symbol: 'TSLA', checkType: 'sector_exposure', result: 'WARN', reason: 'Tech at 38%' },
  { ts: new Date(Date.now() - 120000).toISOString(), symbol: 'SPY', checkType: 'daily_loss', result: 'BLOCK', reason: 'Would exceed -5% daily' },
]

const MOCK_COMPLIANCE = [
  { id: '1', type: 'wash_sale', message: 'Wash sale: NVDA sold 3 days ago, similar lot', severity: 'High' },
  { id: '2', type: 'pdt', message: 'PDT warning: 3 day trades this week', severity: 'Medium' },
  { id: '3', type: 'agent_conflict', message: 'Agent conflict: Trade executor vs Risk Guardian', severity: 'Low' },
]

const MOCK_HEDGING = {
  blackSwanStatus: 'ACTIVE',
  protectivePuts: [{ symbol: 'SPY', strike: 450, cost: 2.3, qty: 10 }],
  hedgeCostPct: 0.8,
  portfolioBeta: 1.12,
}

const circuitBadgeClass: Record<CircuitState, string> = {
  NORMAL: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50',
  WARNING: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/50',
  TRIPPED: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/50',
  COOLDOWN: 'bg-slate-500/20 text-slate-700 dark:text-slate-400 border-slate-500/50',
}

export default function RiskCompliancePage() {
  const [selectedInstance, setSelectedInstance] = useState<string>('')
  const [agentPanelOpen, setAgentPanelOpen] = useState(false)
  const [maxDailyLoss, setMaxDailyLoss] = useState(5)
  const [maxSectorExposure, setMaxSectorExposure] = useState(40)
  const queryClient = useQueryClient()

  const { data: status = {
    var: 12500,
    dailyPnlPct: -0.8,
    marginUsagePct: 45,
    circuitBreaker: 'NORMAL' as CircuitState,
  } } = useQuery({
    queryKey: ['risk-status'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/risk/status')
        return res.data
      } catch {
        return { var: 12500, dailyPnlPct: -0.8, marginUsagePct: 45, circuitBreaker: 'NORMAL' }
      }
    },
  })

  const { data: circuit = MOCK_CIRCUIT } = useQuery({
    queryKey: ['risk-circuit'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/risk/status')
        return res.data?.circuit ?? MOCK_CIRCUIT
      } catch {
        return MOCK_CIRCUIT
      }
    },
  })

  const { data: positionLimits = MOCK_POSITION_LIMITS } = useQuery({
    queryKey: ['risk-position-limits'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/risk/position-limits')
        return res.data ?? MOCK_POSITION_LIMITS
      } catch {
        return MOCK_POSITION_LIMITS
      }
    },
  })

  const { data: riskChecks = [] } = useQuery({
    queryKey: ['risk-checks'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/risk/checks')
        return res.data ?? MOCK_RISK_CHECKS
      } catch {
        return MOCK_RISK_CHECKS
      }
    },
  })

  const { data: compliance = [] } = useQuery({
    queryKey: ['risk-compliance'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/risk/compliance')
        return res.data ?? MOCK_COMPLIANCE
      } catch {
        return MOCK_COMPLIANCE
      }
    },
  })

  const { data: hedging = MOCK_HEDGING } = useQuery({
    queryKey: ['risk-hedging'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/risk/hedging')
        return res.data ?? MOCK_HEDGING
      } catch {
        return MOCK_HEDGING
      }
    },
  })

  const createAgentMutation = useMutation({
    mutationFn: async () => {
      await api.post('/api/v2/risk/agent/create', {
        instance_id: selectedInstance || 'inst-1',
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['risk-status'] }),
  })

  const resetCircuitMutation = useMutation({
    mutationFn: async () => {
      await api.post('/api/v2/risk/circuit-breaker/reset')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['risk-status', 'risk-circuit'] }),
  })

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const circuitState = (status.circuitBreaker ?? circuit.state ?? 'NORMAL') as CircuitState
  const checkItems = Array.isArray(riskChecks) ? riskChecks : MOCK_RISK_CHECKS
  const complianceItems = Array.isArray(compliance) ? compliance : MOCK_COMPLIANCE
  const sectors = positionLimits.sectors ?? MOCK_POSITION_LIMITS.sectors
  const tickerConc = positionLimits.tickerConcentration ?? MOCK_POSITION_LIMITS.tickerConcentration

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Shield className="h-7 w-7" />
        Risk & Compliance
      </h1>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Portfolio VaR"
          value={`$${(status.var ?? 12500).toLocaleString()}`}
          subtitle="95% 1-day"
        />
        <MetricCard
          title="Daily P&L %"
          value={`${(status.dailyPnlPct ?? -0.8).toFixed(2)}%`}
          trend={(status.dailyPnlPct ?? -0.8) >= 0 ? 'up' : 'down'}
        />
        <MetricCard
          title="Margin Usage %"
          value={`${(status.marginUsagePct ?? 45)}%`}
        />
        <div className="flex flex-col justify-center">
          <p className="text-sm font-medium text-muted-foreground mb-1">Circuit Breaker</p>
          <Badge
            variant="outline"
            className={cn('text-lg px-4 py-2 font-bold w-fit', circuitBadgeClass[circuitState])}
          >
            {circuitState}
          </Badge>
        </div>
      </div>

      {/* Agent Config Panel */}
      {agentPanelOpen && (
        <FlexCard title="Agent Config" className="border-primary/20">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Instance</label>
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select instance" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_INSTANCES.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => createAgentMutation.mutate()}
              disabled={createAgentMutation.isPending}
            >
              Deploy Risk Guardian
            </Button>
            <div>
              <label className="text-sm font-medium">Max daily loss: {maxDailyLoss}%</label>
              <input
                type="range"
                min="1"
                max="10"
                value={maxDailyLoss}
                onChange={(e) => setMaxDailyLoss(Number(e.target.value))}
                className="w-full mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Max sector exposure: {maxSectorExposure}%</label>
              <input
                type="range"
                min="20"
                max="50"
                value={maxSectorExposure}
                onChange={(e) => setMaxSectorExposure(Number(e.target.value))}
                className="w-full mt-1"
              />
            </div>
          </div>
        </FlexCard>
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setAgentPanelOpen(!agentPanelOpen)}>
          <Shield className="h-4 w-4 mr-2" />
          Agent Config
        </Button>
      </div>

      {/* Sub-tabs */}
      <Tabs defaultValue="circuit" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="circuit" className="gap-1">
            <Activity className="h-4 w-4" />
            Circuit Breaker
          </TabsTrigger>
          <TabsTrigger value="limits" className="gap-1">
            <BarChart3 className="h-4 w-4" />
            Position Limits
          </TabsTrigger>
          <TabsTrigger value="checks" className="gap-1">
            <Shield className="h-4 w-4" />
            Risk Checks
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-1">
            <Lock className="h-4 w-4" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="hedging" className="gap-1">
            <AlertTriangle className="h-4 w-4" />
            Hedging
          </TabsTrigger>
        </TabsList>

        <TabsContent value="circuit" className="space-y-4">
          <FlexCard title="Circuit Breaker" action={<Activity className="h-4 w-4 text-muted-foreground" />}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">State</span>
                <Badge variant="outline" className={circuitBadgeClass[circuitState]}>{circuitState}</Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Daily loss vs threshold</p>
                <div className="h-4 rounded-full bg-muted overflow-hidden flex">
                  <div
                    className="bg-red-500 h-full"
                    style={{
                      width: `${Math.min(100, Math.abs((circuit.dailyLossPct ?? -1.2) / (circuit.thresholdPct ?? -5)) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(circuit.dailyLossPct ?? -1.2).toFixed(1)}% / {(circuit.thresholdPct ?? -5)}%
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Confidence</p>
                  <p className="font-semibold">{((circuit.confidence ?? 0.92) * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Consecutive losses</p>
                  <p className="font-semibold">{circuit.consecutiveLosses ?? 0}</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => resetCircuitMutation.mutate()}
                disabled={resetCircuitMutation.isPending || circuitState === 'NORMAL'}
              >
                Reset Circuit Breaker
              </Button>
            </div>
          </FlexCard>
        </TabsContent>

        <TabsContent value="limits" className="space-y-4">
          <FlexCard title="Position Limits" action={<BarChart3 className="h-4 w-4 text-muted-foreground" />}>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Per-sector exposure vs max</p>
                <div className="space-y-2">
                  {sectors.map((s: { name: string; exposure: number; max: number }) => (
                    <div key={s.name} className="flex items-center gap-2">
                      <span className="w-24 text-sm">{s.name}</span>
                      <div className="flex-1 h-3 rounded bg-muted overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded',
                            s.exposure / s.max > 0.9 ? 'bg-red-500' : s.exposure / s.max > 0.7 ? 'bg-amber-500' : 'bg-emerald-500'
                          )}
                          style={{ width: `${(s.exposure / s.max) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs w-16">{s.exposure}% / {s.max}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Per-ticker concentration</p>
                <div className="space-y-2">
                  {tickerConc.map((t: { ticker: string; pct: number }) => (
                    <div key={t.ticker} className="flex items-center gap-2">
                      <span className="w-12 font-mono">{t.ticker}</span>
                      <div className="flex-1 h-3 rounded bg-muted overflow-hidden">
                        <div className="h-full rounded bg-primary" style={{ width: `${t.pct * 5}%` }} />
                      </div>
                      <span className="text-xs">{t.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Total margin usage</p>
                <div className="h-4 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${positionLimits.marginUsagePct ?? 45}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{(positionLimits.marginUsagePct ?? 45)}%</p>
              </div>
            </div>
          </FlexCard>
        </TabsContent>

        <TabsContent value="checks" className="space-y-4">
          <FlexCard title="Risk Checks" action={<Shield className="h-4 w-4 text-muted-foreground" />}>
            <div className="space-y-2">
              {checkItems.map((c: { ts: string; symbol: string; checkType: string; result: string; reason: string }, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                  <div className="flex gap-4">
                    <span className="text-muted-foreground">{formatTime(c.ts)}</span>
                    <span className="font-mono">{c.symbol}</span>
                    <span className="text-muted-foreground">{c.checkType}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        c.result === 'PASS' ? 'default' : c.result === 'WARN' ? 'secondary' : 'destructive'
                      }
                    >
                      {c.result}
                    </Badge>
                    <span className="text-muted-foreground">{c.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </FlexCard>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <FlexCard title="Compliance" action={<Lock className="h-4 w-4 text-muted-foreground" />}>
            <div className="space-y-4">
              {complianceItems.map((a: { id: string; type: string; message: string; severity: string }) => (
                <div key={a.id} className="p-4 rounded-lg border flex items-start gap-3">
                  <AlertTriangle className={cn(
                    'h-5 w-5 shrink-0',
                    a.severity === 'High' ? 'text-red-500' : a.severity === 'Medium' ? 'text-amber-500' : 'text-muted-foreground'
                  )} />
                  <div>
                    <Badge variant="outline" className="mb-1">{a.type.replace('_', ' ')}</Badge>
                    <p className="text-sm">{a.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">Severity: {a.severity}</p>
                  </div>
                </div>
              ))}
            </div>
          </FlexCard>
        </TabsContent>

        <TabsContent value="hedging" className="space-y-4">
          <FlexCard title="Hedging" action={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Black swan hedge status</span>
                <Badge variant={hedging.blackSwanStatus === 'ACTIVE' ? 'default' : 'secondary'}>
                  {hedging.blackSwanStatus}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Protective puts</p>
                <div className="space-y-2">
                  {(hedging.protectivePuts ?? []).map((p: { symbol: string; strike: number; cost: number; qty: number }, i: number) => (
                    <div key={i} className="p-3 rounded-lg border flex justify-between">
                      <span>{p.symbol} ${p.strike} × {p.qty}</span>
                      <span className="text-muted-foreground">Cost: ${p.cost}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Hedge cost</p>
                  <p className="font-semibold">{(hedging.hedgeCostPct ?? 0.8).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Portfolio beta</p>
                  <p className="font-semibold">{hedging.portfolioBeta ?? 1.12}</p>
                </div>
              </div>
            </div>
          </FlexCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}
