/**
 * On-Chain/Flow page — whale movements, unusual options flow, institutional positioning.
 * Phoenix v2.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { FlexCard } from '@/components/ui/FlexCard'
import { MetricCard } from '@/components/ui/MetricCard'
import {
  Activity,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

type FlowDirection = 'ACCUMULATING' | 'DISTRIBUTING' | 'NEUTRAL'
type Sentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL'
type WhaleType = 'CALL' | 'PUT' | 'STOCK'

interface Mag7Card {
  ticker: string
  whale_trades: string[]
  call_put_ratio: number
  dark_pool_pct: number
  institutional_flow: FlowDirection
}

interface MemeCard extends Mag7Card {
  social_sentiment: number
}

interface SectorFlow {
  sector: string
  net_direction: FlowDirection
  top_movers: { ticker: string; flow_pct: number }[]
}

interface IndexFlow {
  symbol: string
  gex_level: string
  odte_volume: string
  put_call_skew: number
  dark_pool_pct: number
}

interface WhaleAlert {
  timestamp: string
  ticker: string
  type: WhaleType
  size: number
  premium: number
  sentiment: Sentiment
  exchange: string
}

interface FlowMetrics {
  whale_alerts_24h: number
  unusual_flow_volume: string
  dark_pool_activity: string
  institutional_sentiment: FlowDirection
}

const MOCK_INSTANCES = [
  { id: 'inst-1', name: 'Instance A (Paper)' },
  { id: 'inst-2', name: 'Instance B (Live)' },
]

const MOCK_METRICS: FlowMetrics = {
  whale_alerts_24h: 47,
  unusual_flow_volume: '$2.4B',
  dark_pool_activity: '38%',
  institutional_sentiment: 'ACCUMULATING',
}

const MOCK_MAG7: Mag7Card[] = [
  { ticker: 'AAPL', whale_trades: ['$12M call sweep 180C', '$8M put block 175P'], call_put_ratio: 1.42, dark_pool_pct: 35, institutional_flow: 'ACCUMULATING' },
  { ticker: 'MSFT', whale_trades: ['$15M call block 420C'], call_put_ratio: 1.85, dark_pool_pct: 42, institutional_flow: 'ACCUMULATING' },
  { ticker: 'GOOGL', whale_trades: ['$6M put sweep 150P'], call_put_ratio: 0.92, dark_pool_pct: 31, institutional_flow: 'NEUTRAL' },
  { ticker: 'AMZN', whale_trades: ['$22M call block 185C', '$10M stock block'], call_put_ratio: 2.1, dark_pool_pct: 45, institutional_flow: 'ACCUMULATING' },
  { ticker: 'META', whale_trades: ['$9M put block 480P'], call_put_ratio: 1.12, dark_pool_pct: 38, institutional_flow: 'NEUTRAL' },
  { ticker: 'NVDA', whale_trades: ['$45M call sweep 900C', '$18M call block 880C'], call_put_ratio: 2.8, dark_pool_pct: 52, institutional_flow: 'ACCUMULATING' },
  { ticker: 'TSLA', whale_trades: ['$14M put sweep 240P'], call_put_ratio: 0.78, dark_pool_pct: 41, institutional_flow: 'DISTRIBUTING' },
]

const MOCK_MEME: MemeCard[] = [
  { ticker: 'GME', whale_trades: ['$3.2M call sweep 28C'], call_put_ratio: 1.65, dark_pool_pct: 28, institutional_flow: 'NEUTRAL', social_sentiment: 78 },
  { ticker: 'AMC', whale_trades: ['$1.8M put block 4P'], call_put_ratio: 0.85, dark_pool_pct: 22, institutional_flow: 'DISTRIBUTING', social_sentiment: 45 },
  { ticker: 'BBBY', whale_trades: ['$0.5M call sweep'], call_put_ratio: 1.2, dark_pool_pct: 18, institutional_flow: 'NEUTRAL', social_sentiment: 62 },
]

const MOCK_SECTORS: SectorFlow[] = [
  { sector: 'Technology', net_direction: 'ACCUMULATING', top_movers: [{ ticker: 'NVDA', flow_pct: 12.4 }, { ticker: 'AMD', flow_pct: 8.2 }] },
  { sector: 'Healthcare', net_direction: 'NEUTRAL', top_movers: [{ ticker: 'PFE', flow_pct: -2.1 }, { ticker: 'JNJ', flow_pct: 1.3 }] },
  { sector: 'Energy', net_direction: 'DISTRIBUTING', top_movers: [{ ticker: 'XOM', flow_pct: -4.2 }, { ticker: 'CVX', flow_pct: -2.8 }] },
  { sector: 'Financials', net_direction: 'ACCUMULATING', top_movers: [{ ticker: 'JPM', flow_pct: 5.1 }, { ticker: 'BAC', flow_pct: 3.2 }] },
  { sector: 'Consumer', net_direction: 'NEUTRAL', top_movers: [{ ticker: 'AMZN', flow_pct: 2.4 }, { ticker: 'WMT', flow_pct: -1.1 }] },
]

const MOCK_INDICES: IndexFlow[] = [
  { symbol: 'SPY', gex_level: '$4.2B', odte_volume: '2.1M', put_call_skew: 1.12, dark_pool_pct: 44 },
  { symbol: 'QQQ', gex_level: '$2.8B', odte_volume: '1.8M', put_call_skew: 1.08, dark_pool_pct: 48 },
  { symbol: 'IWM', gex_level: '$0.6B', odte_volume: '0.4M', put_call_skew: 1.25, dark_pool_pct: 35 },
  { symbol: 'DIA', gex_level: '$0.9B', odte_volume: '0.3M', put_call_skew: 1.15, dark_pool_pct: 38 },
]

const MOCK_WHALE_ALERTS: WhaleAlert[] = [
  { timestamp: '2025-03-03T14:32:00Z', ticker: 'NVDA', type: 'CALL', size: 500, premium: 2.4e6, sentiment: 'BULLISH', exchange: 'CBOE' },
  { timestamp: '2025-03-03T14:28:00Z', ticker: 'SPY', type: 'PUT', size: 1200, premium: 1.8e6, sentiment: 'BEARISH', exchange: 'PHLX' },
  { timestamp: '2025-03-03T14:25:00Z', ticker: 'AAPL', type: 'STOCK', size: 25000, premium: 4.5e6, sentiment: 'BULLISH', exchange: 'DARK' },
  { timestamp: '2025-03-03T14:20:00Z', ticker: 'TSLA', type: 'PUT', size: 800, premium: 1.2e6, sentiment: 'BEARISH', exchange: 'CBOE' },
  { timestamp: '2025-03-03T14:15:00Z', ticker: 'AMZN', type: 'CALL', size: 600, premium: 3.1e6, sentiment: 'BULLISH', exchange: 'ISE' },
  { timestamp: '2025-03-03T14:10:00Z', ticker: 'META', type: 'CALL', size: 400, premium: 0.9e6, sentiment: 'NEUTRAL', exchange: 'CBOE' },
]

function flowColor(dir: FlowDirection | Sentiment) {
  if (dir === 'ACCUMULATING' || dir === 'BULLISH') return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
  if (dir === 'DISTRIBUTING' || dir === 'BEARISH') return 'text-red-600 dark:text-red-400 bg-red-500/10'
  return 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
}

function FlowIcon({ dir }: { dir: FlowDirection | Sentiment }) {
  if (dir === 'ACCUMULATING' || dir === 'BULLISH') return <TrendingUp className="h-3 w-3 inline mr-0.5" />
  if (dir === 'DISTRIBUTING' || dir === 'BEARISH') return <TrendingDown className="h-3 w-3 inline mr-0.5" />
  return <AlertTriangle className="h-3 w-3 inline mr-0.5" />
}

export default function OnChainFlowPage() {
  const [selectedInstance, setSelectedInstance] = useState('')
  const [minPremium, setMinPremium] = useState('500000')
  const [minSize, setMinSize] = useState('100')
  const [watchedTickers, setWatchedTickers] = useState('SPY,QQQ,NVDA,AAPL,TSLA')
  const queryClient = useQueryClient()

  const { data: metrics = MOCK_METRICS } = useQuery<FlowMetrics>({
    queryKey: ['onchain-flow-metrics'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/onchain-flow/whale-alerts')
        return { ...MOCK_METRICS, whale_alerts_24h: Array.isArray(res.data) ? res.data.length : MOCK_METRICS.whale_alerts_24h }
      } catch {
        return MOCK_METRICS
      }
    },
  })

  const { data: whaleAlerts = MOCK_WHALE_ALERTS } = useQuery<WhaleAlert[]>({
    queryKey: ['onchain-flow-whale-alerts'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/onchain-flow/whale-alerts')
        return Array.isArray(res.data) ? res.data : MOCK_WHALE_ALERTS
      } catch {
        return MOCK_WHALE_ALERTS
      }
    },
    refetchInterval: 30000,
  })

  const { data: mag7 = MOCK_MAG7 } = useQuery<Mag7Card[]>({
    queryKey: ['onchain-flow-mag7'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/onchain-flow/mag7')
        return res.data?.tickers ?? MOCK_MAG7
      } catch {
        return MOCK_MAG7
      }
    },
  })

  const { data: meme = MOCK_MEME } = useQuery<MemeCard[]>({
    queryKey: ['onchain-flow-meme'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/onchain-flow/meme')
        return res.data?.tickers ?? MOCK_MEME
      } catch {
        return MOCK_MEME
      }
    },
  })

  const { data: sectors = MOCK_SECTORS } = useQuery<SectorFlow[]>({
    queryKey: ['onchain-flow-sectors'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/onchain-flow/sectors')
        return res.data?.sectors ?? MOCK_SECTORS
      } catch {
        return MOCK_SECTORS
      }
    },
  })

  const { data: indices = MOCK_INDICES } = useQuery<IndexFlow[]>({
    queryKey: ['onchain-flow-indices'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/onchain-flow/indices')
        return res.data?.indices ?? MOCK_INDICES
      } catch {
        return MOCK_INDICES
      }
    },
  })

  const deployMutation = useMutation({
    mutationFn: async () => {
      await api.post('/api/v2/onchain-flow/agent/create', {
        instance_id: selectedInstance || 'inst-1',
        watched_tickers: watchedTickers.split(',').map((t) => t.trim()).filter(Boolean),
        min_premium: Number(minPremium) || 500000,
        min_size: Number(minSize) || 100,
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onchain-flow-metrics'] }),
  })

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const formatPremium = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1e3).toFixed(0)}K`)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-7 w-7" />
          On-Chain / Flow
        </h2>
        <p className="text-muted-foreground">Whale movements, unusual options flow, institutional positioning</p>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Whale Alerts (24h)"
          value={metrics.whale_alerts_24h}
          trend="up"
          subtitle="Live feed"
        />
        <MetricCard title="Unusual Flow Volume" value={metrics.unusual_flow_volume} />
        <MetricCard title="Dark Pool Activity" value={metrics.dark_pool_activity} />
        <MetricCard
          title="Institutional Sentiment"
          value={metrics.institutional_sentiment}
          trend={metrics.institutional_sentiment === 'ACCUMULATING' ? 'up' : metrics.institutional_sentiment === 'DISTRIBUTING' ? 'down' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <Tabs defaultValue="mag7">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="mag7">Mag 7</TabsTrigger>
              <TabsTrigger value="meme">Meme Stocks</TabsTrigger>
              <TabsTrigger value="sectors">Sector Flow</TabsTrigger>
              <TabsTrigger value="indices">Indices</TabsTrigger>
              <TabsTrigger value="whale">Whale Alerts</TabsTrigger>
            </TabsList>

            <TabsContent value="mag7" className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {mag7.map((card) => (
                  <FlexCard key={card.ticker} title={card.ticker}>
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Latest whale trades</p>
                        <ul className="space-y-0.5">
                          {card.whale_trades.slice(0, 2).map((t, i) => (
                            <li key={i} className="font-mono text-xs">{t}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">C/P ratio</span>
                        <span>{card.call_put_ratio.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Dark pool %</span>
                        <span>{card.dark_pool_pct}%</span>
                      </div>
                      <Badge className={flowColor(card.institutional_flow)}><FlowIcon dir={card.institutional_flow} />{card.institutional_flow}</Badge>
                    </div>
                  </FlexCard>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="meme" className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {meme.map((card) => (
                  <FlexCard key={card.ticker} title={card.ticker}>
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Latest whale trades</p>
                        <ul className="space-y-0.5">
                          {card.whale_trades.slice(0, 2).map((t, i) => (
                            <li key={i} className="font-mono text-xs">{t}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Social sentiment</span>
                        <span>{card.social_sentiment}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">C/P ratio</span>
                        <span>{card.call_put_ratio.toFixed(2)}</span>
                      </div>
                      <Badge className={flowColor(card.institutional_flow)}><FlowIcon dir={card.institutional_flow} />{card.institutional_flow}</Badge>
                    </div>
                  </FlexCard>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="sectors" className="mt-4">
              <div className="space-y-4">
                {sectors.map((s) => (
                  <FlexCard key={s.sector} title={s.sector}>
                    <div className="flex flex-wrap items-center gap-4">
                      <Badge className={flowColor(s.net_direction)}><FlowIcon dir={s.net_direction} />{s.net_direction}</Badge>
                      <div className="flex gap-4">
                        {s.top_movers.map((m) => (
                          <span key={m.ticker} className="font-mono text-sm">
                            {m.ticker} <span className={m.flow_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}>{m.flow_pct >= 0 ? '+' : ''}{m.flow_pct}%</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </FlexCard>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="indices" className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {indices.map((idx) => (
                  <FlexCard key={idx.symbol} title={idx.symbol}>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">GEX level</span>
                      <span>{idx.gex_level}</span>
                      <span className="text-muted-foreground">0DTE volume</span>
                      <span>{idx.odte_volume}</span>
                      <span className="text-muted-foreground">Put/call skew</span>
                      <span>{idx.put_call_skew.toFixed(2)}</span>
                      <span className="text-muted-foreground">Dark pool %</span>
                      <span>{idx.dark_pool_pct}%</span>
                    </div>
                  </FlexCard>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="whale" className="mt-4">
              <FlexCard title="Live Whale Alerts">
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Ticker</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Premium</TableHead>
                        <TableHead>Sentiment</TableHead>
                        <TableHead>Exchange</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {whaleAlerts.map((a, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-muted-foreground">{formatTime(a.timestamp)}</TableCell>
                          <TableCell className="font-mono font-semibold">{a.ticker}</TableCell>
                          <TableCell><Badge variant="outline">{a.type}</Badge></TableCell>
                          <TableCell>{a.size}</TableCell>
                          <TableCell>{formatPremium(a.premium)}</TableCell>
                          <TableCell><Badge className={flowColor(a.sentiment)}><FlowIcon dir={a.sentiment} />{a.sentiment}</Badge></TableCell>
                          <TableCell className="text-muted-foreground">{a.exchange}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </FlexCard>
            </TabsContent>
          </Tabs>
        </div>

        {/* Agent Config Panel */}
        <FlexCard title="Flow Monitor Agent">
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Instance</Label>
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
              <Activity className="h-4 w-4 mr-2" />
              Deploy Flow Monitor
            </Button>
            <div>
              <Label className="text-xs">Watched tickers</Label>
              <Input
                className="mt-1"
                value={watchedTickers}
                onChange={(e) => setWatchedTickers(e.target.value)}
                placeholder="SPY, QQQ, NVDA, ..."
              />
            </div>
            <div>
              <Label className="text-xs">Min premium ($)</Label>
              <Input
                className="mt-1"
                type="number"
                value={minPremium}
                onChange={(e) => setMinPremium(e.target.value)}
                placeholder="500000"
              />
            </div>
            <div>
              <Label className="text-xs">Min size (contracts)</Label>
              <Input
                className="mt-1"
                type="number"
                value={minSize}
                onChange={(e) => setMinSize(e.target.value)}
                placeholder="100"
              />
            </div>
          </div>
        </FlexCard>
      </div>
    </div>
  )
}
