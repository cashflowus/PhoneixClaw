/**
 * Strategies page — strategy agents management.
 * Grid of strategy cards, create wizard, detail panel.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { FlexCard } from '@/components/ui/FlexCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SidePanel } from '@/components/ui/SidePanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Target, Plus, ChevronRight } from 'lucide-react'

const STRATEGY_TYPES = [
  { value: 'mean-reversion', label: 'Mean Reversion' },
  { value: 'momentum', label: 'Momentum' },
  { value: 'breakout', label: 'Breakout' },
  { value: 'pairs-trading', label: 'Pairs Trading' },
  { value: 'options-selling', label: 'Options Selling' },
]

interface Strategy {
  id: string
  name: string
  type: string
  status: string
  backtest_pnl: number
  backtest_sharpe: number
  created_at: string
}

const MOCK_STRATEGIES: Strategy[] = [
  { id: '1', name: 'SPY Mean Rev', type: 'mean-reversion', status: 'RUNNING', backtest_pnl: 8.2, backtest_sharpe: 1.4, created_at: '2025-02-01' },
  { id: '2', name: 'QQQ Momentum', type: 'momentum', status: 'PAUSED', backtest_pnl: 12.1, backtest_sharpe: 1.8, created_at: '2025-02-10' },
  { id: '3', name: 'ES Breakout', type: 'breakout', status: 'RUNNING', backtest_pnl: 5.4, backtest_sharpe: 1.1, created_at: '2025-02-15' },
]

export default function StrategiesPage() {
  const [selected, setSelected] = useState<Strategy | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [newStrategy, setNewStrategy] = useState({ name: '', type: 'momentum', symbol: '' })

  const { data: strategies = MOCK_STRATEGIES } = useQuery<Strategy[]>({
    queryKey: ['strategies'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/strategies')
        return res.data
      } catch {
        return MOCK_STRATEGIES
      }
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Strategies</h2>
          <p className="text-muted-foreground">Strategy agents and backtest results</p>
        </div>
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setWizardStep(1) }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Create Strategy</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Strategy — Step {wizardStep}/3</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {wizardStep === 1 && (
                <>
                  <div>
                    <Label>Strategy Name</Label>
                    <Input
                      value={newStrategy.name}
                      onChange={(e) => setNewStrategy({ ...newStrategy, name: e.target.value })}
                      placeholder="e.g. SPY-Momentum"
                    />
                  </div>
                  <Button className="w-full" onClick={() => setWizardStep(2)} disabled={!newStrategy.name}>
                    Next
                  </Button>
                </>
              )}
              {wizardStep === 2 && (
                <>
                  <div>
                    <Label>Strategy Type</Label>
                    <Select value={newStrategy.type} onValueChange={(v) => setNewStrategy({ ...newStrategy, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STRATEGY_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setWizardStep(1)}>Back</Button>
                    <Button className="flex-1" onClick={() => setWizardStep(3)}>Next</Button>
                  </div>
                </>
              )}
              {wizardStep === 3 && (
                <>
                  <div>
                    <Label>Primary Symbol</Label>
                    <Input
                      value={newStrategy.symbol}
                      onChange={(e) => setNewStrategy({ ...newStrategy, symbol: e.target.value })}
                      placeholder="e.g. SPY"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setWizardStep(2)}>Back</Button>
                    <Button className="flex-1" onClick={() => { setCreateOpen(false); setWizardStep(1) }}>
                      Create
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {strategies.map((s) => (
          <FlexCard
            key={s.id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            action={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
          >
            <div onClick={() => setSelected(s)} className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <span className="font-semibold">{s.name}</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">{s.type}</Badge>
                <StatusBadge status={s.status} />
              </div>
              <div className="text-xs text-muted-foreground grid grid-cols-2 gap-1">
                <span>Backtest P&L:</span>
                <span className={s.backtest_pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}>{s.backtest_pnl}%</span>
                <span>Sharpe:</span>
                <span>{s.backtest_sharpe.toFixed(2)}</span>
              </div>
            </div>
          </FlexCard>
        ))}
      </div>

      <SidePanel open={!!selected} onOpenChange={() => setSelected(null)} title={selected?.name ?? ''} description={selected?.type ?? ''}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={selected.status} />
              <span className="text-muted-foreground">Backtest P&L</span>
              <span className={selected.backtest_pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}>{selected.backtest_pnl}%</span>
              <span className="text-muted-foreground">Sharpe</span>
              <span>{selected.backtest_sharpe.toFixed(2)}</span>
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(selected.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  )
}
