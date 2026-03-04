/**
 * Connectors page — data source connector management.
 * FlexCards, add dialog, test connection, agent linking.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { FlexCard } from '@/components/ui/FlexCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plug, Plus, Wifi, Link2 } from 'lucide-react'

const CONNECTOR_TYPES = ['alpaca', 'ibkr', 'discord', 'polygon', 'webhook']

interface Connector {
  id: string
  name: string
  type: string
  status: string
  last_connected: string
  linked_agents: number
}

const MOCK_CONNECTORS: Connector[] = [
  { id: '1', name: 'Alpaca Live', type: 'alpaca', status: 'online', last_connected: '2025-03-03T10:15:00Z', linked_agents: 2 },
  { id: '2', name: 'IBKR Paper', type: 'ibkr', status: 'online', last_connected: '2025-03-03T10:14:00Z', linked_agents: 1 },
  { id: '3', name: 'Discord Signals', type: 'discord', status: 'idle', last_connected: '2025-03-02T18:00:00Z', linked_agents: 1 },
]

export default function ConnectorsPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [newConn, setNewConn] = useState({ name: '', type: 'alpaca', api_key: '' })
  const [testing, setTesting] = useState<string | null>(null)

  const { data: connectors = MOCK_CONNECTORS } = useQuery<Connector[]>({
    queryKey: ['connectors'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/connectors')
        return res.data
      } catch {
        return MOCK_CONNECTORS
      }
    },
  })

  const testConnection = async (id: string) => {
    setTesting(id)
    try {
      await api.post(`/api/v2/connectors/${id}/test`)
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader icon={Plug} title="Connectors" description="Data source and broker connectors">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Add Connector</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Connector</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={newConn.name} onChange={(e) => setNewConn({ ...newConn, name: e.target.value })} placeholder="e.g. Alpaca Live" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={newConn.type} onValueChange={(v) => setNewConn({ ...newConn, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONNECTOR_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>API Key (optional)</Label>
                <Input type="password" value={newConn.api_key} onChange={(e) => setNewConn({ ...newConn, api_key: e.target.value })} placeholder="••••••••" />
              </div>
              <Button className="w-full" onClick={() => setAddOpen(false)}>Add Connector</Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {connectors.map((c) => (
          <FlexCard
            key={c.id}
            action={
              <Button size="sm" variant="outline" onClick={() => testConnection(c.id)} disabled={!!testing}>
                <Wifi className="h-4 w-4 mr-1" />
                {testing === c.id ? 'Testing...' : 'Test'}
              </Button>
            }
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Plug className="h-5 w-5 text-primary" />
                <span className="font-semibold truncate">{c.name}</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">{c.type}</Badge>
                <StatusBadge status={c.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                Last connected: {new Date(c.last_connected).toLocaleString()}
              </p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Link2 className="h-3 w-3" />
                {c.linked_agents} agent{c.linked_agents !== 1 ? 's' : ''} linked
              </div>
            </div>
          </FlexCard>
        ))}
      </div>
    </div>
  )
}
