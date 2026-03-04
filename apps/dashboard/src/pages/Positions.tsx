/**
 * Positions page — account-level view of open and closed positions.
 * M1.10.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { MetricCard } from '@/components/ui/MetricCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { TrendingUp } from 'lucide-react'

interface PositionData {
  id: string
  agent_id: string
  account_id: string
  symbol: string
  side: string
  qty: number
  entry_price: number
  current_price: number
  unrealized_pnl: number
  realized_pnl: number
  stop_loss: number | null
  take_profit: number | null
  status: string
  exit_price: number | null
  exit_reason: string | null
  opened_at: string
  closed_at: string | null
}

interface PositionSummary {
  open_positions: number
  total_unrealized_pnl: number
  total_realized_pnl: number
}

function pnlColor(pnl: number) {
  if (pnl > 0) return 'text-emerald-600 dark:text-emerald-400'
  if (pnl < 0) return 'text-red-600 dark:text-red-400'
  return ''
}

const openColumns: Column<PositionData>[] = [
  {
    id: 'symbol',
    header: 'Symbol',
    cell: (row) => <span className="font-mono font-semibold">{row.symbol}</span>,
  },
  {
    id: 'side',
    header: 'Side',
    cell: (row) => (
      <Badge variant={row.side === 'long' ? 'default' : 'destructive'} className="uppercase">
        {row.side}
      </Badge>
    ),
  },
  { id: 'qty', header: 'Qty', accessor: 'qty' },
  {
    id: 'entry_price',
    header: 'Entry',
    cell: (row) => `$${row.entry_price.toFixed(2)}`,
  },
  {
    id: 'current_price',
    header: 'Current',
    cell: (row) => `$${row.current_price.toFixed(2)}`,
  },
  {
    id: 'unrealized_pnl',
    header: 'P&L',
    cell: (row) => (
      <span className={pnlColor(row.unrealized_pnl)}>
        ${row.unrealized_pnl.toFixed(2)}
      </span>
    ),
  },
  {
    id: 'stop_loss',
    header: 'Stop Loss',
    cell: (row) => (row.stop_loss ? `$${row.stop_loss.toFixed(2)}` : '—'),
  },
  {
    id: 'opened_at',
    header: 'Opened',
    cell: (row) => new Date(row.opened_at).toLocaleString(),
  },
]

const closedColumns: Column<PositionData>[] = [
  {
    id: 'symbol',
    header: 'Symbol',
    cell: (row) => <span className="font-mono font-semibold">{row.symbol}</span>,
  },
  { id: 'side', header: 'Side', cell: (row) => <span className="uppercase">{row.side}</span> },
  { id: 'qty', header: 'Qty', accessor: 'qty' },
  { id: 'entry_price', header: 'Entry', cell: (row) => `$${row.entry_price.toFixed(2)}` },
  { id: 'exit_price', header: 'Exit', cell: (row) => row.exit_price ? `$${row.exit_price.toFixed(2)}` : '—' },
  {
    id: 'realized_pnl',
    header: 'P&L',
    cell: (row) => (
      <span className={pnlColor(row.realized_pnl)}>
        ${row.realized_pnl.toFixed(2)}
      </span>
    ),
  },
  { id: 'exit_reason', header: 'Exit Reason', cell: (row) => row.exit_reason ?? '—' },
  {
    id: 'closed_at',
    header: 'Closed',
    cell: (row) => row.closed_at ? new Date(row.closed_at).toLocaleString() : '—',
  },
]

export default function PositionsPage() {
  const { data: openPositions = [], isLoading: openLoading } = useQuery<PositionData[]>({
    queryKey: ['positions-open'],
    queryFn: async () => (await api.get('/api/v2/positions?status=OPEN')).data,
    refetchInterval: 5000,
  })

  const { data: closedPositions = [], isLoading: closedLoading } = useQuery<PositionData[]>({
    queryKey: ['positions-closed'],
    queryFn: async () => (await api.get('/api/v2/positions/closed')).data,
    refetchInterval: 30000,
  })

  const { data: summary } = useQuery<PositionSummary>({
    queryKey: ['position-summary'],
    queryFn: async () => (await api.get('/api/v2/positions/summary')).data,
    refetchInterval: 10000,
  })

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <PageHeader icon={TrendingUp} title="Positions" description="Account-level position management" />
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <MetricCard title="Open Positions" value={summary.open_positions} />
          <MetricCard
            title="Unrealized P&L"
            value={`$${summary.total_unrealized_pnl.toFixed(2)}`}
            trend={summary.total_unrealized_pnl >= 0 ? 'up' : 'down'}
          />
          <MetricCard
            title="Realized P&L"
            value={`$${summary.total_realized_pnl.toFixed(2)}`}
            trend={summary.total_realized_pnl >= 0 ? 'up' : 'down'}
          />
        </div>
      )}

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">
            Open ({openPositions.length})
          </TabsTrigger>
          <TabsTrigger value="closed">
            Closed ({closedPositions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-4">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <DataTable
              columns={openColumns}
              data={openPositions as (PositionData & Record<string, unknown>)[]}
              isLoading={openLoading}
              emptyMessage="No open positions"
            />
          </div>
        </TabsContent>

        <TabsContent value="closed" className="mt-4">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <DataTable
              columns={closedColumns}
              data={closedPositions as (PositionData & Record<string, unknown>)[]}
              isLoading={closedLoading}
              emptyMessage="No closed positions yet"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
