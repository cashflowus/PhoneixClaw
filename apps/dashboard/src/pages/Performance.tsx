/**
 * Performance dashboard — PnL, win rate, Sharpe, drawdown.
 * Tabs: Portfolio, By Account, By Agent, By Source, By Instrument, Risk.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { MetricCard } from '@/components/ui/MetricCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const TIME_RANGES = ['1D', '1W', '1M', '3M', 'YTD', 'ALL'] as const

interface PerfRow {
  id: string
  name: string
  pnl: number
  win_rate: number
  sharpe: number
  max_dd: number
  trades: number
}

const perfColumns: Column<PerfRow>[] = [
  { id: 'name', header: 'Name', accessor: 'name' },
  {
    id: 'pnl',
    header: 'P&L',
    cell: (r) => (
      <span className={r.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}>
        ${r.pnl.toFixed(2)}
      </span>
    ),
  },
  { id: 'win_rate', header: 'Win Rate', cell: (r) => `${(r.win_rate * 100).toFixed(1)}%` },
  { id: 'sharpe', header: 'Sharpe', cell: (r) => r.sharpe.toFixed(2) },
  { id: 'max_dd', header: 'Max DD', cell: (r) => `${(r.max_dd * 100).toFixed(1)}%` },
  { id: 'trades', header: 'Trades', accessor: 'trades' },
]

const MOCK_PORTFOLIO: PerfRow[] = [
  { id: '1', name: 'Portfolio', pnl: 12450.32, win_rate: 0.58, sharpe: 1.42, max_dd: -0.08, trades: 142 },
]
const MOCK_BY_ACCOUNT: PerfRow[] = [
  { id: 'a1', name: 'IB Main', pnl: 8200, win_rate: 0.61, sharpe: 1.55, max_dd: -0.06, trades: 89 },
  { id: 'a2', name: 'IB Paper', pnl: 4250.32, win_rate: 0.54, sharpe: 1.21, max_dd: -0.09, trades: 53 },
]
const MOCK_BY_AGENT: PerfRow[] = [
  { id: 'ag1', name: 'SPY-Momentum', pnl: 5600, win_rate: 0.62, sharpe: 1.68, max_dd: -0.05, trades: 45 },
  { id: 'ag2', name: 'MeanRev-QQQ', pnl: 3850, win_rate: 0.55, sharpe: 1.12, max_dd: -0.11, trades: 52 },
  { id: 'ag3', name: 'Breakout-ES', pnl: 3000.32, win_rate: 0.52, sharpe: 0.98, max_dd: -0.12, trades: 45 },
]
const MOCK_BY_SOURCE: PerfRow[] = [
  { id: 's1', name: 'discord:signals', pnl: 7200, win_rate: 0.59, sharpe: 1.35, max_dd: -0.07, trades: 78 },
  { id: 's2', name: 'api:alerts', pnl: 5250.32, win_rate: 0.56, sharpe: 1.18, max_dd: -0.09, trades: 64 },
]
const MOCK_BY_INSTRUMENT: PerfRow[] = [
  { id: 'i1', name: 'SPY', pnl: 4200, win_rate: 0.6, sharpe: 1.45, max_dd: -0.06, trades: 38 },
  { id: 'i2', name: 'QQQ', pnl: 3850, win_rate: 0.57, sharpe: 1.22, max_dd: -0.08, trades: 42 },
  { id: 'i3', name: 'ES', pnl: 4400.32, win_rate: 0.54, sharpe: 1.08, max_dd: -0.1, trades: 62 },
]
const MOCK_RISK: PerfRow[] = [
  { id: 'r1', name: 'VaR 95%', pnl: -1200, win_rate: 0, sharpe: 0, max_dd: -0.02, trades: 0 },
  { id: 'r2', name: 'Exposure', pnl: 45000, win_rate: 0, sharpe: 0, max_dd: 0, trades: 0 },
]

export default function PerformancePage() {
  const [timeRange, setTimeRange] = useState<string>('1M')

  const { data: summary } = useQuery({
    queryKey: ['performance-summary', timeRange],
    queryFn: async () => {
      try {
        const res = await api.get(`/api/v2/performance/summary?range=${timeRange}`)
        return res.data
      } catch {
        return {
          total_pnl: 12450.32,
          win_rate: 0.58,
          sharpe_ratio: 1.42,
          max_drawdown: -0.08,
        }
      }
    },
  })

  const metrics = summary ?? {
    total_pnl: 12450.32,
    win_rate: 0.58,
    sharpe_ratio: 1.42,
    max_drawdown: -0.08,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance</h2>
          <p className="text-muted-foreground">Portfolio and agent performance metrics</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGES.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total P&L"
          value={`$${metrics.total_pnl?.toFixed(2) ?? '0.00'}`}
          trend={metrics.total_pnl >= 0 ? 'up' : 'down'}
        />
        <MetricCard title="Win Rate" value={`${((metrics.win_rate ?? 0) * 100).toFixed(1)}%`} />
        <MetricCard title="Sharpe Ratio" value={(metrics.sharpe_ratio ?? 0).toFixed(2)} />
        <MetricCard
          title="Max Drawdown"
          value={`${((metrics.max_drawdown ?? 0) * 100).toFixed(1)}%`}
          trend="down"
        />
      </div>

      <Tabs defaultValue="portfolio">
        <TabsList className="flex-wrap">
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="account">By Account</TabsTrigger>
          <TabsTrigger value="agent">By Agent</TabsTrigger>
          <TabsTrigger value="source">By Source</TabsTrigger>
          <TabsTrigger value="instrument">By Instrument</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
        </TabsList>
        <TabsContent value="portfolio" className="mt-4">
          <DataTable columns={perfColumns} data={MOCK_PORTFOLIO as (PerfRow & Record<string, unknown>)[]} emptyMessage="No data" />
        </TabsContent>
        <TabsContent value="account" className="mt-4">
          <DataTable columns={perfColumns} data={MOCK_BY_ACCOUNT as (PerfRow & Record<string, unknown>)[]} emptyMessage="No data" />
        </TabsContent>
        <TabsContent value="agent" className="mt-4">
          <DataTable columns={perfColumns} data={MOCK_BY_AGENT as (PerfRow & Record<string, unknown>)[]} emptyMessage="No data" />
        </TabsContent>
        <TabsContent value="source" className="mt-4">
          <DataTable columns={perfColumns} data={MOCK_BY_SOURCE as (PerfRow & Record<string, unknown>)[]} emptyMessage="No data" />
        </TabsContent>
        <TabsContent value="instrument" className="mt-4">
          <DataTable columns={perfColumns} data={MOCK_BY_INSTRUMENT as (PerfRow & Record<string, unknown>)[]} emptyMessage="No data" />
        </TabsContent>
        <TabsContent value="risk" className="mt-4">
          <DataTable columns={perfColumns} data={MOCK_RISK as (PerfRow & Record<string, unknown>)[]} emptyMessage="No data" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
