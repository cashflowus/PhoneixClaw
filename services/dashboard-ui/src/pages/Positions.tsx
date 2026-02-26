import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, TrendingUp, TrendingDown, DollarSign, XCircle, Download, Clock } from 'lucide-react'
import { exportToCSV } from '@/lib/csv-export'

interface TradingAccount {
  id: string
  display_name: string
  broker_type: string
  paper_mode: boolean
  enabled: boolean
}

interface Position {
  id: number | string
  ticker: string
  strike: number
  option_type: string
  expiration: string | null
  quantity: number
  avg_entry_price: number
  total_cost: number
  profit_target: number
  stop_loss: number
  high_water_mark: number | null
  broker_symbol: string
  status: string
  opened_at: string | null
  closed_at: string | null
  close_reason: string | null
  realized_pnl: number | null
  account_id?: string
  account_name?: string
  unrealized_pl?: number
  current_price?: number
  market_value?: number
}

interface PendingOrder {
  order_id: string
  symbol: string
  ticker: string
  strike: number
  option_type: string
  expiration: string | null
  side: string
  qty: number
  filled_qty: number
  order_type: string
  limit_price: number | null
  status: string
  submitted_at: string | null
  filled_avg_price: number | null
  account_name?: string
}

export default function Positions() {
  const qc = useQueryClient()
  const [selectedAccount, setSelectedAccount] = useState<string>('all')

  const { data: accounts = [] } = useQuery<TradingAccount[]>({
    queryKey: ['trading-accounts'],
    queryFn: () => axios.get('/api/v1/accounts').then(r => r.data),
  })

  const acctParam = selectedAccount !== 'all' ? `&account_id=${selectedAccount}` : ''

  const { data: openPositions, isLoading: openLoading, isError: openError, refetch: refetchOpen } = useQuery<Position[]>({
    queryKey: ['positions', 'open', selectedAccount],
    queryFn: () => axios.get(`/api/v1/positions?status=OPEN${acctParam}`).then(r => r.data),
    refetchInterval: 5000,
  })

  const { data: closedPositions, isLoading: closedLoading, isError: closedError } = useQuery<Position[]>({
    queryKey: ['positions', 'closed', selectedAccount],
    queryFn: () => axios.get(`/api/v1/positions?status=CLOSED&limit=50${acctParam}`).then(r => r.data),
  })

  const { data: pendingOrders = [], isLoading: ordersLoading } = useQuery<PendingOrder[]>({
    queryKey: ['pending-orders', selectedAccount],
    queryFn: () => axios.get(`/api/v1/positions/orders${selectedAccount !== 'all' ? `?account_id=${selectedAccount}` : ''}`).then(r => r.data),
    refetchInterval: 5000,
  })

  const closeMut = useMutation({
    mutationFn: (id: number | string) => axios.post(`/api/v1/positions/${id}/close`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['positions'] }),
  })

  const handleClose = (id: number | string, ticker: string) => {
    if (window.confirm(`Close position for ${ticker}? This action cannot be undone.`)) {
      closeMut.mutate(id)
    }
  }

  const formatSymbol = (p: Position) => {
    if (!p.option_type) return p.ticker
    const exp = p.expiration ? ` ${new Date(p.expiration).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}` : ''
    return `${p.ticker} $${p.strike}${p.option_type === 'CALL' ? 'C' : 'P'}${exp}`
  }

  const formatOrderSymbol = (o: PendingOrder) => {
    if (!o.option_type) return o.ticker
    const exp = o.expiration ? ` ${new Date(o.expiration).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}` : ''
    return `${o.ticker} $${o.strike}${o.option_type === 'CALL' ? 'C' : 'P'}${exp}`
  }

  const totalPnl = (closedPositions ?? []).reduce((s, p) => s + (p.realized_pnl ?? 0), 0)
  const winCount = (closedPositions ?? []).filter(p => (p.realized_pnl ?? 0) > 0).length
  const totalClosed = (closedPositions ?? []).length

  if (openError || closedError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <XCircle className="h-10 w-10 text-destructive mb-3" />
        <p className="text-lg font-medium">Failed to load positions</p>
        <Button variant="outline" className="mt-4" onClick={() => refetchOpen()}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Positions</h1>
        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Select Trading Account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {accounts.filter(a => a.enabled).map(a => (
              <SelectItem key={a.id} value={a.id}>
                {a.display_name || a.broker_type} {a.paper_mode ? '(Paper)' : '(Live)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Open Positions</p>
                <p className="text-2xl font-bold">{openPositions?.length ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Realized P&L</p>
                <p className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  ${totalPnl.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold">
                  {totalClosed > 0 ? `${((winCount / totalClosed) * 100).toFixed(1)}%` : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Pending Orders
            {pendingOrders.length > 0 && (
              <Badge variant="outline" className="ml-1">{pendingOrders.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !pendingOrders.length ? (
            <p className="text-center text-muted-foreground py-8">No pending orders</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Filled</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Limit Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Account</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingOrders.map(o => (
                  <TableRow key={o.order_id}>
                    <TableCell className="font-medium">{formatOrderSymbol(o)}</TableCell>
                    <TableCell>
                      <Badge variant={o.side.toLowerCase() === 'buy' ? 'default' : 'secondary'}>
                        {o.side.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>{o.qty}</TableCell>
                    <TableCell>{o.filled_qty}</TableCell>
                    <TableCell className="text-xs">{o.order_type}</TableCell>
                    <TableCell>{o.limit_price != null ? `$${o.limit_price.toFixed(2)}` : '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{o.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {o.submitted_at ? new Date(o.submitted_at).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{o.account_name || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Open Positions
          </CardTitle>
          {openPositions && openPositions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                const headers = ['Symbol', 'Type', 'Qty', 'Entry', 'Current', 'Unrealized P&L', 'Account']
                const rows = openPositions.map(p => [
                  formatSymbol(p),
                  p.option_type,
                  String(p.quantity),
                  p.avg_entry_price.toFixed(2),
                  p.current_price?.toFixed(2) ?? '',
                  p.unrealized_pl?.toFixed(2) ?? '',
                  p.account_name || '',
                ])
                exportToCSV('open-positions', headers, rows)
              }}
            >
              <Download className="h-3 w-3" /> Export CSV
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {openLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !openPositions?.length ? (
            <p className="text-center text-muted-foreground py-8">No open positions</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead>Unrealized P&L</TableHead>
                  <TableHead>Market Value</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openPositions.map(p => (
                  <TableRow key={String(p.id)}>
                    <TableCell className="font-medium">{formatSymbol(p)}</TableCell>
                    <TableCell>
                      {p.option_type ? (
                        <Badge variant={p.option_type === 'CALL' ? 'default' : 'secondary'}>
                          {p.option_type}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Stock</Badge>
                      )}
                    </TableCell>
                    <TableCell>{p.quantity}</TableCell>
                    <TableCell>${p.avg_entry_price.toFixed(2)}</TableCell>
                    <TableCell>
                      {p.current_price != null ? `$${p.current_price.toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell>
                      {p.unrealized_pl != null ? (
                        <span className={p.unrealized_pl >= 0 ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
                          ${p.unrealized_pl.toFixed(2)}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      {p.market_value != null ? `$${p.market_value.toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.account_name || '—'}</TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleClose(p.id, formatSymbol(p))}
                        disabled={closeMut.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Close
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" /> Closed Positions
          </CardTitle>
          {closedPositions && closedPositions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                const headers = ['Symbol', 'Type', 'Qty', 'Entry', 'Reason', 'P&L', 'Closed']
                const rows = closedPositions.map(p => [
                  p.option_type ? `${p.ticker} $${p.strike}${p.option_type === 'CALL' ? 'C' : 'P'}` : p.ticker,
                  p.option_type,
                  String(p.quantity),
                  p.avg_entry_price.toFixed(2),
                  p.close_reason ?? '',
                  p.realized_pnl != null ? p.realized_pnl.toFixed(2) : '',
                  p.closed_at ? new Date(p.closed_at).toLocaleString() : '',
                ])
                exportToCSV('closed-positions', headers, rows)
              }}
            >
              <Download className="h-3 w-3" /> Export CSV
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {closedLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !closedPositions?.length ? (
            <p className="text-center text-muted-foreground py-8">No closed positions yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>P&L</TableHead>
                  <TableHead>Closed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closedPositions.map(p => (
                  <TableRow key={String(p.id)}>
                    <TableCell className="font-medium">
                      {p.option_type ? `${p.ticker} $${p.strike}${p.option_type === 'CALL' ? 'C' : 'P'}` : p.ticker}
                    </TableCell>
                    <TableCell>
                      {p.option_type ? (
                        <Badge variant={p.option_type === 'CALL' ? 'default' : 'secondary'}>
                          {p.option_type}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Stock</Badge>
                      )}
                    </TableCell>
                    <TableCell>{p.quantity}</TableCell>
                    <TableCell>${p.avg_entry_price.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.close_reason ?? '—'}</Badge>
                    </TableCell>
                    <TableCell>
                      {p.realized_pnl != null ? (
                        <span className={p.realized_pnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                          ${p.realized_pnl.toFixed(2)}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.closed_at ? new Date(p.closed_at).toLocaleString() : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
