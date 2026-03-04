import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus, Workflow, MoreVertical, Trash2, Pencil, Copy, Loader2, XCircle,
} from 'lucide-react'
import { defaultTemplates } from '@/components/pipeline/templates'

interface Pipeline {
  id: string
  name: string
  description: string | null
  status: string
  version: number
  enabled: boolean
  created_at: string
  updated_at: string
}

export default function AdvancedPipelines() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', template: '' })

  const { data: pipelines, isLoading, isError, refetch } = useQuery<Pipeline[]>({
    queryKey: ['advanced-pipelines'],
    queryFn: () => axios.get('/api/v1/advanced-pipelines').then(r => r.data),
    refetchInterval: 10_000,
  })

  const createMutation = useMutation({
    mutationFn: (payload: object) => axios.post('/api/v1/advanced-pipelines', payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['advanced-pipelines'] })
      setOpen(false)
      navigate(`/advanced-pipelines/${res.data.id}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/v1/advanced-pipelines/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['advanced-pipelines'] }),
  })

  const handleCreate = () => {
    const template = defaultTemplates.find(t => t.name === form.template)
    createMutation.mutate({
      name: form.name,
      description: form.description,
      flow_json: template ? { nodes: template.nodes, edges: template.edges } : { nodes: [], edges: [] },
    })
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-500/15 text-gray-600',
    deployed: 'bg-green-500/15 text-green-600',
    error: 'bg-red-500/15 text-red-600',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Advanced Pipelines</h2>
          <p className="text-sm text-muted-foreground">Build visual trade pipelines with drag-and-drop</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5"><Plus className="h-4 w-4" /> New Pipeline</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Advanced Pipeline</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My Trading Pipeline" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
              </div>
              <div className="space-y-2">
                <Label>Start from Template</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, template: '' }))}
                    className={`rounded-lg border p-3 text-left text-xs transition-colors ${!form.template ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                  >
                    <p className="font-medium">Blank Canvas</p>
                    <p className="text-muted-foreground mt-0.5">Start from scratch</p>
                  </button>
                  {defaultTemplates.map(t => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, template: t.name }))}
                      className={`rounded-lg border p-3 text-left text-xs transition-colors ${form.template === t.name ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                    >
                      <p className="font-medium">{t.name}</p>
                      <p className="text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={!form.name || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isError ? (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <XCircle className="h-10 w-10 text-destructive mb-2" />
            <p className="text-sm font-medium">Failed to load pipelines</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : !pipelines || pipelines.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Workflow className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">No advanced pipelines yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Create your first visual pipeline to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pipelines.map(p => (
            <Card
              key={p.id}
              className="group cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/advanced-pipelines/${p.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">{p.name}</h3>
                    {p.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); navigate(`/advanced-pipelines/${p.id}`) }}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); createMutation.mutate({ name: `${p.name} (copy)`, flow_json: {} }) }}>
                        <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={e => { e.stopPropagation(); deleteMutation.mutate(p.id) }}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] ${statusColors[p.status] || ''}`}>{p.status}</Badge>
                  <span className="text-[10px] text-muted-foreground">v{p.version}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{new Date(p.updated_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
