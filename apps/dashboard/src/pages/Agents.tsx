/**
 * Agents page — manage OpenClaw trading agents.
 * FlexCards for agent overview, 6-step creation wizard, detail panel.
 * M1.11.
 */
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { FlexCard } from '@/components/ui/FlexCard'
import { MetricCard } from '@/components/ui/MetricCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SidePanel } from '@/components/ui/SidePanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AiAssistPopover } from '@/components/AiAssistPopover'
import {
  Bot, Plus, Pause, Play, Trash2, CheckCircle2, Rocket, ChevronLeft, ChevronRight,
  Plug, MessageSquare, Globe, Radio, Activity, Newspaper, Webhook, TrendingUp, Landmark, BarChart3,
  CheckSquare, Square as SquareIcon,
} from 'lucide-react'

interface AgentData {
  id: string
  name: string
  type: string
  status: string
  instance_id: string
  config: Record<string, unknown>
  created_at: string
}

interface AgentStats {
  total: number
  running: number
  paused: number
  backtesting: number
}

const AGENT_TYPES = [
  { value: 'trading', label: 'Trading Agent' },
  { value: 'strategy', label: 'Strategy Agent' },
  { value: 'monitoring', label: 'Monitoring Agent' },
  { value: 'task', label: 'Task Agent' },
]

const AGENT_SKILLS = [
  { id: 'market_data', label: 'Market Data Ingestion', description: 'Real-time price feeds and OHLCV data' },
  { id: 'signal_parsing', label: 'Signal Parsing', description: 'Parse trade signals from text sources' },
  { id: 'order_execution', label: 'Order Execution', description: 'Place and manage orders via broker API' },
  { id: 'risk_management', label: 'Risk Management', description: 'Position sizing and loss limits' },
  { id: 'portfolio_tracking', label: 'Portfolio Tracking', description: 'Track positions and P&L in real time' },
  { id: 'sentiment_analysis', label: 'Sentiment Analysis', description: 'NLP-based market sentiment scoring' },
  { id: 'backtesting', label: 'Backtesting', description: 'Historical strategy performance testing' },
  { id: 'alerting', label: 'Alerting & Notifications', description: 'Push alerts on key events' },
]

const WIZARD_STEPS = ['Basic Info', 'Connectors', 'Instance', 'Skills', 'Risk Config', 'Review'] as const

interface ConnectorInfo {
  id: string
  name: string
  type: string
  status: string
  config: Record<string, unknown>
  is_active: boolean
  last_connected_at: string | null
  error_message: string | null
  created_at: string
}

interface PlatformMeta {
  icon: typeof Plug
  color: string
  bgColor: string
  label: string
  category: 'data' | 'broker'
}

