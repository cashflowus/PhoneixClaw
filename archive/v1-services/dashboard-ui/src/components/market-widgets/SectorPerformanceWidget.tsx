import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Loader2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function SectorPerformanceWidget() {
  const { data, isLoading } = useQuery<{ sector: string; etf: string; change_pct: number }[]>({
    queryKey: ['market', 'sectors'],
    queryFn: () => axios.get('/api/v1/market/sectors').then(r => r.data),
    refetchInterval: 300_000,
  })

  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  const maxAbs = Math.max(...(data?.map(s => Math.abs(s.change_pct)) || [1]), 1)

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1.5">
        {data?.map(s => (
          <div key={s.etf} className="flex items-center gap-2 px-1">
            <span className="text-[10px] w-28 truncate text-muted-foreground">{s.sector}</span>
            <div className="flex-1 h-4 relative bg-muted/30 rounded overflow-hidden">
              <div
                className={`absolute top-0 h-full rounded ${s.change_pct >= 0 ? 'bg-green-500/70 left-1/2' : 'bg-red-500/70 right-1/2'}`}
                style={{ width: `${(Math.abs(s.change_pct) / maxAbs) * 50}%` }}
              />
            </div>
            <span className={`text-[10px] font-mono w-14 text-right ${s.change_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
