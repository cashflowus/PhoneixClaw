import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Plus, MoreVertical, Trash2, Database, Loader2, Plug,
  Play, Square, RefreshCw, Server, ChevronRight, ChevronLeft,
} from 'lucide-react'

interface Source {
  id: string
  display_name: string
  source_type: string
  auth_type: string
  connection_status: string
  enabled: boolean
  server_id?: string | null
  server_name?: string | null
  created_at: string
  owner_email?: string | null
  owner_name?: string | null
}

interface GuildInfo {
  guild_id: string
  guild_name: string
  channel_count: number
}

const AUTH_HELP: Record<string, string> = {
  user_token:
    'Use your personal Discord token. Open Discord in browser, press F12, go to Network tab, copy the "Authorization" header.',
  bot: 'Create a bot at discord.com/developers, copy the bot token. Requires admin to invite the bot.',
}

const emptyForm = {
  display_name: '', source_type: 'discord', auth_type: 'user_token', token: '',
  server_id: '', server_name: '',
}

export default function DataSources() {
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ ...emptyForm })
  const [servers, setServers] = useState<GuildInfo[]>([])
  const [discovering, setDiscovering] = useState(false)

  const { data: sources } = useQuery<Source[]>({
    queryKey: ['sources'],
    queryFn: () => axios.get('/api/v1/sources').then((r) => r.data),
    refetchInterval: 10_000,
  })

  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: (payload: object) => axios.post('/api/v1/sources', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sources'] })
      resetDialog()
    },
    onError: () => setError('Failed to create source. Please check your credentials.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/v1/sources/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sources'] }); setError(null) },
    onError: () => setError('Failed to delete source.'),
  })

  const [testResult, setTestResult] = useState<{ id: string; connection_status: string; detail: string } | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      setTestingId(id)
      const res = await axios.post(`/api/v1/sources/${id}/test`)
      return { id, ...res.data }
    },
    onSuccess: (data) => {
      setTestResult(data)
      qc.invalidateQueries({ queryKey: ['sources'] })
      setTestingId(null)
    },
    onError: () => { setTestingId(null); setError('Connection test failed.') },
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => axios.post(`/api/v1/sources/${id}/toggle`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sources'] }); setError(null) },
    onError: () => setError('Failed to toggle source.'),
  })

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(t)
    }
  }, [error])

  const [syncingId, setSyncingId] = useState<string | null>(null)
  const syncChannelsMutation = useMutation({
    mutationFn: async (id: string) => {
      setSyncingId(id)
      const res = await axios.post(`/api/v1/sources/${id}/sync-channels`)
      return { id, channels: res.data }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sources'] })
      qc.invalidateQueries({ queryKey: ['channels'] })
      setSyncingId(null)
      setError(null)
    },
    onError: (err: unknown) => {
      setSyncingId(null)
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Failed to sync channels.')
    },
  })

  const resetDialog = () => {
    setOpen(false)
    setStep(1)
    setForm({ ...emptyForm })
    setServers([])
    setDiscovering(false)
    setError(null)
  }

  const handleDiscoverServers = async () => {
    if (!form.token) return
    setDiscovering(true)
    setError(null)
    try {
      const res = await axios.post('/api/v1/sources/discover-servers', {
        token: form.token,
        auth_type: form.auth_type,
      })
      setServers(res.data.servers || [])
      setStep(2)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to discover servers. Check your token.'
      setError(msg)
    }
    setDiscovering(false)
  }

  function handleSubmit() {
    const credentials: Record<string, string> = {}
    if (form.auth_type === 'bot') credentials.bot_token = form.token
    else credentials.user_token = form.token

    createMutation.mutate({
      source_type: form.source_type,
      display_name: form.display_name,
      auth_type: form.auth_type,
      credentials,
      server_id: form.server_id || null,
      server_name: form.server_name || null,
    })
  }

  const platformIcon = (type: string) => {
    const colors: Record<string, string> = {
      discord: 'bg-indigo-500/10 text-indigo-500',
      twitter: 'bg-sky-500/10 text-sky-500',
      reddit: 'bg-orange-500/10 text-orange-500',
    }
    return colors[type] || 'bg-muted text-muted-foreground'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Connect Discord servers for signal ingestion</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetDialog(); else setOpen(true) }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Source</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Data Source</DialogTitle>
              <DialogDescription>
                {step === 1 ? 'Step 1: Enter your Discord credentials' : 'Step 2: Select a Discord server'}
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-400">
                <span className="flex-1">{error}</span>
              </div>
            )}

            <div className="flex gap-1.5 mb-2">
              {[1, 2].map(s => (
                <div key={s} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`w-full h-1.5 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-muted'}`} />
                  <span className={`text-[10px] ${s === step ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                    {s === 1 ? 'Credentials' : 'Server'}
                  </span>
                </div>
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="ds-name">Display Name</Label>
                  <Input
                    id="ds-name"
                    value={form.display_name}
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                    placeholder="e.g. Trading Alerts Server"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select value={form.source_type} onValueChange={(v) => setForm({ ...form, source_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="discord">Discord</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.source_type === 'discord' && (
                  <>
                    <div className="space-y-2">
                      <Label>Authentication Method</Label>
                      <div className="flex gap-3">
                        {(['user_token', 'bot'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setForm({ ...form, auth_type: t })}
                            className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                              form.auth_type === t
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:border-primary/50'
                            }`}
                          >
                            {t === 'user_token' ? 'User Token' : 'Bot Token'}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">{AUTH_HELP[form.auth_type]}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ds-token">{form.auth_type === 'bot' ? 'Bot Token' : 'User Token'}</Label>
                      <Input
                        id="ds-token"
                        type="password"
                        value={form.token}
                        onChange={(e) => setForm({ ...form, token: e.target.value })}
                        placeholder={form.auth_type === 'bot' ? 'Bot token from Developer Portal' : 'Your Discord user token'}
                        className="font-mono"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 py-2">
                {servers.length > 0 ? (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {servers.map(g => (
                      <button
                        key={g.guild_id}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, server_id: g.guild_id, server_name: g.guild_name }))}
                        className={`w-full flex items-center gap-3 rounded-lg border p-3.5 text-left transition-all ${
                          form.server_id === g.guild_id
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                            : 'border-border hover:border-primary/40 hover:bg-accent/50'
                        }`}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
                          <Server className="h-5 w-5 text-indigo-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{g.guild_name}</p>
                          <p className="text-xs text-muted-foreground">{g.channel_count} channel{g.channel_count !== 1 ? 's' : ''}</p>
                        </div>
                        {form.server_id === g.guild_id && (
                          <Badge variant="default" className="text-[10px]">Selected</Badge>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
                    <Server className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No servers found for this account.</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2">
              {step === 2 && (
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
              )}
              <div className="flex-1" />
              {step === 1 ? (
                <Button
                  onClick={handleDiscoverServers}
                  disabled={!form.display_name || !form.token || discovering}
                >
                  {discovering ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                  {discovering ? 'Discovering...' : 'Next'}
                  {!discovering && <ChevronRight className="ml-1 h-4 w-4" />}
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={!form.server_id || createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  Create Source
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {(!sources || sources.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Database className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No data sources configured</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Click &quot;Add Source&quot; to connect your first signal source.</p>
          </CardContent>
        </Card>
      )}

      {error && !open && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      {testResult && (
        <div
          className={`rounded-lg border p-3 text-sm flex items-center justify-between ${
            testResult.connection_status === 'CONNECTED'
              ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
              : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400'
          }`}
        >
          <span>
            {testResult.connection_status === 'CONNECTED'
              ? `Connected successfully${testResult.detail ? ` (${testResult.detail})` : ''}`
              : `Connection failed: ${testResult.detail}`}
          </span>
          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setTestResult(null)}>Dismiss</Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(sources || []).map((s) => (
          <Card key={s.id} className="group relative">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${platformIcon(s.source_type)}`}>
                      <Database className="h-5 w-5" />
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${
                        s.enabled && s.connection_status === 'CONNECTED'
                          ? 'bg-green-500'
                          : s.enabled && s.connection_status === 'ERROR'
                            ? 'bg-red-500'
                            : s.enabled && s.connection_status === 'CONNECTING'
                              ? 'bg-yellow-500 animate-pulse'
                              : s.enabled
                                ? 'bg-yellow-500'
                                : 'bg-gray-400'
                      }`}
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{s.display_name}</h3>
                    {s.server_name ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Server className="h-3 w-3" /> {s.server_name}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground capitalize">{s.source_type}</p>
                    )}
                    {isAdmin && s.owner_name && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5">{s.owner_name} ({s.owner_email})</p>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => testMutation.mutate(s.id)} disabled={testingId === s.id}>
                      {testingId === s.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plug className="mr-2 h-4 w-4" />}
                      Test Connection
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => syncChannelsMutation.mutate(s.id)} disabled={syncingId === s.id}>
                      {syncingId === s.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      Sync Channels
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleMutation.mutate(s.id)}>
                      {s.enabled ? <><Square className="mr-2 h-4 w-4" /> Stop Ingestion</> : <><Play className="mr-2 h-4 w-4" /> Start Ingestion</>}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => {
                        if (window.confirm(`Delete data source "${s.display_name}"? This will remove all channels and mappings.`))
                          deleteMutation.mutate(s.id)
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Badge variant={s.connection_status === 'CONNECTED' ? 'default' : s.connection_status === 'ERROR' ? 'destructive' : 'secondary'}>
                  {s.connection_status === 'CONNECTING' ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Connecting</> : s.connection_status}
                </Badge>
                <Badge variant={s.enabled ? 'default' : 'outline'} className="text-xs">
                  {s.enabled ? 'Active' : 'Stopped'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
