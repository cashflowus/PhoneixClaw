import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react'

export default function Mag7Widget() {
  const { data, isLoading } = useQuery<{ ticker: string; price: number; change_pct: number; market_cap: number }[]>({
    queryKey: ['market', 'mag7'],
    queryFn: () => axios.get('/api/v1/market/mag7').then(r => r.data),
    refetchInterval: 300_000,
  })

  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="p-2 space-y-1 overflow-auto h-full">
      {data?.map(s => (
        <div key={s.ticker} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold w-12">{s.ticker}</span>
            <span className="text-xs text-muted-foreground">${s.price.toLocaleString()}</span>
          </div>
          <div className={`flex items-center gap-1 text-xs font-medium ${s.change_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {s.change_pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(2)}%
          </div>
        </div>
      ))}
    </div>
  )
}
