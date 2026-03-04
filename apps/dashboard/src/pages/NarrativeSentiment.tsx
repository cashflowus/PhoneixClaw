/**
 * Narrative & Sentiment — NLP-powered sentiment intelligence from the Narrative Sentinel agent.
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
import { MessageCircle, Brain, TrendingUp, AlertTriangle, Newspaper } from 'lucide-react'
import { cn } from '@/lib/utils'

const MOCK_INSTANCES = [
  { id: 'inst-1', name: 'Instance A (Paper)' },
  { id: 'inst-2', name: 'Instance B (Live)' },
]

const MOCK_FEED = [
  { id: '1', ts: new Date().toISOString(), source: 'Twitter', headline: 'Fed signals potential rate cut in Q2', score: 0.42, tickers: ['SPY', 'QQQ'], urgent: true },
  { id: '2', ts: new Date(Date.now() - 300000).toISOString(), source: 'News', headline: 'CPI comes in below expectations', score: 0.68, tickers: ['TLT'], urgent: false },
  { id: '3', ts: new Date(Date.now() - 600000).toISOString(), source: 'Reddit', headline: 'WSB piling into NVDA calls', score: -0.15, tickers: ['NVDA'], urgent: true },
  { id: '4', ts: new Date(Date.now() - 900000).toISOString(), source: 'SEC', headline: 'Form 4: Insider selling at AAPL', score: -0.55, tickers: ['AAPL'], urgent: false },
]

const MOCK_FED_SPEAKERS = [
  { id: '1', name: 'Jerome Powell', date: '2025-03-15', summary: 'Data-dependent stance, no rush to cut', hawkish: 0.6, dovish: 0.2 },
  { id: '2', name: 'John Williams', date: '2025-03-12', summary: 'Soft landing likely, inflation easing', hawkish: 0.3, dovish: 0.65 },
]

const MOCK_SOCIAL = {
  cashtags: ['$NVDA', '$TSLA', '$AAPL', '$META', '$GOOGL'],
  wsbMomentum: ['GME', 'AMC', 'NVDA', 'TSLA', 'PLTR'],
  heatmap: [
    { ticker: 'NVDA', sentiment: 0.72 },
    { ticker: 'TSLA', sentiment: 0.45 },
    { ticker: 'AAPL', sentiment: 0.12 },
    { ticker: 'META', sentiment: -0.08 },
    { ticker: 'GME', sentiment: -0.35 },
  ],
}

const MOCK_EARNINGS = [
  { ticker: 'NVDA', date: '2025-03-20', expectation: 0.65, postRisk: null },
  { ticker: 'ORCL', date: '2025-03-18', expectation: 0.22, postRisk: 'Transcript risk: cautious guidance' },
]

const MOCK_ANALYST = [
  { ticker: 'NVDA', action: 'Upgrade', firm: 'Goldman', target: 950, impact: '+3.2%' },
  { ticker: 'TSLA', action: 'Downgrade', firm: 'Morgan Stanley', target: 180, impact: '-2.1%' },
]

function sentimentColor(score: number) {
  if (score >= 0.5) return 'bg-emerald-500'
  if (score >= 0) return 'bg-emerald-300'
  if (score >= -0.5) return 'bg-red-300'
  return 'bg-red-500'
}

export default function NarrativeSentimentPage() {
  const [selectedInstance, setSelectedInstance] = useState<string>('')
  const [agentPanelOpen, setAgentPanelOpen] = useState(false)
  const [alertThreshold, setAlertThreshold] = useState(0.7)
  const [sourceToggles, setSourceToggles] = useState({ twitter: true, news: true, reddit: true, sec: true })
  const queryClient = useQueryClient()

  const { data: feedResponse } = useQuery({
    queryKey: ['narrative-feed'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/narrative/feed')
        return res.data
      } catch {
        return { items: MOCK_FEED, metrics: { marketSentiment: 0.35, fearGreed: 62, twitterVelocity: 0.78, newsSentimentAvg: 0.42 } }
      }
    },
  })

  const metrics = feedResponse?.metrics ?? {
    marketSentiment: 0.35,
    fearGreed: 62,
    twitterVelocity: 0.78,
    newsSentimentAvg: 0.42,
  }

  const feed = feedResponse?.items ?? MOCK_FEED

  const { data: fedWatch = [] } = useQuery({
    queryKey: ['narrative-fed-watch'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/narrative/fed-watch')
        return res.data ?? MOCK_FED_SPEAKERS
      } catch {
        return MOCK_FED_SPEAKERS
      }
    },
  })

  const { data: social = MOCK_SOCIAL } = useQuery({
    queryKey: ['narrative-social'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/narrative/social')
        return res.data ?? MOCK_SOCIAL
      } catch {
        return MOCK_SOCIAL
      }
    },
  })

  const { data: earnings = [] } = useQuery({
    queryKey: ['narrative-earnings'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/narrative/earnings')
        return res.data ?? MOCK_EARNINGS
      } catch {
        return MOCK_EARNINGS
      }
    },
  })

  const { data: analystMoves = [] } = useQuery({
    queryKey: ['narrative-analyst-moves'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/narrative/analyst-moves')
        return res.data ?? MOCK_ANALYST
      } catch {
        return MOCK_ANALYST
      }
    },
  })

  const createAgentMutation = useMutation({
    mutationFn: async () => {
      await api.post('/api/v2/narrative/agent/create', {
        instance_id: selectedInstance || 'inst-1',
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['narrative-feed'] }),
  })

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  const feedItems = Array.isArray(feed) ? feed : MOCK_FEED
  const fedItems = Array.isArray(fedWatch) ? fedWatch : MOCK_FED_SPEAKERS
  const earningsItems = Array.isArray(earnings) ? earnings : MOCK_EARNINGS
  const analystItems = Array.isArray(analystMoves) ? analystMoves : MOCK_ANALYST

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Brain className="h-7 w-7" />
        Narrative & Sentiment
      </h1>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Market Sentiment"
          value={`${((metrics.marketSentiment ?? 0.35) * 100).toFixed(0)}%`}
          subtitle="-1 to +1 gauge"
          trend={(metrics.marketSentiment ?? 0.35) >= 0 ? 'up' : 'down'}
        />
        <MetricCard
          title="Fear & Greed Index"
          value={metrics.fearGreed ?? 62}
          subtitle="0-100"
        />
        <MetricCard
          title="Twitter Velocity"
          value={((metrics.twitterVelocity ?? 0.78) * 100).toFixed(0) + '%'}
          subtitle="Activity score"
        />
        <MetricCard
          title="News Sentiment Avg"
          value={((metrics.newsSentimentAvg ?? 0.42) * 100).toFixed(0) + '%'}
          subtitle="Aggregate"
        />
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
              Deploy Sentiment Agent
            </Button>
            <div>
              <label className="text-sm font-medium">Source toggles</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {(['twitter', 'news', 'reddit', 'sec'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSourceToggles((s) => ({ ...s, [k]: !s[k] }))}
                    className={cn(
                      'px-3 py-1 rounded text-xs font-medium',
                      sourceToggles[k] ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Alert threshold: {alertThreshold}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(Number(e.target.value))}
                className="w-full mt-1"
              />
            </div>
          </div>
        </FlexCard>
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setAgentPanelOpen(!agentPanelOpen)}>
          <Brain className="h-4 w-4 mr-2" />
          Agent Config
        </Button>
      </div>

      {/* Sub-tabs */}
      <Tabs defaultValue="feed" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="feed" className="gap-1">
            <Newspaper className="h-4 w-4" />
            Sentiment Feed
          </TabsTrigger>
          <TabsTrigger value="fed" className="gap-1">
            <MessageCircle className="h-4 w-4" />
            Fed Watch
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-1">
            <TrendingUp className="h-4 w-4" />
            Social Pulse
          </TabsTrigger>
          <TabsTrigger value="earnings" className="gap-1">
            <AlertTriangle className="h-4 w-4" />
            Earnings Intelligence
          </TabsTrigger>
          <TabsTrigger value="analyst" className="gap-1">
            <TrendingUp className="h-4 w-4" />
            Analyst Moves
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="space-y-4">
          <FlexCard title="Live Sentiment Feed" action={<Newspaper className="h-4 w-4 text-muted-foreground" />}>
            <div className="space-y-3">
              {feedItems.map((item: { id: string; ts: string; source: string; headline: string; score: number; tickers: string[]; urgent?: boolean }) => (
                <div
                  key={item.id}
                  className={cn(
                    'p-4 rounded-lg border transition-colors',
                    item.urgent && 'border-amber-500/50 bg-amber-500/5 animate-pulse'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatTime(item.ts)}</span>
                        <Badge variant="outline">{item.source}</Badge>
                        {item.urgent && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                      </div>
                      <p className="font-medium mt-1">{item.headline}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.tickers.map((t) => (
                          <Badge key={t} variant="secondary" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-sm font-mono">{item.score.toFixed(2)}</span>
                      <div className="w-16 h-2 rounded-full bg-muted overflow-hidden mt-1">
                        <div
                          className={cn('h-full rounded-full', sentimentColor(item.score))}
                          style={{ width: `${((item.score + 1) / 2) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </FlexCard>
        </TabsContent>

        <TabsContent value="fed" className="space-y-4">
          <FlexCard title="Fed Watch" action={<MessageCircle className="h-4 w-4 text-muted-foreground" />}>
            <div className="space-y-4">
              {fedItems.map((s: { id: string; name: string; date: string; summary: string; hawkish: number; dovish: number }) => (
                <div key={s.id} className="p-4 rounded-lg border">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-sm text-muted-foreground">{s.date}</p>
                      <p className="text-sm mt-2">{s.summary}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="bg-amber-500/20">Hawkish {Math.round(s.hawkish * 100)}%</Badge>
                      <Badge variant="outline" className="bg-blue-500/20">Dovish {Math.round(s.dovish * 100)}%</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </FlexCard>
        </TabsContent>

        <TabsContent value="social" className="space-y-4">
          <FlexCard title="Social Pulse" action={<TrendingUp className="h-4 w-4 text-muted-foreground" />}>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Twitter trending cashtags</p>
                <div className="flex flex-wrap gap-2">
                  {(social.cashtags ?? MOCK_SOCIAL.cashtags).map((t: string) => (
                    <Badge key={t} variant="secondary">{t}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">WSB momentum tickers</p>
                <div className="flex flex-wrap gap-2">
                  {(social.wsbMomentum ?? MOCK_SOCIAL.wsbMomentum).map((t: string) => (
                    <Badge key={t} variant="outline">{t}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Sentiment heatmap by ticker</p>
                <div className="space-y-2">
                  {(social.heatmap ?? MOCK_SOCIAL.heatmap).map((h: { ticker: string; sentiment: number }) => (
                    <div key={h.ticker} className="flex items-center gap-2">
                      <span className="w-12 font-mono text-sm">{h.ticker}</span>
                      <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded', sentimentColor(h.sentiment))}
                          style={{ width: `${((h.sentiment + 1) / 2) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs w-8">{h.sentiment.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FlexCard>
        </TabsContent>

        <TabsContent value="earnings" className="space-y-4">
          <FlexCard title="Earnings Intelligence" action={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}>
            <div className="space-y-4">
              {earningsItems.map((e: { ticker: string; date: string; expectation: number; postRisk: string | null }) => (
                <div key={e.ticker} className="p-4 rounded-lg border">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{e.ticker}</p>
                      <p className="text-sm text-muted-foreground">{e.date}</p>
                      <p className="text-sm mt-1">Sentiment expectation: {(e.expectation * 100).toFixed(0)}%</p>
                      {e.postRisk && (
                        <Badge variant="destructive" className="mt-2">{e.postRisk}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </FlexCard>
        </TabsContent>

        <TabsContent value="analyst" className="space-y-4">
          <FlexCard title="Analyst Moves" action={<TrendingUp className="h-4 w-4 text-muted-foreground" />}>
            <div className="space-y-4">
              {analystItems.map((a: { ticker: string; action: string; firm: string; target: number; impact: string }) => (
                <div key={a.ticker} className="p-4 rounded-lg border flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{a.ticker}</p>
                    <p className="text-sm text-muted-foreground">{a.firm} — {a.action}</p>
                    <p className="text-sm">Target: ${a.target}</p>
                  </div>
                  <Badge variant={a.impact.startsWith('+') ? 'default' : 'destructive'}>{a.impact}</Badge>
                </div>
              ))}
            </div>
          </FlexCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}
