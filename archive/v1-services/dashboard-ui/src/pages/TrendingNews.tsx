import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Newspaper, ExternalLink, Search, Settings2, RefreshCw, TrendingUp, TrendingDown,
  Star, XCircle,
} from 'lucide-react'
import { NewsConnectionsDialog } from '@/components/NewsConnectionsDialog'

interface Headline {
  id: string
  source_api: string
  title: string
  summary: string | null
  url: string | null
  tickers: string[]
  sentiment_label: string | null
  sentiment_score: number | null
  importance_score: number | null
  cluster_size: number
  published_at: string | null
  created_at: string
}

const SOURCE_ICONS: Record<string, { label: string; color: string }> = {
  finnhub: { label: 'FH', color: 'bg-blue-500/15 text-blue-600' },
  newsapi: { label: 'NA', color: 'bg-green-500/15 text-green-600' },
  alpha_vantage: { label: 'AV', color: 'bg-purple-500/15 text-purple-600' },
  seekingalpha: { label: 'SA', color: 'bg-orange-500/15 text-orange-600' },
  reddit: { label: 'RD', color: 'bg-red-500/15 text-red-600' },
  google_news: { label: 'GN', color: 'bg-sky-500/15 text-sky-600' },
  polygon: { label: 'PG', color: 'bg-indigo-500/15 text-indigo-600' },
  benzinga: { label: 'BZ', color: 'bg-amber-500/15 text-amber-600' },
  yahoo_finance: { label: 'YF', color: 'bg-violet-500/15 text-violet-600' },
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function SentimentIcon({ score }: { score: number | null }) {
  if (score === null) return null
  if (score > 0.1) return <TrendingUp className="h-3.5 w-3.5 text-green-500" />
  if (score < -0.1) return <TrendingDown className="h-3.5 w-3.5 text-red-500" />
  return <span className="h-3.5 w-3.5 inline-block rounded-full bg-gray-400" style={{ width: 6, height: 6 }} />
}

export default function TrendingNews() {
  const [search, setSearch] = useState('')
  const [source, setSource] = useState<string>('all')
  const [watchlistOnly, setWatchlistOnly] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)

  const { data, isLoading, isError, refetch } = useQuery<{ total: number; headlines: Headline[] }>({
    queryKey: ['news-headlines', source, search],
    queryFn: () => {
      const params = new URLSearchParams()
      if (source !== 'all') params.set('source', source)
      if (search) params.set('ticker', search)
      params.set('limit', '100')
      return axios.get(`/api/v1/news/headlines?${params}`).then(r => r.data)
    },
    refetchInterval: 600_000,
  })

  const headlines = data?.headlines || []

  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  const groupedHeadlines: Record<string, Headline[]> = {}
  headlines.forEach(h => {
    const d = h.published_at ? new Date(h.published_at).toDateString() : today
    const label = d === today ? 'Today' : d === yesterday ? 'Yesterday' : d
    if (!groupedHeadlines[label]) groupedHeadlines[label] = []
    groupedHeadlines[label].push(h)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Trending News</h2>
          <p className="text-sm text-muted-foreground">Market headlines aggregated from multiple sources</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)} className="gap-1.5">
            <Settings2 className="h-3.5 w-3.5" /> Configure Sources
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by ticker..."
            value={search}
            onChange={e => setSearch(e.target.value.toUpperCase())}
            className="pl-9"
          />
        </div>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="finnhub">Finnhub</SelectItem>
            <SelectItem value="newsapi">NewsAPI</SelectItem>
            <SelectItem value="alpha_vantage">Alpha Vantage</SelectItem>
            <SelectItem value="seekingalpha">Seeking Alpha</SelectItem>
            <SelectItem value="reddit">Reddit</SelectItem>
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

      {isError ? (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <XCircle className="h-10 w-10 text-destructive mb-2" />
            <p className="text-sm font-medium">Failed to load news</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : headlines.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Newspaper className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">No headlines yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Configure news sources to start aggregating</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedHeadlines).map(([label, items]) => (
          <div key={label} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">{label}</h3>
            <div className="space-y-1">
              {items.map(h => (
                <div
                  key={h.id}
                  className="group flex items-center gap-3 rounded-lg border px-3 py-2.5 hover:bg-accent/50 transition-colors"
                >
                  <Tooltip>
                    <TooltipTrigger>
                      <div className={`flex h-7 w-7 items-center justify-center rounded text-[10px] font-bold shrink-0 ${SOURCE_ICONS[h.source_api]?.color || 'bg-muted text-muted-foreground'}`}>
                        {SOURCE_ICONS[h.source_api]?.label || '?'}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{h.source_api}</TooltipContent>
                  </Tooltip>

                  <SentimentIcon score={h.sentiment_score} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {h.url ? (
                        <a
                          href={h.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium truncate hover:underline flex items-center gap-1"
                        >
                          {h.title}
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-70" />
                        </a>
                      ) : (
                        <span className="text-sm font-medium truncate">{h.title}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {h.tickers.slice(0, 3).map(t => (
                      <Badge key={t} variant="outline" className="text-[10px] font-mono cursor-pointer hover:bg-primary/10">
                        {t}
                      </Badge>
                    ))}
                    {h.tickers.length > 3 && (
                      <Badge variant="outline" className="text-[10px]">+{h.tickers.length - 3}</Badge>
                    )}
                    {h.cluster_size > 1 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {h.cluster_size} sources
                      </Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap w-14 text-right">
                      {timeAgo(h.published_at || h.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <NewsConnectionsDialog open={configOpen} onOpenChange={setConfigOpen} />
    </div>
  )
}
