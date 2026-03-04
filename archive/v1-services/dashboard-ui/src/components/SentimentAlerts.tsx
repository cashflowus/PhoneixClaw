import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Bell, Plus, Trash2, Loader2 } from 'lucide-react'

interface Alert {
  id: string
  ticker: string | null
  alert_type: string
  config: Record<string, unknown>
  enabled: boolean
  last_triggered_at: string | null
  created_at: string
}

const ALERT_TYPES: Record<string, { label: string; description: string }> = {
  threshold: { label: 'Score Threshold', description: 'Alert when sentiment score crosses a threshold' },
  flip: { label: 'Sentiment Flip', description: 'Alert when sentiment flips between bullish and bearish' },
  spike: { label: 'Mention Spike', description: 'Alert on sudden mention count change' },
  mention_count: { label: 'Mention Count', description: 'Alert when mentions reach a minimum count' },
}

const emptyForm = { ticker: '', alert_type: 'threshold', config: {} as Record<string, string | number> }

export function SentimentAlerts() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })

  const { data: alerts, isLoading } = useQuery<Alert[]>({
    queryKey: ['sentiment-alerts'],
    queryFn: () => axios.get('/api/v1/sentiment/alerts').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyForm) =>
      axios.post('/api/v1/sentiment/alerts', {
        ticker: data.ticker || null,
        alert_type: data.alert_type,
        config: data.config,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sentiment-alerts'] })
      setOpen(false)
      setForm({ ...emptyForm })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => axios.patch(`/api/v1/sentiment/alerts/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sentiment-alerts'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/v1/sentiment/alerts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sentiment-alerts'] }),
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" /> Sentiment Alerts
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Alert
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Sentiment Alert</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Ticker (leave empty for all)</Label>
                <Input
                  value={form.ticker}
                  onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                  placeholder="e.g. AAPL or leave blank"
                />
              </div>
              <div className="space-y-2">
                <Label>Alert Type</Label>
                <Select value={form.alert_type} onValueChange={v => setForm(f => ({ ...f, alert_type: v, config: {} }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ALERT_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{ALERT_TYPES[form.alert_type]?.description}</p>
              </div>
              {form.alert_type === 'threshold' && (
                <>
                  <div className="space-y-2">
                    <Label>Direction</Label>
                    <Select
                      value={String(form.config.direction || 'below')}
                      onValueChange={v => setForm(f => ({ ...f, config: { ...f.config, direction: v } }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="below">Score Below</SelectItem>
                        <SelectItem value="above">Score Above</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Score Threshold (-1 to 1)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="-1"
                      max="1"
                      value={form.config.score_threshold ?? ''}
                      onChange={e => setForm(f => ({ ...f, config: { ...f.config, score_threshold: parseFloat(e.target.value) } }))}
                    />
                  </div>
                </>
              )}
              {form.alert_type === 'spike' && (
                <div className="space-y-2">
                  <Label>Minimum Change % to Trigger</Label>
                  <Input
                    type="number"
                    min="10"
                    value={form.config.min_change_pct ?? 50}
                    onChange={e => setForm(f => ({ ...f, config: { ...f.config, min_change_pct: parseInt(e.target.value) } }))}
                  />
                </div>
              )}
              {form.alert_type === 'mention_count' && (
                <div className="space-y-2">
                  <Label>Minimum Mentions (per 30-min window)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.config.min_mentions ?? 10}
                    onChange={e => setForm(f => ({ ...f, config: { ...f.config, min_mentions: parseInt(e.target.value) } }))}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Cooldown (minutes)</Label>
                <Input
                  type="number"
                  min="5"
                  value={form.config.cooldown_minutes ?? 60}
                  onChange={e => setForm(f => ({ ...f, config: { ...f.config, cooldown_minutes: parseInt(e.target.value) } }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Create Alert
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading alerts...</p>
        ) : !alerts || alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No alerts configured</p>
        ) : (
          <div className="space-y-2">
            {alerts.map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={a.enabled}
                    onCheckedChange={() => toggleMutation.mutate(a.id)}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {ALERT_TYPES[a.alert_type]?.label || a.alert_type}
                      </span>
                      {a.ticker && (
                        <Badge variant="outline" className="text-xs font-mono">{a.ticker}</Badge>
                      )}
                    </div>
                    {a.last_triggered_at && (
                      <p className="text-[11px] text-muted-foreground">
                        Last fired: {new Date(a.last_triggered_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => deleteMutation.mutate(a.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
