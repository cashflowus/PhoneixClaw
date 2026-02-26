import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

interface Connection {
  id: string
  source_api: string
  display_name: string
  enabled: boolean
  last_poll_at: string | null
  error_message: string | null
  created_at: string
}

const SOURCES: Record<string, { label: string; needsKey: boolean; description: string }> = {
  finnhub: { label: 'Finnhub', needsKey: true, description: 'Market news via Finnhub API' },
  newsapi: { label: 'NewsAPI', needsKey: true, description: 'Business headlines from NewsAPI.org' },
  alpha_vantage: { label: 'Alpha Vantage', needsKey: true, description: 'News sentiment from Alpha Vantage' },
  seekingalpha: { label: 'Seeking Alpha', needsKey: true, description: 'Market news via RapidAPI' },
  reddit: { label: 'Reddit', needsKey: false, description: 'Trending posts from finance subreddits' },
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function NewsConnectionsDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ source_api: 'finnhub', display_name: '', api_key: '' })

  const { data: connections } = useQuery<Connection[]>({
    queryKey: ['news-connections'],
    queryFn: () => axios.get('/api/v1/news/connections').then(r => r.data),
    enabled: open,
  })

  const createMutation = useMutation({
    mutationFn: () => axios.post('/api/v1/news/connections', {
      source_api: form.source_api,
      display_name: form.display_name || SOURCES[form.source_api]?.label || form.source_api,
      api_key: form.api_key || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['news-connections'] })
      setShowAdd(false)
      setForm({ source_api: 'finnhub', display_name: '', api_key: '' })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => axios.patch(`/api/v1/news/connections/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['news-connections'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/v1/news/connections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['news-connections'] }),
  })

  const existingSources = new Set((connections || []).map(c => c.source_api))
  const availableSources = Object.keys(SOURCES).filter(k => !existingSources.has(k))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configure News Sources</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {(connections || []).map(c => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={c.enabled}
                  onCheckedChange={() => toggleMutation.mutate(c.id)}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.display_name}</span>
                    <Badge variant="outline" className="text-[10px]">{c.source_api}</Badge>
                  </div>
                  {c.error_message ? (
                    <p className="text-[11px] text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {c.error_message}
                    </p>
                  ) : c.last_poll_at ? (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Last poll: {new Date(c.last_poll_at).toLocaleString()}
                    </p>
                  ) : null}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => deleteMutation.mutate(c.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          {(!connections || connections.length === 0) && !showAdd && (
            <p className="text-sm text-muted-foreground text-center py-4">No news sources configured</p>
          )}
        </div>

        {showAdd && (
          <div className="space-y-3 mt-2 rounded-lg border p-3 bg-muted/30">
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={form.source_api} onValueChange={v => setForm(f => ({ ...f, source_api: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableSources.map(k => (
                    <SelectItem key={k} value={k}>{SOURCES[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{SOURCES[form.source_api]?.description}</p>
            </div>
            {SOURCES[form.source_api]?.needsKey && (
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={form.api_key}
                  onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                  placeholder="Enter your API key"
                  className="font-mono"
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || (SOURCES[form.source_api]?.needsKey && !form.api_key)}
              >
                {createMutation.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                Add Source
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {!showAdd && availableSources.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Source
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
