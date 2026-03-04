import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus, Brain, HeartPulse, LineChart, Cog, Activity, Loader2, Trash2, RefreshCw, XCircle,
} from 'lucide-react'

interface Model {
  id: string
  name: string
  model_type: string
  provider: string
  model_identifier: string
  version: string | null
  description: string | null
  config: Record<string, unknown>
  status: string
  health_status: string
  last_health_check: string | null
  performance_metrics: Record<string, unknown> | null
  created_at: string
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  sentiment: { icon: HeartPulse, color: 'text-pink-500', label: 'Sentiment' },
  llm: { icon: Brain, color: 'text-purple-500', label: 'LLM' },
  strategy: { icon: LineChart, color: 'text-blue-500', label: 'Strategy' },
  option_analyzer: { icon: Cog, color: 'text-amber-500', label: 'Option Analyzer' },
}

const statusColors: Record<string, string> = {
  available: 'bg-green-500/10 text-green-600 border-green-500/20',
  downloading: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  error: 'bg-red-500/10 text-red-600 border-red-500/20',
  disabled: 'bg-muted text-muted-foreground',
}

const healthColors: Record<string, string> = {
  healthy: 'text-green-500',
  degraded: 'text-yellow-500',
  unhealthy: 'text-red-500',
  unknown: 'text-muted-foreground',
}

export default function ModelHub() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [form, setForm] = useState({
    name: '', model_type: 'llm', provider: 'ollama', model_identifier: '', version: '', description: '',
  })

  const { data: models, isLoading, isError, refetch } = useQuery<Model[]>({
    queryKey: ['models'],
    queryFn: () => axios.get('/api/v1/models').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: () => axios.post('/api/v1/models', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['models'] }); setOpen(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/v1/models/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['models'] }),
  })

  const healthMutation = useMutation({
    mutationFn: (id: string) => axios.post(`/api/v1/models/${id}/health-check`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['models'] }),
  })

  const toggleMutation = useMutation({
    mutationFn: (m: Model) =>
      axios.patch(`/api/v1/models/${m.id}`, { status: m.status === 'disabled' ? 'available' : 'disabled' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['models'] }),
  })

  const filtered = models?.filter(m => filterType === 'all' || m.model_type === filterType) ?? []
  const types = [...new Set(models?.map(m => m.model_type) ?? [])]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Model Hub</h2>
          <p className="text-sm text-muted-foreground">AI/ML models powering your trading intelligence</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5"><Plus className="h-4 w-4" /> Register Model</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Register New Model</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. My Custom Model" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.model_type} onValueChange={v => setForm(f => ({ ...f, model_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sentiment">Sentiment</SelectItem>
                      <SelectItem value="llm">LLM</SelectItem>
                      <SelectItem value="strategy">Strategy</SelectItem>
                      <SelectItem value="option_analyzer">Option Analyzer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={form.provider} onValueChange={v => setForm(f => ({ ...f, provider: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ollama">Ollama</SelectItem>
                      <SelectItem value="finbert">FinBERT</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Model Identifier</Label>
                <Input value={form.model_identifier} onChange={e => setForm(f => ({ ...f, model_identifier: e.target.value }))} placeholder="e.g. mistral, ProsusAI/finbert" />
              </div>
              <div className="space-y-2">
                <Label>Version</Label>
                <Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="e.g. 7b-q4" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={!form.name || !form.model_identifier || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Register
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="all" value={filterType} onValueChange={setFilterType}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {types.map(t => {
            const tc = typeConfig[t] || { label: t, icon: Cog, color: '' }
            return <TabsTrigger key={t} value={t}>{tc.label}</TabsTrigger>
          })}
        </TabsList>

        <TabsContent value={filterType} className="mt-4">
          {isError ? (
            <Card className="border-destructive/30">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <XCircle className="h-10 w-10 text-destructive mb-2" />
                <p className="text-sm font-medium">Failed to load models</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Brain className="h-10 w-10 opacity-30 mb-2" />
                <p className="text-sm">No models registered</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(m => {
                const tc = typeConfig[m.model_type] || { icon: Cog, color: 'text-muted-foreground', label: m.model_type }
                const Icon = tc.icon
                return (
                  <Card key={m.id} className="hover:border-primary/30 transition-colors">
                    <CardHeader className="pb-2 flex flex-row items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg bg-muted ${tc.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-sm">{m.name}</CardTitle>
                          <p className="text-[10px] text-muted-foreground">{m.provider} / {m.model_identifier}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Badge variant="outline" className={statusColors[m.status] || ''}>
                          {m.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {m.description && <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>}

                      <div className="flex items-center gap-2 text-xs">
                        <Activity className={`h-3 w-3 ${healthColors[m.health_status] || ''}`} />
                        <span className="text-muted-foreground">
                          {m.health_status}{m.last_health_check && ` (${new Date(m.last_health_check).toLocaleTimeString()})`}
                        </span>
                      </div>

                      {m.version && (
                        <div className="text-xs text-muted-foreground">Version: <span className="font-mono">{m.version}</span></div>
                      )}

                      <div className="flex gap-1 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 flex-1"
                          onClick={() => healthMutation.mutate(m.id)}
                          disabled={healthMutation.isPending}
                        >
                          <RefreshCw className={`h-3 w-3 ${healthMutation.isPending ? 'animate-spin' : ''}`} /> Check
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs flex-1"
                          onClick={() => toggleMutation.mutate(m)}
                        >
                          {m.status === 'disabled' ? 'Enable' : 'Disable'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => deleteMutation.mutate(m.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
