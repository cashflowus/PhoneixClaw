/**
 * Market Command Center — TradingView chart, indices, movers, options flow, news, watchlist, quick trade.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { FlexCard } from '@/components/ui/FlexCard'
import { MetricCard } from '@/components/ui/MetricCard'
import { Newspaper } from 'lucide-react'

const MOCK_INDICES = [
  { symbol: 'SPX', name: 'S&P 500', value: 5123.45, change: 0.82 },
  { symbol: 'NDX', name: 'Nasdaq 100', value: 18123.22, change: 1.12 },
  { symbol: 'DJI', name: 'Dow Jones', value: 38912.34, change: 0.45 },
]

const MOCK_MOVERS = [
  { symbol: 'NVDA', change: 4.2, direction: 'up' as const },
  { symbol: 'TSLA', change: -2.8, direction: 'down' as const },
  { symbol: 'AAPL', change: 1.1, direction: 'up' as const },
  { symbol: 'META', change: -1.5, direction: 'down' as const },
]

const MOCK_OPTIONS_FLOW = [
  { symbol: 'SPY', type: 'CALL', strike: 520, premium: 125000 },
  { symbol: 'QQQ', type: 'PUT', strike: 480, premium: 89000 },
  { symbol: 'AAPL', type: 'CALL', strike: 195, premium: 67000 },
]

const MOCK_NEWS = [
  { title: 'Fed signals potential rate cut in Q2', time: '2m ago' },
  { title: 'Tech earnings beat expectations', time: '15m ago' },
  { title: 'Oil prices rise on supply concerns', time: '32m ago' },
]

const MOCK_WATCHLIST = [
  { symbol: 'AAPL', price: 178.45, change: 0.3 },
  { symbol: 'MSFT', price: 415.22, change: -0.1 },
  { symbol: 'GOOGL', price: 142.80, change: 0.8 },
]

export default function MarketPage() {
  const { data: indices = MOCK_INDICES } = useQuery({
    queryKey: ['market-indices'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/market/indices')
        return res.data
      } catch {
        return MOCK_INDICES
      }
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Market Command Center</h2>
        <p className="text-muted-foreground">Live charts, indices, options flow, and news</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="S&P 500" value="5,123" trend="up" />
        <MetricCard title="VIX" value="14.2" />
        <MetricCard title="DXY" value="103.8" />
        <MetricCard title="BTC" value="$67.2k" trend="up" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* TradingView chart — spans 2 cols on desktop */}
        <div className="lg:col-span-2">
          <FlexCard title="Chart" className="overflow-hidden">
            <div className="aspect-[16/9] min-h-[280px] bg-muted/30 rounded-lg">
              <iframe
                title="TradingView Chart"
                src="https://www.tradingview.com/chart/?symbol=NASDAQ:AAPL"
                className="w-full h-full border-0"
              />
            </div>
          </FlexCard>
        </div>

        {/* Right column: indices + quick trade */}
        <div className="space-y-6">
          <FlexCard title="Market Indices">
            <div className="space-y-3">
              {indices.map((idx: { symbol: string; name: string; value?: number; change?: number }) => (
                <div key={idx.symbol} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{idx.symbol}</p>
                    <p className="text-xs text-muted-foreground">{idx.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm">{idx.value?.toLocaleString() ?? idx.value}</p>
                    <p className={`text-xs ${(idx.change ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {(idx.change ?? 0) >= 0 ? '+' : ''}{idx.change}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </FlexCard>

          <FlexCard title="Quick Trade">
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Symbol"
                className="w-full px-3 py-2 rounded border bg-background text-sm"
              />
              <div className="flex gap-2">
                <button className="flex-1 py-2 rounded bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">
                  Buy
                </button>
                <button className="flex-1 py-2 rounded bg-red-600 text-white text-sm font-medium hover:bg-red-700">
                  Sell
                </button>
              </div>
            </div>
          </FlexCard>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <FlexCard title="Top Movers">
          <div className="space-y-2">
            {MOCK_MOVERS.map((m) => (
              <div key={m.symbol} className="flex justify-between items-center">
                <span className="font-medium">{m.symbol}</span>
                <span className={m.direction === 'up' ? 'text-emerald-600' : 'text-red-600'}>
                  {m.direction === 'up' ? '+' : ''}{m.change}%
                </span>
              </div>
            ))}
          </div>
        </FlexCard>

        <FlexCard title="Options Flow">
          <div className="space-y-2">
            {MOCK_OPTIONS_FLOW.map((o, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span>
                  {o.symbol} ${o.strike} {o.type}
                </span>
                <span className="text-muted-foreground">${(o.premium / 1000).toFixed(0)}k</span>
              </div>
            ))}
          </div>
        </FlexCard>

        <FlexCard title="News Feed">
          <div className="space-y-2">
            {MOCK_NEWS.map((n, i) => (
              <div key={i} className="flex gap-2">
                <Newspaper className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.time}</p>
                </div>
              </div>
            ))}
          </div>
        </FlexCard>
      </div>

      <FlexCard title="Watchlist">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {MOCK_WATCHLIST.map((w) => (
            <div key={w.symbol} className="p-3 rounded-lg border bg-muted/20">
              <p className="font-medium">{w.symbol}</p>
              <p className="font-mono text-sm">{w.price}</p>
              <p className={`text-xs ${w.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {w.change >= 0 ? '+' : ''}{w.change}%
              </p>
            </div>
          ))}
        </div>
      </FlexCard>
    </div>
  )
}
