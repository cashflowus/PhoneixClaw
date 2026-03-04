import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function PlatformSentimentWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['sentiment', 'overview'],
    queryFn: () => axios.get('/api/v1/sentiment/tickers').then(r => r.data).catch(() => []),
    refetchInterval: 120_000,
  })

  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  const tickers = Array.isArray(data) ? data.slice(0, 8) : []
  const bullish = tickers.filter((t: any) => t.sentiment_label === 'bullish').length
  const bearish = tickers.filter((t: any) => t.sentiment_label === 'bearish').length
  const total = tickers.length || 1

  return (
    <div className="p-3 h-full flex flex-col gap-3">
      <div className="text-center">
        <p className="text-[10px] text-muted-foreground uppercase font-medium">Overall Mood</p>
        <div className="flex items-center justify-center gap-4 mt-1">
          <div className="text-center">
            <div className="flex items-center gap-1 text-green-500">
              <TrendingUp className="h-3 w-3" />
              <span className="text-lg font-bold">{Math.round((bullish / total) * 100)}%</span>
            </div>
            <p className="text-[9px] text-muted-foreground">Bullish</p>
          </div>
          <div className="text-center">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Minus className="h-3 w-3" />
              <span className="text-lg font-bold">{Math.round(((total - bullish - bearish) / total) * 100)}%</span>
            </div>
            <p className="text-[9px] text-muted-foreground">Neutral</p>
          </div>
          <div className="text-center">
            <div className="flex items-center gap-1 text-red-500">
              <TrendingDown className="h-3 w-3" />
              <span className="text-lg font-bold">{Math.round((bearish / total) * 100)}%</span>
            </div>
            <p className="text-[9px] text-muted-foreground">Bearish</p>
          </div>
        </div>
      </div>

      <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
        <div className="bg-green-500 h-full" style={{ width: `${(bullish / total) * 100}%` }} />
        <div className="bg-yellow-500 h-full" style={{ width: `${((total - bullish - bearish) / total) * 100}%` }} />
        <div className="bg-red-500 h-full" style={{ width: `${(bearish / total) * 100}%` }} />
      </div>

      <div className="flex-1 overflow-auto space-y-1">
        {tickers.map((t: any) => (
          <div key={t.ticker} className="flex items-center justify-between text-[10px] px-1">
            <span className="font-medium">{t.ticker}</span>
            <Badge variant="outline" className="text-[8px]">{t.sentiment_label}</Badge>
          </div>
        ))}
      </div>
      {tickers.length === 0 && (
        <p className="text-[10px] text-muted-foreground text-center">Connect Discord data sources to see sentiment</p>
      )}
    </div>
  )
}
