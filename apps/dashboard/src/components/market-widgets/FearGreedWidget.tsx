import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Loader2 } from 'lucide-react'

export default function FearGreedWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['market', 'fear-greed'],
    queryFn: () => axios.get('/api/v1/market/fear-greed').then(r => r.data),
    refetchInterval: 300_000,
  })

  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  const score = data?.score ?? 50
  const rating = data?.rating ?? 'Neutral'
  const angle = (score / 100) * 180 - 90

  const getColor = (s: number) => {
    if (s <= 25) return '#ef4444'
    if (s <= 45) return '#f97316'
    if (s <= 55) return '#eab308'
    if (s <= 75) return '#84cc16'
    return '#22c55e'
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-3 gap-2">
      <svg viewBox="0 0 200 120" className="w-full max-w-[180px]">
        <defs>
          <linearGradient id="fgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="25%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="75%" stopColor="#84cc16" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#fgGrad)" strokeWidth="12" strokeLinecap="round" />
        <line
          x1="100" y1="100"
          x2={100 + 60 * Math.cos((angle * Math.PI) / 180)}
          y2={100 - 60 * Math.sin((angle * Math.PI) / 180)}
          stroke={getColor(score)} strokeWidth="3" strokeLinecap="round"
        />
        <circle cx="100" cy="100" r="4" fill={getColor(score)} />
      </svg>
      <div className="text-center">
        <p className="text-2xl font-bold" style={{ color: getColor(score) }}>{Math.round(score)}</p>
        <p className="text-xs text-muted-foreground font-medium">{rating}</p>
      </div>
      {data?.previous_close !== undefined && (
        <div className="flex gap-3 text-[9px] text-muted-foreground">
          <span>Prev: {Math.round(data.previous_close)}</span>
          <span>1W: {Math.round(data.one_week_ago ?? 0)}</span>
          <span>1M: {Math.round(data.one_month_ago ?? 0)}</span>
        </div>
      )}
    </div>
  )
}
