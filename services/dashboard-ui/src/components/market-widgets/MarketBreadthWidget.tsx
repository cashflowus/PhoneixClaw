import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react'

export default function MarketBreadthWidget() {
  const { data, isLoading } = useQuery<{ index: string; price: number; change_pct: number }[]>({
    queryKey: ['market', 'breadth'],
    queryFn: () => axios.get('/api/v1/market/breadth').then(r => r.data),
    refetchInterval: 300_000,
  })

  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="p-3 space-y-2 h-full overflow-auto">
      {data?.map(idx => (
        <div key={idx.index} className="rounded-lg border p-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium">{idx.index}</span>
            <div className={`flex items-center gap-1 text-[11px] font-medium ${idx.change_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {idx.change_pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {idx.change_pct >= 0 ? '+' : ''}{idx.change_pct.toFixed(2)}%
            </div>
          </div>
          <p className="text-lg font-bold">{idx.price.toLocaleString()}</p>
          <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
            <div
              className={`h-full rounded-full ${idx.change_pct >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(Math.abs(idx.change_pct) * 20, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
