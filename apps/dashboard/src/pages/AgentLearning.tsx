/**
 * Agent Learning page — configure agents that learn trading behavior
 * from YouTube channels, Discord channels, or trade logs.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { FlexCard } from '@/components/ui/FlexCard'
import { MetricCard } from '@/components/ui/MetricCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SidePanel } from '@/components/ui/SidePanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Brain, Youtube, MessageCircle, Upload, Play, Settings } from 'lucide-react'

interface BehaviorProfile {
  risk_tolerance: string
  preferred_instruments: string[]
  trading_style: string
  entry_patterns: string[]
  exit_patterns: string[]
  time_of_day: string
  position_sizing: string
}

interface LearningSession {
  id: string
  agent_name: string
  source_type: 'youtube_channel' | 'youtube_playlist' | 'discord_channel' | 'trade_log'
  source_url: string
  status: 'INGESTING' | 'ANALYZING' | 'BUILDING_MEMORY' | 'READY' | 'TRAINING' | 'DEPLOYED'
  progress: number
  target_role: string
  learning_depth: string
  auto_deploy: boolean
  behavior_profile: BehaviorProfile | null
  key_concepts: string[]
  created_at: string
}

const SOURCE_TYPES = [
  { value: 'youtube_channel', label: 'YouTube Channel' },
  { value: 'youtube_playlist', label: 'YouTube Playlist' },
  { value: 'discord_channel', label: 'Discord Channel' },
  { value: 'trade_log', label: 'Trade Log CSV' },
]

const TARGET_ROLES = [
  { value: 'day_trader', label: 'Day Trader' },
  { value: 'swing_trader', label: 'Swing Trader' },
  { value: 'options_specialist', label: 'Options Specialist' },
  { value: 'scalper', label: 'Scalper' },
]

const LEARNING_DEPTHS = [
  { value: 'quick', label: 'Quick Profile' },
  { value: 'standard', label: 'Standard' },
  { value: 'deep', label: 'Deep Analysis' },
]

const STATUS_COLORS: Record<string, string> = {
  INGESTING: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  ANALYZING: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  BUILDING_MEMORY: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  READY: 'bg-green-500/15 text-green-700 dark:text-green-400',
  TRAINING: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  DEPLOYED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
}

const SOURCE_ICON: Record<string, typeof Youtube> = {
  youtube_channel: Youtube,
  youtube_playlist: Youtube,
  discord_channel: MessageCircle,
  trade_log: Upload,
}

const MOCK_SESSIONS: LearningSession[] = [
  {
    id: 'ls-001',
    agent_name: 'SMB-Momentum-Learner',
    source_type: 'youtube_channel',
    source_url: 'https://youtube.com/@SMBCapital',
    status: 'READY',
    progress: 100,
    target_role: 'day_trader',
    learning_depth: 'deep',
    auto_deploy: false,
    behavior_profile: {
      risk_tolerance: 'Moderate — 1-2% per trade',
      preferred_instruments: ['SPY', 'QQQ', 'Large-cap momentum stocks'],
      trading_style: 'Intraday momentum with strict risk management',
      entry_patterns: ['Opening range breakout', 'VWAP reclaim', 'Relative strength confirmation'],
      exit_patterns: ['Trailing stop at 20 EMA', 'Time-based exit at 3:30 PM', 'Target 2:1 R:R'],
      time_of_day: '9:30 AM – 11:30 AM, 2:00 PM – 4:00 PM',
      position_sizing: 'Fixed fractional — 1% risk per trade, scale in up to 3 entries',
    },
    key_concepts: ['Tape reading', 'Level 2 analysis', 'Risk-first approach', 'Sector rotation', 'VWAP anchoring'],
    created_at: '2026-02-28T14:00:00Z',
  },
  {
    id: 'ls-002',
    agent_name: 'Discord-Swing-Analyzer',
    source_type: 'discord_channel',
    source_url: 'discord://guild/123456/channel/789012',
    status: 'ANALYZING',
    progress: 47,
    target_role: 'swing_trader',
    learning_depth: 'standard',
    auto_deploy: true,
    behavior_profile: null,
    key_concepts: ['Earnings plays', 'Technical breakouts'],
    created_at: '2026-03-01T09:30:00Z',
  },
]

function SessionStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function SessionCard({ session, onSelect }: { session: LearningSession; onSelect: () => void }) {
  const Icon = SOURCE_ICON[session.source_type] ?? Brain
  return (
    <FlexCard className="cursor-pointer hover:border-primary/50 transition-colors">
      <div className="space-y-3" onClick={onSelect}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <span className="font-semibold">{session.agent_name}</span>
          </div>
          <SessionStatusBadge status={session.status} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="capitalize">{session.source_type.replace(/_/g, ' ')}</Badge>
          <Badge variant="outline" className="capitalize">{session.target_role.replace(/_/g, ' ')}</Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{session.source_url}</p>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{session.progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${session.progress}%` }}
            />
          </div>
        </div>
        {session.behavior_profile && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {session.behavior_profile.trading_style}
          </p>
        )}
      </div>
    </FlexCard>
  )
}

export default function AgentLearningPage() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<LearningSession | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    agent_name: '',
    source_type: 'youtube_channel',
    source_url: '',
    target_role: 'day_trader',
    learning_depth: 'standard',
    auto_deploy: false,
  })

  const { data: sessions = MOCK_SESSIONS, isLoading } = useQuery<LearningSession[]>({
    queryKey: ['agent-learning-sessions'],
    queryFn: async () => (await api.get('/api/v2/agent-learning/sessions')).data,
    refetchInterval: 10000,
    placeholderData: MOCK_SESSIONS,
  })

  const createMutation = useMutation({
    mutationFn: async () => api.post('/api/v2/agent-learning/sessions', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-learning-sessions'] })
      setCreateOpen(false)
      setForm({ agent_name: '', source_type: 'youtube_channel', source_url: '', target_role: 'day_trader', learning_depth: 'standard', auto_deploy: false })
    },
  })

  const deployMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/api/v2/agent-learning/sessions/${id}/deploy`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-learning-sessions'] })
      setSelected(null)
    },
  })

  const stats = {
    total: sessions.length,
    ready: sessions.filter((s) => s.status === 'READY').length,
    training: sessions.filter((s) => ['INGESTING', 'ANALYZING', 'BUILDING_MEMORY', 'TRAINING'].includes(s.status)).length,
    deployed: sessions.filter((s) => s.status === 'DEPLOYED').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Agent Learning</h2>
          <p className="text-muted-foreground">Train agents from YouTube, Discord, or trade logs</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Brain className="h-4 w-4 mr-2" /> Create Learning Session</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Learning Session</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Agent Name</Label>
                <Input value={form.agent_name} onChange={(e) => setForm({ ...form, agent_name: e.target.value })} placeholder="e.g. SMB-Momentum-Learner" />
              </div>
              <div>
                <Label>Source Type</Label>
                <Select value={form.source_type} onValueChange={(v) => setForm({ ...form, source_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Source URL / ID</Label>
                <Input value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} placeholder="https://youtube.com/@ChannelName or discord://..." />
              </div>
              <div>
                <Label>Target Agent Role</Label>
                <Select value={form.target_role} onValueChange={(v) => setForm({ ...form, target_role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TARGET_ROLES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Learning Depth</Label>
                <Select value={form.learning_depth} onValueChange={(v) => setForm({ ...form, learning_depth: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEARNING_DEPTHS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.auto_deploy} onCheckedChange={(v) => setForm({ ...form, auto_deploy: v })} />
                <Label>Auto-deploy when training completes</Label>
              </div>
              <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!form.agent_name || !form.source_url || createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Start Learning Session'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Total Sessions" value={stats.total} />
        <MetricCard title="Ready" value={stats.ready} trend="up" />
        <MetricCard title="Training" value={stats.training} trend="neutral" />
        <MetricCard title="Deployed" value={stats.deployed} trend="up" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-48 rounded-lg border animate-pulse bg-muted" />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No learning sessions yet</p>
          <p className="text-sm">Create your first session to start training an agent</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((s) => <SessionCard key={s.id} session={s} onSelect={() => setSelected(s)} />)}
        </div>
      )}

      <SidePanel open={!!selected} onOpenChange={() => setSelected(null)} title={selected?.agent_name ?? ''} description="Behavior learning session">
        {selected && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Status</span>
              <SessionStatusBadge status={selected.status} />
              <span className="text-muted-foreground">Source</span>
              <span className="capitalize">{selected.source_type.replace(/_/g, ' ')}</span>
              <span className="text-muted-foreground">Role</span>
              <span className="capitalize">{selected.target_role.replace(/_/g, ' ')}</span>
              <span className="text-muted-foreground">Depth</span>
              <span className="capitalize">{selected.learning_depth}</span>
              <span className="text-muted-foreground">Auto-deploy</span>
              <span>{selected.auto_deploy ? 'Yes' : 'No'}</span>
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(selected.created_at).toLocaleString()}</span>
            </div>

            {selected.behavior_profile && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Behavior Profile</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs">Risk Tolerance</span>
                    <span>{selected.behavior_profile.risk_tolerance}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Preferred Instruments</span>
                    <div className="flex gap-1 flex-wrap mt-0.5">
                      {selected.behavior_profile.preferred_instruments.map((i) => <Badge key={i} variant="secondary" className="text-xs">{i}</Badge>)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Trading Style</span>
                    <span>{selected.behavior_profile.trading_style}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Entry Patterns</span>
                    <ul className="list-disc list-inside text-xs mt-0.5">
                      {selected.behavior_profile.entry_patterns.map((p) => <li key={p}>{p}</li>)}
                    </ul>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Exit Patterns</span>
                    <ul className="list-disc list-inside text-xs mt-0.5">
                      {selected.behavior_profile.exit_patterns.map((p) => <li key={p}>{p}</li>)}
                    </ul>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Time of Day</span>
                    <span>{selected.behavior_profile.time_of_day}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Position Sizing</span>
                    <span>{selected.behavior_profile.position_sizing}</span>
                  </div>
                </div>
              </div>
            )}

            {selected.key_concepts.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Key Concepts</h4>
                <div className="flex gap-1 flex-wrap">
                  {selected.key_concepts.map((c) => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {selected.status === 'READY' && (
                <Button onClick={() => deployMutation.mutate(selected.id)} disabled={deployMutation.isPending} className="flex-1">
                  <Play className="h-4 w-4 mr-2" />
                  {deployMutation.isPending ? 'Deploying...' : 'Deploy as Agent'}
                </Button>
              )}
              <Button variant="outline" className="flex-1">
                <Settings className="h-4 w-4 mr-2" /> Export Profile
              </Button>
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  )
}
