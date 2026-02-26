import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Eye, TrendingUp, TrendingDown, Minus, Search, Star, Loader2, ArrowUpRight, ArrowDownRight, XCircle,
} from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { WatchlistButton } from '@/components/WatchlistButton'

interface TickerData {
  ticker: string
  sentiment_label: string
  sentiment_score: number
  message_count: number
  mention_change_pct: number | null
  bullish_count: number
  bearish_count: number
  neutral_count: number
  period_start: string
  sparkline: number[]
}

interface SentimentMessage {
  id: string
  channel_name: string | null
  author: string | null
  content: string
  sentiment_label: string | null
  sentiment_score: number | null
  confidence: number | null
  message_timestamp: string | null
  created_at: string | null
}

const SENTIMENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Very Bullish': { bg: 'bg-green-500/15', text: 'text-green-600 dark:text-green-400', border: 'border-green-500/30' },
  'Bullish': { bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  'Neutral': { bg: 'bg-gray-500/15', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-500/30' },
  'Bearish': { bg: 'bg-orange-500/15', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/30' },
  'Very Bearish': { bg: 'bg-red-500/15', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/30' },
}

function SentimentBadge({ label }: { label: string }) {
  const colors = SENTIMENT_COLORS[label] || SENTIMENT_COLORS['Neutral']
  return (
    <Badge variant="outline" className={`${colors.bg} ${colors.text} ${colors.border} text-xs font-medium`}>
      {label}
    </Badge>
  )
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <div className="w-20 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} fill={`url(#spark-${color})`} strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function ChangeIndicator({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) return <span className="text-xs text-muted-foreground">-</span>
  const isUp = pct > 0
  const Icon = isUp ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus
  const color = isUp ? 'text-green-600 dark:text-green-400' : pct < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

export default function TickerSentiment() {
  const [search, setSearch] = useState('')
  const [sentimentFilter, setSentimentFilter] = useState<string>('all')
  const [timeRange, setTimeRange] = useState('3h')
  const [watchlistOnly, setWatchlistOnly] = useState(false)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)

  const { data: tickers, isLoading, isError, refetch } = useQuery<TickerData[]>({
    queryKey: ['sentiment-tickers', sentimentFilter, timeRange, watchlistOnly, search],
    queryFn: () => {
      const params = new URLSearchParams()
      if (sentimentFilter !== 'all') params.set('sentiment', sentimentFilter)
      params.set('time_range', timeRange)
      if (watchlistOnly) params.set('watchlist_only', 'true')
      if (search) params.set('search', search)
      return axios.get(`/api/v1/sentiment/tickers?${params}`).then(r => r.data)
    },
    refetchInterval: 30_000,
  })

  const { data: messagesData, isLoading: msgsLoading } = useQuery<{ total: number; messages: SentimentMessage[] }>({
    queryKey: ['sentiment-messages', selectedTicker],
    queryFn: () => axios.get(`/api/v1/sentiment/tickers/${selectedTicker}/messages?limit=50`).then(r => r.data),
    enabled: !!selectedTicker,
  })

  const { data: summaryData, isLoading: summaryLoading } = useQuery<{ summary: string; message_count: number }>({
    queryKey: ['sentiment-summary', selectedTicker],
    queryFn: () => axios.get(`/api/v1/sentiment/tickers/${selectedTicker}/summary`).then(r => r.data),
    enabled: !!selectedTicker,
    staleTime: 5 * 60 * 1000,
  })

  const sparkColor = (score: number) =>
    score > 0.1 ? '#22c55e' : score < -0.1 ? '#ef4444' : '#6b7280'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Ticker Sentiment</h2>
        <p className="text-sm text-muted-foreground">Real-time sentiment analysis across all data sources</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ticker..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Sentiment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sentiments</SelectItem>
            <SelectItem value="Very Bullish">Very Bullish</SelectItem>
            <SelectItem value="Bullish">Bullish</SelectItem>
            <SelectItem value="Neutral">Neutral</SelectItem>
            <SelectItem value="Bearish">Bearish</SelectItem>
            <SelectItem value="Very Bearish">Very Bearish</SelectItem>
          </SelectContent>
        </Select>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">1h</SelectItem>
            <SelectItem value="3h">3h</SelectItem>
            <SelectItem value="6h">6h</SelectItem>
            <SelectItem value="12h">12h</SelectItem>
            <SelectItem value="24h">24h</SelectItem>
            <SelectItem value="7d">7d</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={watchlistOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setWatchlistOnly(!watchlistOnly)}
          className="gap-1.5"
        >
          <Star className={`h-3.5 w-3.5 ${watchlistOnly ? 'fill-current' : ''}`} />
          Watchlist
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <XCircle className="h-10 w-10 text-destructive mb-2" />
              <p className="text-sm font-medium">Failed to load sentiment data</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !tickers || tickers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">No sentiment data yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Configure sentiment data sources to start tracking</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Sentiment</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Mentions</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-center">Trend</TableHead>
                  <TableHead className="text-center w-16">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickers.map(t => (
                  <TableRow key={t.ticker} className="group">
                    <TableCell className="w-10">
                      <WatchlistButton ticker={t.ticker} size="sm" />
                    </TableCell>
                    <TableCell className="font-mono font-semibold text-sm">{t.ticker}</TableCell>
                    <TableCell><SentimentBadge label={t.sentiment_label} /></TableCell>
                    <TableCell className="text-right font-mono text-sm">{t.sentiment_score.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-medium">{t.message_count}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <ChangeIndicator pct={t.mention_change_pct} />
                    </TableCell>
                    <TableCell className="text-center">
                      {t.sparkline.length > 1 && (
                        <MiniSparkline data={t.sparkline} color={sparkColor(t.sentiment_score)} />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setSelectedTicker(t.ticker)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View messages & AI summary</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedTicker} onOpenChange={v => { if (!v) setSelectedTicker(null) }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono">{selectedTicker}</span>
              <span className="text-sm font-normal text-muted-foreground">Sentiment Details</span>
            </DialogTitle>
          </DialogHeader>

          {summaryLoading ? (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Generating AI summary...</span>
            </div>
          ) : summaryData?.summary ? (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs uppercase tracking-wide text-primary">AI Summary</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-sm leading-relaxed">{summaryData.summary}</p>
              </CardContent>
            </Card>
          ) : null}

          <ScrollArea className="flex-1 -mx-6 px-6">
            {msgsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead className="max-w-[300px]">Message</TableHead>
                    <TableHead>Sentiment</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(messagesData?.messages || []).map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs text-muted-foreground">{m.channel_name || '-'}</TableCell>
                      <TableCell className="text-xs font-medium">{m.author || '-'}</TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="text-xs truncate" title={m.content}>{m.content}</p>
                      </TableCell>
                      <TableCell>
                        {m.sentiment_label ? <SentimentBadge label={m.sentiment_label} /> : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {m.message_timestamp ? new Date(m.message_timestamp).toLocaleString() : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {messagesData && messagesData.total > 50 && (
              <p className="text-xs text-muted-foreground text-center mt-3">
                Showing 50 of {messagesData.total} messages
              </p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
