import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Brain, Search, Eye, XCircle } from 'lucide-react'

interface AIDecision {
  id: string
  trigger_type: string
  ticker: string | null
  decision: string
  decision_rationale: string | null
  trade_params: Record<string, unknown> | null
  created_at: string | null
}

const DECISION_COLORS: Record<string, string> = {
  executed: 'bg-green-500/15 text-green-600 border-green-500/30',
  skipped: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
  error: 'bg-red-500/15 text-red-600 border-red-500/30',
}

export default function AIDecisions() {
  const [search, setSearch] = useState('')
  const [decisionFilter, setDecisionFilter] = useState('all')
  const [selectedDecision, setSelectedDecision] = useState<AIDecision | null>(null)

  const { data, isLoading, isError, refetch } = useQuery<{ total: number; decisions: AIDecision[] }>({
    queryKey: ['ai-decisions', search, decisionFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set('ticker', search)
      if (decisionFilter !== 'all') params.set('decision', decisionFilter)
      params.set('limit', '100')
      return axios.get(`/api/v1/ai/decisions?${params}`).then(r => r.data)
    },
    refetchInterval: 30_000,
  })

  const decisions = data?.decisions || []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">AI Trade Decisions</h2>
        <p className="text-sm text-muted-foreground">Audit log of all AI-generated trade recommendations</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by ticker..."
            value={search}
            onChange={e => setSearch(e.target.value.toUpperCase())}
            className="pl-9"
          />
        </div>
        <Select value={decisionFilter} onValueChange={setDecisionFilter}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="executed">Executed</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <XCircle className="h-10 w-10 text-destructive mb-2" />
              <p className="text-sm font-medium">Failed to load AI decisions</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : decisions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Brain className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">No AI decisions yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Decisions will appear when sentiment/news signals trigger the AI recommender</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Rationale</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decisions.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {d.created_at ? new Date(d.created_at).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="font-mono font-semibold text-sm">{d.ticker || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{d.trigger_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${DECISION_COLORS[d.decision] || ''}`}>
                        {d.decision}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="text-xs truncate text-muted-foreground">{d.decision_rationale || '-'}</p>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDecision(d)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedDecision} onOpenChange={v => { if (!v) setSelectedDecision(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Decision Details</DialogTitle>
          </DialogHeader>
          {selectedDecision && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Ticker:</span> <span className="font-mono font-bold">{selectedDecision.ticker || '-'}</span></div>
                <div><span className="text-muted-foreground">Trigger:</span> {selectedDecision.trigger_type}</div>
                <div><span className="text-muted-foreground">Decision:</span> <Badge variant="outline" className={DECISION_COLORS[selectedDecision.decision] || ''}>{selectedDecision.decision}</Badge></div>
                <div><span className="text-muted-foreground">Time:</span> {selectedDecision.created_at ? new Date(selectedDecision.created_at).toLocaleString() : '-'}</div>
              </div>
              {selectedDecision.decision_rationale && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Rationale</p>
                  <p className="text-sm">{selectedDecision.decision_rationale}</p>
                </div>
              )}
              {selectedDecision.trade_params && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Trade Parameters</p>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40">
                    {JSON.stringify(selectedDecision.trade_params, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
