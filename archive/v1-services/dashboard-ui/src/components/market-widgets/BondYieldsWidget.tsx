import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react'

export default function BondYieldsWidget() {
  const { data, isLoading } = useQuery<{ maturity: string; yield_pct: number; change: number }[]>({
    queryKey: ['market', 'bond-yields'],
    queryFn: () => axios.get('/api/v1/market/bond-yields').then(r => r.data),
    refetchInterval: 300_000,
  })

  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="p-3 h-full">
      <div className="grid grid-cols-2 gap-2 h-full">
        {data?.map(b => (
          <div key={b.maturity} className="rounded-lg border p-3 flex flex-col items-center justify-center">
            <p className="text-[10px] text-muted-foreground font-medium">{b.maturity} Treasury</p>
            <p className="text-xl font-bold">{b.yield_pct.toFixed(3)}%</p>
            <div className={`flex items-center gap-0.5 text-[10px] ${b.change >= 0 ? 'text-red-500' : 'text-green-500'}`}>
              {b.change >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {b.change >= 0 ? '+' : ''}{b.change.toFixed(3)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
