/**
 * Trades page — pipeline view of all trade intents.
 * Shows trades flowing through: PENDING -> RISK_CHECK -> APPROVED -> FILLED | REJECTED
 * M1.10.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { MetricCard } from '@/components/ui/MetricCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SidePanel } from '@/components/ui/SidePanel'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

interface Trade {
  id: string
  agent_id: string
  account_id: string
  symbol: string
  side: string
  qty: number
  order_type: string
  limit_price: number | null
  stop_price: number | null
  status: string
  fill_price: number | null
  filled_at: string | null
  rejection_reason: string | null
  signal_source: string | null
  created_at: string
}

interface TradeStats {
  total: number
  filled: number
  rejected: number
  pending: number
}

const STATUS_OPTIONS = ['', 'PENDING', 'RISK_CHECK', 'APPROVED', 'SUBMITTED', 'FILLED', 'REJECTED', 'FAILED']

const columns: Column<Trade>[] = [
  {
    id: 'symbol',
    header: 'Symbol',
    cell: (row) => <span className="font-mono font-semibold">{row.symbol}</span>,
  },
  {
    id: 'side',
    header: 'Side',
    cell: (row) => (
      <Badge variant={row.side === 'buy' ? 'default' : 'destructive'} className="uppercase">
        {row.side}
      </Badge>
    ),
  },
  { id: 'qty', header: 'Qty', accessor: 'qty' },
  { id: 'order_type', header: 'Type', accessor: 'order_type' },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => <StatusBadge status={row.status} />,
  },
  {
    id: 'fill_price',
    header: 'Fill Price',
    cell: (row) => (row.fill_price ? `$${row.fill_price.toFixed(2)}` : '—'),
  },
  { id: 'signal_source', header: 'Source', cell: (row) => row.signal_source ?? '—' },
  {
    id: 'created_at',
    header: 'Time',
    cell: (row) => new Date(row.created_at).toLocaleString(),
  },
]

export default function TradesPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [symbolFilter, setSymbolFilter] = useState('')
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)

  const { data: trades = [], isLoading } = useQuery<Trade[]>({
    queryKey: ['trades', statusFilter, symbolFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (symbolFilter) params.set('symbol', symbolFilter)
      const res = await api.get(`/api/v2/trades?${params}`)
      return res.data
    },
    refetchInterval: 5000,
  })

  const { data: stats } = useQuery<TradeStats>({
    queryKey: ['trade-stats'],
    queryFn: async () => (await api.get('/api/v2/trades/stats')).data,
    refetchInterval: 10000,
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Trades</h2>
        <p className="text-muted-foreground">Pipeline view of all trade intents from agents</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard title="Total Trades" value={stats.total} />
          <MetricCard title="Filled" value={stats.filled} trend="up" />
          <MetricCard title="Rejected" value={stats.rejected} trend="down" />
          <MetricCard title="Pending" value={stats.pending} trend="neutral" />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Filter by symbol..."
          value={symbolFilter}
          onChange={(e) => setSymbolFilter(e.target.value)}
          className="w-full sm:w-48"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s || '__all'} value={s || ' '}>
                {s || 'All'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={trades as (Trade & Record<string, unknown>)[]}
        isLoading={isLoading}
        emptyMessage="No trades yet. Agents will generate trade intents here."
      />

      <SidePanel
        open={!!selectedTrade}
        onOpenChange={() => setSelectedTrade(null)}
        title={selectedTrade ? `Trade: ${selectedTrade.symbol}` : ''}
      >
        {selectedTrade && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Symbol</span>
              <span className="font-mono">{selectedTrade.symbol}</span>
              <span className="text-muted-foreground">Side</span>
              <span className="uppercase">{selectedTrade.side}</span>
              <span className="text-muted-foreground">Quantity</span>
              <span>{selectedTrade.qty}</span>
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={selectedTrade.status} />
              <span className="text-muted-foreground">Fill Price</span>
              <span>{selectedTrade.fill_price ? `$${selectedTrade.fill_price.toFixed(2)}` : '—'}</span>
              <span className="text-muted-foreground">Source</span>
              <span>{selectedTrade.signal_source ?? '—'}</span>
            </div>
            {selectedTrade.rejection_reason && (
              <div className="p-3 bg-destructive/10 rounded text-sm text-destructive">
                <strong>Rejected:</strong> {selectedTrade.rejection_reason}
              </div>
            )}
          </div>
        )}
      </SidePanel>
    </div>
  )
}