const PLATFORM_META: Record<string, PlatformMeta> = {
  discord:         { icon: MessageSquare, color: 'text-indigo-500',  bgColor: 'bg-indigo-500/10',  label: 'Discord',       category: 'data' },
  reddit:          { icon: Globe,         color: 'text-orange-500',  bgColor: 'bg-orange-500/10',  label: 'Reddit',        category: 'data' },
  twitter:         { icon: Radio,         color: 'text-sky-500',     bgColor: 'bg-sky-500/10',     label: 'Twitter / X',   category: 'data' },
  unusual_whales:  { icon: Activity,      color: 'text-purple-500',  bgColor: 'bg-purple-500/10',  label: 'Unusual Whales', category: 'data' },
  news_api:        { icon: Newspaper,     color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', label: 'News API',      category: 'data' },
  custom_webhook:  { icon: Webhook,       color: 'text-zinc-400',    bgColor: 'bg-zinc-500/10',    label: 'Webhook',       category: 'data' },
  alpaca:          { icon: TrendingUp,    color: 'text-yellow-500',  bgColor: 'bg-yellow-500/10',  label: 'Alpaca',        category: 'broker' },
  ibkr:            { icon: Landmark,      color: 'text-red-500',     bgColor: 'bg-red-500/10',     label: 'IBKR',          category: 'broker' },
  tradier:         { icon: BarChart3,     color: 'text-teal-500',    bgColor: 'bg-teal-500/10',    label: 'Tradier',       category: 'broker' },
}

function getPlatformMeta(type: string): PlatformMeta {
  return PLATFORM_META[type] ?? { icon: Plug, color: 'text-muted-foreground', bgColor: 'bg-muted', label: type, category: 'data' }
}

function connectorSummary(c: ConnectorInfo): string {
  const cfg = c.config || {}
  switch (c.type) {
    case 'discord': {
      const chCount = Array.isArray(cfg.selected_channels) ? (cfg.selected_channels as unknown[]).length : 0
      return cfg.server_name ? `${cfg.server_name} · ${chCount} ch` : `${chCount} channels`
    }
    case 'reddit': {
      const subs = Array.isArray(cfg.subreddits) ? (cfg.subreddits as string[]) : []
      return subs.length ? subs.map((s) => `r/${s}`).slice(0, 3).join(', ') : 'Reddit'
    }
    case 'twitter': {
      const accts = Array.isArray(cfg.accounts) ? (cfg.accounts as string[]) : []
      return accts.length ? accts.map((a) => `@${a}`).slice(0, 3).join(', ') : 'Twitter'
    }
    case 'alpaca': return `${(cfg.mode as string) === 'live' ? 'Live' : 'Paper'} trading`
    case 'ibkr': return `${cfg.host || '127.0.0.1'}:${cfg.port || 7497}`
    case 'tradier': return cfg.sandbox ? 'Sandbox' : 'Production'
    default: return c.type
  }
}

interface WizardFormData {
  name: string
  type: string
  description: string
  connector_ids: string[]
  instance_id: string
  skills: string[]
  max_daily_loss_pct: number
  max_position_pct: number
  stop_loss_pct: number
}

const DEFAULT_FORM: WizardFormData = {
  name: '',
  type: 'trading',
  description: '',
  connector_ids: [],
  instance_id: '',
  skills: [],
  max_daily_loss_pct: 5,
  max_position_pct: 10,
  stop_loss_pct: 2,
}

function AgentCard({ agent, onSelect, onPause, onResume, onDelete, onApprove, onPromote }: {
  agent: AgentData
  onSelect: () => void
  onPause: () => void
  onResume: () => void
  onDelete: () => void
  onApprove: () => void
  onPromote: () => void
}) {
  const config = agent.config as Record<string, unknown>
  return (
    <FlexCard
      className="cursor-pointer hover:border-primary/50 transition-colors"
      action={
        <div className="flex gap-1">
          {agent.status === 'CREATED' && (
            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onApprove() }} title="Approve">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </Button>
          )}
          {agent.status === 'APPROVED' && (
            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onPromote() }} title="Promote to Running">
              <Rocket className="h-4 w-4 text-blue-500" />
            </Button>
          )}
          {agent.status === 'RUNNING' && (
            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onPause() }}>
              <Pause className="h-4 w-4" />
            </Button>
          )}
          {agent.status === 'PAUSED' && (
            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onResume() }}>
              <Play className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onDelete() }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      }
    >
      <div className="space-y-3" onClick={onSelect}>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary shrink-0" />
          <span className="font-semibold truncate">{agent.name}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline">{agent.type}</Badge>
          <StatusBadge status={agent.status} />
        </div>
        {config.data_source ? (
          <p className="text-xs text-muted-foreground truncate">
            Source: {String(config.data_source)}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Created {new Date(agent.created_at).toLocaleDateString()}
        </p>
      </div>
    </FlexCard>
  )
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between mb-6 overflow-x-auto">
      {WIZARD_STEPS.map((label, idx) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors shrink-0 ${
                idx < currentStep
                  ? 'bg-primary border-primary text-primary-foreground'
                  : idx === currentStep
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-muted-foreground/30 text-muted-foreground'
              }`}
            >
              {idx < currentStep ? '✓' : idx + 1}
            </div>
            <span className={`text-xs mt-1 hidden sm:block whitespace-nowrap ${idx === currentStep ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
              {label}
            </span>
          </div>
          {idx < WIZARD_STEPS.length - 1 && (
            <div className={`h-0.5 w-4 sm:w-8 mx-1 mt-[-14px] sm:mt-[-14px] ${idx < currentStep ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function StepBasicInfo({ form, onChange }: { form: WizardFormData; onChange: (f: Partial<WizardFormData>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Name</Label>
        <Input
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. SPY-Discord-Trader"
        />
      </div>
      <div>
        <Label>Type</Label>
        <Select value={form.type} onValueChange={(v) => onChange({ type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {AGENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <AiAssistPopover
        label="Description"
        value={form.description}
        onChange={(v) => onChange({ description: v })}
        placeholder="What does this agent do?"
        multiline
        context={`agent type: ${form.type}`}
      />
    </div>
  )
}

function StepConnectors({ form, onChange, connectors }: {
  form: WizardFormData
  onChange: (f: Partial<WizardFormData>) => void
  connectors: ConnectorInfo[]
}) {
  const toggle = (id: string) => {
    const next = form.connector_ids.includes(id)
      ? form.connector_ids.filter((c) => c !== id)
      : [...form.connector_ids, id]
    onChange({ connector_ids: next })
  }

  const dataSources = connectors.filter((c) => getPlatformMeta(c.type).category === 'data')
  const brokers = connectors.filter((c) => getPlatformMeta(c.type).category === 'broker')

  const renderGroup = (title: string, items: ConnectorInfo[]) => {
    if (items.length === 0) return null
    return (
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
        <div className="space-y-2">
          {items.map((c) => {
            const meta = getPlatformMeta(c.type)
            const Icon = meta.icon
            const selected = form.connector_ids.includes(c.id)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                  selected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:border-primary/40 hover:bg-accent/50'
                }`}
              >
                {selected ? (
                  <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <SquareIcon className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                )}
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.bgColor}`}>
                  <Icon className={`h-4 w-4 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{connectorSummary(c)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={`text-[10px] ${meta.color}`}>{meta.label}</Badge>
                  <StatusBadge status={c.status} />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select the data sources and brokers this agent will use. You can pick multiple.
      </p>
      {connectors.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <Plug className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No connectors configured yet.</p>
          <Link to="/connectors">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1.5" /> Add Connectors
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
          {renderGroup('Data Sources', dataSources)}
          {renderGroup('Brokers', brokers)}
        </div>
      )}
      {form.connector_ids.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {form.connector_ids.length} connector{form.connector_ids.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  )
}

function StepInstance({ form, onChange, instances }: {
  form: WizardFormData
  onChange: (f: Partial<WizardFormData>) => void
  instances: Array<{ id: string; name: string }>
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>OpenClaw Instance</Label>
        <p className="text-sm text-muted-foreground mb-2">Select the OpenClaw instance this agent will connect to.</p>
        <Select value={form.instance_id} onValueChange={(v) => onChange({ instance_id: v })}>
          <SelectTrigger><SelectValue placeholder="Select instance..." /></SelectTrigger>
          <SelectContent>
            {instances.map((inst) => (
              <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {instances.length === 0 && (
        <p className="text-sm text-amber-500">No instances available. Create an instance first.</p>
      )}
    </div>
  )
}

function StepSkills({ form, onChange }: { form: WizardFormData; onChange: (f: Partial<WizardFormData>) => void }) {
  const toggleSkill = (skillId: string) => {
    const next = form.skills.includes(skillId)
      ? form.skills.filter((s) => s !== skillId)
      : [...form.skills, skillId]
    onChange({ skills: next })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Select the capabilities this agent should have.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {AGENT_SKILLS.map((skill) => {
          const checked = form.skills.includes(skill.id)
          return (
            <label
              key={skill.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                checked ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleSkill(skill.id)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
              />
              <div>
                <p className="text-sm font-medium">{skill.label}</p>
                <p className="text-xs text-muted-foreground">{skill.description}</p>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function SliderInput({ label, value, onChange, min, max, step, unit }: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  unit: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-sm font-mono font-medium">{value}{unit}</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 accent-primary"
        />
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v) && v >= min && v <= max) onChange(v)
          }}
          className="w-20"
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

function StepRiskConfig({ form, onChange }: { form: WizardFormData; onChange: (f: Partial<WizardFormData>) => void }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Configure risk management thresholds for this agent.</p>
      <SliderInput
        label="Max Daily Loss"
        value={form.max_daily_loss_pct}
        onChange={(v) => onChange({ max_daily_loss_pct: v })}
        min={0.5}
        max={20}
        step={0.5}
        unit="%"
      />
      <SliderInput
        label="Max Position Size"
        value={form.max_position_pct}
        onChange={(v) => onChange({ max_position_pct: v })}
        min={1}
        max={50}
        step={1}
        unit="%"
      />
      <SliderInput
        label="Stop Loss"
        value={form.stop_loss_pct}
        onChange={(v) => onChange({ stop_loss_pct: v })}
        min={0.25}
        max={10}
        step={0.25}
        unit="%"
      />
    </div>
  )
}

function StepReview({ form, instances, connectors }: {
  form: WizardFormData
  instances: Array<{ id: string; name: string }>
  connectors: ConnectorInfo[]
}) {
  const instanceName = instances.find((i) => i.id === form.instance_id)?.name ?? form.instance_id
  const typeName = AGENT_TYPES.find((t) => t.value === form.type)?.label ?? form.type
  const selectedConnectors = connectors.filter((c) => form.connector_ids.includes(c.id))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Review your agent configuration before creating.</p>

      <div className="rounded-lg border divide-y">
        <div className="p-3">
          <p className="text-xs text-muted-foreground">Name</p>
          <p className="font-medium">{form.name}</p>
        </div>
        <div className="p-3">
          <p className="text-xs text-muted-foreground">Type</p>
          <p className="font-medium">{typeName}</p>
        </div>
        {form.description && (
          <div className="p-3">
            <p className="text-xs text-muted-foreground">Description</p>
            <p className="text-sm">{form.description}</p>
          </div>
        )}
        <div className="p-3">
          <p className="text-xs text-muted-foreground">Connectors</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {selectedConnectors.length === 0 ? (
              <span className="text-sm text-muted-foreground">None selected</span>
            ) : (
              selectedConnectors.map((c) => {
                const meta = getPlatformMeta(c.type)
                return (
                  <Badge key={c.id} variant="secondary" className="gap-1">
                    <span className={meta.color}>●</span> {c.name}
                  </Badge>
                )
              })
            )}
          </div>
        </div>
        <div className="p-3">
          <p className="text-xs text-muted-foreground">Instance</p>
          <p className="font-medium">{instanceName}</p>
        </div>
        <div className="p-3">
          <p className="text-xs text-muted-foreground">Skills</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {form.skills.length === 0 ? (
              <span className="text-sm text-muted-foreground">None selected</span>
            ) : (
              form.skills.map((s) => (
                <Badge key={s} variant="secondary">{AGENT_SKILLS.find((sk) => sk.id === s)?.label ?? s}</Badge>
              ))
            )}
          </div>
        </div>
        <div className="p-3">
          <p className="text-xs text-muted-foreground">Risk Configuration</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-1">
            <div>
              <p className="text-xs text-muted-foreground">Max Daily Loss</p>
              <p className="font-mono font-medium">{form.max_daily_loss_pct}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Max Position</p>
              <p className="font-mono font-medium">{form.max_position_pct}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Stop Loss</p>
              <p className="font-mono font-medium">{form.stop_loss_pct}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AgentsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<AgentData | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(0)
  const [form, setForm] = useState<WizardFormData>({ ...DEFAULT_FORM })

  const updateForm = useCallback((partial: Partial<WizardFormData>) => {
    setForm((prev) => ({ ...prev, ...partial }))
  }, [])

  const resetWizard = useCallback(() => {
    setWizardStep(0)
    setForm({ ...DEFAULT_FORM })
  }, [])

  const { data: agents = [], isLoading } = useQuery<AgentData[]>({
    queryKey: ['agents'],
    queryFn: async () => (await api.get('/api/v2/agents')).data,
    refetchInterval: 10000,
  })

  const { data: stats } = useQuery<AgentStats>({
    queryKey: ['agent-stats'],
    queryFn: async () => (await api.get('/api/v2/agents/stats')).data,
    refetchInterval: 15000,
  })

  const { data: instances = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['instances'],
    queryFn: async () => (await api.get('/api/v2/instances')).data,
  })

  const { data: connectors = [] } = useQuery<ConnectorInfo[]>({
    queryKey: ['connectors'],
    queryFn: async () => (await api.get('/api/v2/connectors')).data,
  })

  const invalidateAgents = () => {
    queryClient.invalidateQueries({ queryKey: ['agents'] })
    queryClient.invalidateQueries({ queryKey: ['agent-stats'] })
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        type: form.type,
        instance_id: form.instance_id,
        description: form.description,
        skills: form.skills,
        connector_ids: form.connector_ids,
        config: {
          max_daily_loss_pct: form.max_daily_loss_pct,
          max_position_pct: form.max_position_pct,
          stop_loss_pct: form.stop_loss_pct,
        },
      }
      await api.post('/api/v2/agents', payload)
    },
    onSuccess: () => {
      invalidateAgents()
      setCreateOpen(false)
      resetWizard()
    },
  })

  const pauseMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/api/v2/agents/${id}/pause`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  })

  const resumeMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/api/v2/agents/${id}/resume`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  })

  const approveMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/api/v2/agents/${id}/approve`),
    onSuccess: invalidateAgents,
  })

  const promoteMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/api/v2/agents/${id}/promote`),
    onSuccess: invalidateAgents,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/v2/agents/${id}`),
    onSuccess: invalidateAgents,
  })

  const canAdvance = (step: number): boolean => {
    switch (step) {
      case 0: return form.name.trim().length > 0
      case 1: return form.connector_ids.length > 0
      case 2: return form.instance_id.length > 0
      case 3: return true // skills are optional
      case 4: return true // risk config has defaults
      case 5: return true // review
      default: return false
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <PageHeader icon={Bot} title="Agents" description="Manage OpenClaw trading and monitoring agents" />
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open)
            if (!open) resetWizard()
          }}
        >
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New Agent</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl w-[calc(100vw-2rem)] sm:w-full">
            <DialogHeader>
              <DialogTitle>Create Agent</DialogTitle>
            </DialogHeader>

            <StepIndicator currentStep={wizardStep} />

            <div className="min-h-[280px]">
              {wizardStep === 0 && <StepBasicInfo form={form} onChange={updateForm} />}
              {wizardStep === 1 && <StepConnectors form={form} onChange={updateForm} connectors={connectors} />}
              {wizardStep === 2 && <StepInstance form={form} onChange={updateForm} instances={instances} />}
              {wizardStep === 3 && <StepSkills form={form} onChange={updateForm} />}
              {wizardStep === 4 && <StepRiskConfig form={form} onChange={updateForm} />}
              {wizardStep === 5 && <StepReview form={form} instances={instances} connectors={connectors} />}
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setWizardStep((s) => s - 1)}
                disabled={wizardStep === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>

              {wizardStep < WIZARD_STEPS.length - 1 ? (
                <Button
                  onClick={() => setWizardStep((s) => s + 1)}
                  disabled={!canAdvance(wizardStep)}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!canAdvance(wizardStep) || createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Agent'}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard title="Total Agents" value={stats.total} />
          <MetricCard title="Running" value={stats.running} trend="up" />
          <MetricCard title="Paused" value={stats.paused} trend="neutral" />
          <MetricCard title="Backtesting" value={stats.backtesting} />
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-lg border animate-pulse bg-muted" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No agents yet</p>
          <p className="text-sm">Create your first agent to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onSelect={() => navigate(`/agents/${agent.id}`)}
              onPause={() => pauseMutation.mutate(agent.id)}
              onResume={() => resumeMutation.mutate(agent.id)}
              onApprove={() => approveMutation.mutate(agent.id)}
              onPromote={() => promoteMutation.mutate(agent.id)}
              onDelete={() => deleteMutation.mutate(agent.id)}
            />
          ))}
        </div>
      )}

      <SidePanel
        open={!!selected}
        onOpenChange={() => setSelected(null)}
        title={selected?.name ?? ''}
        description={`${selected?.type} agent`}
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={selected.status} />
              <span className="text-muted-foreground">Type</span>
              <span className="capitalize">{selected.type}</span>
              <span className="text-muted-foreground">Instance</span>
              <span className="font-mono text-xs">{selected.instance_id.slice(0, 8)}...</span>
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(selected.created_at).toLocaleString()}</span>
            </div>

            {selected.status === 'CREATED' && (
              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  approveMutation.mutate(selected.id)
                  setSelected({ ...selected, status: 'APPROVED' })
                }}
                disabled={approveMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {approveMutation.isPending ? 'Approving...' : 'Approve Agent'}
              </Button>
            )}

            {selected.status === 'APPROVED' && (
              <Button
                className="w-full"
                onClick={() => {
                  promoteMutation.mutate(selected.id)
                  setSelected({ ...selected, status: 'RUNNING' })
                }}
                disabled={promoteMutation.isPending}
              >
                <Rocket className="h-4 w-4 mr-2" />
                {promoteMutation.isPending ? 'Promoting...' : 'Promote to Running'}
              </Button>
            )}

            {selected.config && Object.keys(selected.config).length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Configuration</p>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-60">
                  {JSON.stringify(selected.config, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </SidePanel>
    </div>
  )
}
