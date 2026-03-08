/**
 * Network / Infrastructure page.
 * - Grid of OpenClaw instance cards with live health status.
 * - Click an instance to open a full detail dashboard: system health,
 *   agent list, chat, and activity feed panels.
 * - Connection guide for VPS and local deployments.
 * - All colors are theme-aware (light + dark).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Server, Plus, Pencil, Trash2, Wifi, Activity, Clock, Bot,
  RefreshCw, CheckCircle2, XCircle, AlertTriangle, Copy,
  Globe, Monitor, HardDrive, Network, BookOpen, Cpu,
  Loader2, Check, ArrowLeft, Send, MessageSquare, ScrollText,
  Play, Pause, ChevronDown, ChevronUp, Zap, Timer,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Instance {
  id: string
  name: string
  host: string
  port: number
  role: string
  status: string
  node_type: string
  capabilities: Record<string, unknown>
  last_heartbeat_at: string | null
  created_at: string
  agent_count?: number
}

interface Agent {
  id: string
  name: string
  type: string
  status: string
  instance_id: string
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface AgentLog {
  id: string
  agent_id: string
  level: string
  message: string
  context: Record<string, unknown>
  created_at: string
}

interface AgentMessage {
  id: string
  from_agent_id: string
  to_agent_id: string | null
  intent: string
  body: string | null
  data: Record<string, unknown>
  status: string
  created_at: string
}

interface InstanceFormData {
  name: string
  host: string
  port: number
  role: string
  node_type: string
}

interface VerifyResult {
  reachable: boolean
  is_openclaw: boolean
  detail: string
  metadata: Record<string, unknown>
}

const ROLES = ['general', 'strategy-lab', 'data-research', 'risk-promote', 'live-trading']
const EMPTY_FORM: InstanceFormData = { name: '', host: '', port: 18800, role: 'general', node_type: 'vps' }

// ─── Helpers ───────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function uptimeStr(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  if (d > 0) return `${d}d ${h}h`
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function statusConfig(status: string) {
  const s = status.toUpperCase()
  if (['RUNNING', 'ONLINE'].includes(s)) return {
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-500',
    label: 'Online',
    icon: CheckCircle2,
  }
  if (['IDLE', 'DEGRADED'].includes(s)) return {
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    dot: 'bg-amber-500',
    label: 'Degraded',
    icon: AlertTriangle,
  }
  if (['ERROR', 'OFFLINE'].includes(s)) return {
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    dot: 'bg-red-500',
    label: 'Offline',
    icon: XCircle,
  }
  return {
    color: 'text-zinc-600 dark:text-zinc-400',
    bg: 'bg-zinc-500/10',
    border: 'border-zinc-500/30',
    dot: 'bg-zinc-500',
    label: 'Unknown',
    icon: AlertTriangle,
  }
}

function roleLabel(role: string) {
  return role.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function nodeTypeLabel(type: string) {
  return type === 'vps' ? 'Cloud VPS' : 'Local Machine'
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

// ─── Instance Card ─────────────────────────────────────────────────────────

function InstanceCard({
  instance,
  onEdit,
  onDelete,
  onHealthCheck,
  onClick,
  isChecking,
}: {
  instance: Instance
  onEdit: () => void
  onDelete: () => void
  onHealthCheck: () => void
  onClick: () => void
  isChecking: boolean
}) {
  const sc = statusConfig(instance.status)
  const agents = instance.agent_count ?? 0
  const hb = instance.capabilities?.last_heartbeat as Record<string, unknown> | undefined
  const cpuPercent = hb?.cpu_percent as number | undefined
  const memMb = hb?.memory_usage_mb as number | undefined

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-xl border bg-card ${sc.border} p-5 transition-all hover:shadow-lg cursor-pointer hover:border-primary/40`}
    >
      <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${sc.dot}`} />

      <div className="flex items-start justify-between mb-4 mt-1">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${sc.bg} border ${sc.border}`}>
            <Server className={`h-5 w-5 ${sc.color}`} />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">{instance.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground font-mono">
                {instance.host}:{instance.port}
              </span>
              <CopyButton text={`${instance.host}:${instance.port}`} />
            </div>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.color} border ${sc.border}`}>
          <span className={`w-2 h-2 rounded-full ${sc.dot} ${['RUNNING', 'ONLINE'].includes(instance.status.toUpperCase()) ? 'animate-pulse' : ''}`} />
          {sc.label}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg bg-muted/50 border border-border p-3 text-center">
          <Bot className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-lg font-bold text-foreground">{agents}</p>
          <p className="text-[10px] text-muted-foreground">Agents</p>
        </div>
        <div className="rounded-lg bg-muted/50 border border-border p-3 text-center">
          <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-sm font-semibold mt-0.5 text-foreground">{timeAgo(instance.last_heartbeat_at)}</p>
          <p className="text-[10px] text-muted-foreground">Heartbeat</p>
        </div>
        <div className="rounded-lg bg-muted/50 border border-border p-3 text-center">
          {instance.node_type === 'vps'
            ? <Globe className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            : <Monitor className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          }
          <p className="text-sm font-semibold mt-0.5 text-foreground">{nodeTypeLabel(instance.node_type)}</p>
          <p className="text-[10px] text-muted-foreground">Type</p>
        </div>
      </div>

      {(cpuPercent != null || memMb != null) && (
        <div className="flex gap-3 mb-4">
          {cpuPercent != null && (
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground flex items-center gap-1"><Cpu className="h-3 w-3" /> CPU</span>
                <span className="font-medium text-foreground">{cpuPercent.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${cpuPercent > 80 ? 'bg-red-500' : cpuPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(cpuPercent, 100)}%` }}
                />
              </div>
            </div>
          )}
          {memMb != null && (
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground flex items-center gap-1"><HardDrive className="h-3 w-3" /> Mem</span>
                <span className="font-medium text-foreground">{memMb.toFixed(0)} MB</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min((memMb / 2048) * 100, 100)}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground capitalize">{roleLabel(instance.role)}</span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Check health" disabled={isChecking} onClick={onHealthCheck}>
            {isChecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" title="Delete" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Instance Dialog ───────────────────────────────────────────────────

function AddInstanceDialog({
  open, onOpenChange, initial, onSubmit, title,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; initial: InstanceFormData; onSubmit: (data: InstanceFormData) => Promise<void>; title: string
}) {
  const [form, setForm] = useState<InstanceFormData>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)

  useEffect(() => { if (open) { setForm(initial); setError(''); setVerifyResult(null) } }, [open, initial])

  const handleVerify = async () => {
    if (!form.host.trim()) { setError('Host is required to verify'); return }
    setVerifying(true); setVerifyResult(null); setError('')
    try {
      const res = await api.post('/api/v2/instances/verify', { host: form.host, port: form.port })
      setVerifyResult(res.data)
    } catch {
      setVerifyResult({ reachable: false, is_openclaw: false, detail: 'Verification request failed', metadata: {} })
    } finally { setVerifying(false) }
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.host.trim()) { setError('Name and Host are required.'); return }
    setSaving(true); setError('')
    try { await onSubmit(form); onOpenChange(false) } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed') } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Connect an OpenClaw runtime instance running on your VPS or local machine.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="inst-name">Instance Name</Label>
            <Input id="inst-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g., prod-trading-1" />
          </div>
          <div className="space-y-1.5">
            <Label>Connection</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input value={form.host} onChange={(e) => { setForm((f) => ({ ...f, host: e.target.value })); setVerifyResult(null) }} placeholder="IP or hostname" />
              </div>
              <div className="w-24">
                <Input type="number" value={form.port} onChange={(e) => { setForm((f) => ({ ...f, port: Number(e.target.value) || 18800 })); setVerifyResult(null) }} />
              </div>
              <Button variant="outline" size="sm" className="shrink-0" onClick={handleVerify} disabled={verifying || !form.host.trim()}>
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                <span className="ml-1.5">Verify</span>
              </Button>
            </div>
          </div>
          {verifyResult && (
            <div className={`rounded-lg border p-3 text-sm ${
              verifyResult.is_openclaw ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : verifyResult.reachable ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400'
            }`}>
              <div className="flex items-center gap-2">
                {verifyResult.is_openclaw ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : verifyResult.reachable ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                <span className="font-medium">
                  {verifyResult.is_openclaw ? 'OpenClaw instance detected!' : verifyResult.reachable ? 'Host reachable but not confirmed as OpenClaw' : 'Cannot reach host'}
                </span>
              </div>
              <p className="text-xs mt-1 opacity-80">{verifyResult.detail}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}><span className="capitalize">{r.replace('-', ' ')}</span></SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Node Type</Label>
              <Select value={form.node_type} onValueChange={(v) => setForm((f) => ({ ...f, node_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vps">Cloud VPS</SelectItem>
                  <SelectItem value="local">Local Machine</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Connecting...</> : <><Plus className="h-4 w-4 mr-1.5" /> Add Instance</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Connection Guide ──────────────────────────────────────────────────────

function ConnectionGuide() {
  const [expandedTab, setExpandedTab] = useState<'vps' | 'local'>('vps')

  const CodeBlock = ({ code, title }: { code: string; title?: string }) => (
    <div className="rounded-lg border border-border bg-muted overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/80">
          <span className="text-[11px] text-muted-foreground font-medium">{title}</span>
          <CopyButton text={code} />
        </div>
      )}
      <pre className="px-3 py-2 text-xs font-mono text-emerald-700 dark:text-emerald-400 overflow-x-auto whitespace-pre">{code}</pre>
    </div>
  )

  const StepCircle = ({ n }: { n: number }) => (
    <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary shrink-0">{n}</div>
  )
  const StepLine = () => <div className="w-px flex-1 bg-border mt-2" />
  const DoneCircle = () => (
    <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20"><BookOpen className="h-5 w-5 text-primary" /></div>
        <div>
          <h3 className="text-base font-semibold text-foreground">How to Connect OpenClaw Instances</h3>
          <p className="text-xs text-muted-foreground">Step-by-step guide for VPS and local deployments</p>
        </div>
      </div>

      <Tabs value={expandedTab} onValueChange={(v) => setExpandedTab(v as 'vps' | 'local')}>
        <TabsList className="w-full">
          <TabsTrigger value="vps" className="flex-1 gap-2"><Globe className="h-4 w-4" /> Cloud VPS</TabsTrigger>
          <TabsTrigger value="local" className="flex-1 gap-2"><Monitor className="h-4 w-4" /> Local Machine</TabsTrigger>
        </TabsList>

        <TabsContent value="vps" className="space-y-4 mt-4">
          <div className="flex gap-4"><div className="flex flex-col items-center"><StepCircle n={1} /><StepLine /></div>
            <div className="flex-1 pb-6"><h4 className="font-medium text-sm text-foreground mb-1">SSH into your VPS</h4><p className="text-xs text-muted-foreground mb-3">Connect to your server using SSH. Make sure Docker is installed.</p><CodeBlock code="ssh root@your-vps-ip" title="Terminal" /></div></div>
          <div className="flex gap-4"><div className="flex flex-col items-center"><StepCircle n={2} /><StepLine /></div>
            <div className="flex-1 pb-6"><h4 className="font-medium text-sm text-foreground mb-1">Install Docker (if not already installed)</h4><p className="text-xs text-muted-foreground mb-3">OpenClaw runs as a Docker container. If you&apos;re using Hostinger VPS, Docker is pre-installed via the Docker Manager.</p><CodeBlock code={`# Ubuntu/Debian\ncurl -fsSL https://get.docker.com | sh\nsudo usermod -aG docker $USER\n\n# Or use your VPS provider's Docker manager (Hostinger, DigitalOcean, etc.)`} title="Terminal" /></div></div>
          <div className="flex gap-4"><div className="flex flex-col items-center"><StepCircle n={3} /><StepLine /></div>
            <div className="flex-1 pb-6"><h4 className="font-medium text-sm text-foreground mb-1">Deploy the OpenClaw container</h4><p className="text-xs text-muted-foreground mb-3">Pull and run the OpenClaw Docker image. The default port is 18800.</p><CodeBlock code={`# Using Docker Compose (recommended)\nmkdir openclaw && cd openclaw\n\ncat > docker-compose.yml << 'EOF'\nversion: '3.8'\nservices:\n  openclaw:\n    image: openclaw/runtime:latest\n    container_name: openclaw-node\n    ports:\n      - "18800:18800"\n    environment:\n      - OPENCLAW_NODE_NAME=my-vps-node\n      - OPENCLAW_API_KEY=\${OPENCLAW_API_KEY}\n    volumes:\n      - openclaw_data:/data\n    restart: unless-stopped\n    healthcheck:\n      test: ["CMD", "curl", "-f", "http://localhost:18800/health"]\n      interval: 30s\n      timeout: 10s\n      retries: 3\n\nvolumes:\n  openclaw_data:\nEOF\n\ndocker compose up -d`} title="docker-compose.yml" /></div></div>
          <div className="flex gap-4"><div className="flex flex-col items-center"><StepCircle n={4} /><StepLine /></div>
            <div className="flex-1 pb-6"><h4 className="font-medium text-sm text-foreground mb-1">Open firewall port</h4><p className="text-xs text-muted-foreground mb-3">Ensure port 18800 is accessible from this dashboard&apos;s server.</p><CodeBlock code={`# UFW (Ubuntu)\nsudo ufw allow 18800/tcp\n\n# Or configure via your VPS provider's firewall panel\n# Hostinger: VPS → Firewall → Add rule → Port 18800 TCP`} title="Terminal" /></div></div>
          <div className="flex gap-4"><div className="flex flex-col items-center"><DoneCircle /></div>
            <div className="flex-1"><h4 className="font-medium text-sm text-foreground mb-1">Add the instance in Phoenix Claw</h4><p className="text-xs text-muted-foreground mb-3">Click &quot;Add Instance&quot; above, enter your VPS IP address and port 18800. Use the &quot;Verify&quot; button to confirm connectivity before saving.</p>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400"><strong>Tip:</strong> The verify button will ping the health endpoint to confirm it&apos;s a real OpenClaw instance before you add it.</div></div></div>
        </TabsContent>

        <TabsContent value="local" className="space-y-4 mt-4">
          <div className="flex gap-4"><div className="flex flex-col items-center"><StepCircle n={1} /><StepLine /></div>
            <div className="flex-1 pb-6"><h4 className="font-medium text-sm text-foreground mb-1">Install Docker Desktop</h4><p className="text-xs text-muted-foreground mb-3">Download and install Docker Desktop for your OS.</p><CodeBlock code={`# macOS (using Homebrew)\nbrew install --cask docker\n\n# Windows: Download from https://docker.com/products/docker-desktop\n# Linux: curl -fsSL https://get.docker.com | sh`} title="Terminal" /></div></div>
          <div className="flex gap-4"><div className="flex flex-col items-center"><StepCircle n={2} /><StepLine /></div>
            <div className="flex-1 pb-6"><h4 className="font-medium text-sm text-foreground mb-1">Run OpenClaw locally</h4><p className="text-xs text-muted-foreground mb-3">Start the OpenClaw runtime on your machine.</p><CodeBlock code={`docker run -d \\\\\n  --name openclaw-local \\\\\n  -p 18800:18800 \\\\\n  -e OPENCLAW_NODE_NAME=my-local-node \\\\\n  -v openclaw_data:/data \\\\\n  --restart unless-stopped \\\\\n  openclaw/runtime:latest`} title="Terminal" /></div></div>
          <div className="flex gap-4"><div className="flex flex-col items-center"><StepCircle n={3} /><StepLine /></div>
            <div className="flex-1 pb-6"><h4 className="font-medium text-sm text-foreground mb-1">Verify it&apos;s running</h4><p className="text-xs text-muted-foreground mb-3">Check that the health endpoint responds.</p><CodeBlock code={`curl http://localhost:18800/health\n# Expected: {"status":"ok","version":"x.x.x"}`} title="Terminal" /></div></div>
          <div className="flex gap-4"><div className="flex flex-col items-center"><StepCircle n={4} /><StepLine /></div>
            <div className="flex-1 pb-6"><h4 className="font-medium text-sm text-foreground mb-1">Expose for remote access (optional)</h4><p className="text-xs text-muted-foreground mb-3">If your dashboard runs on a different machine, you need to expose the port or use a tunnel.</p><CodeBlock code={`# Option A: Use your local IP (same network)\n# Find IP: ifconfig | grep inet  (macOS/Linux)\n# Then add instance with your-local-ip:18800\n\n# Option B: Use ngrok for remote access\nngrok http 18800\n# Use the ngrok URL as the host`} title="Terminal" /></div></div>
          <div className="flex gap-4"><div className="flex flex-col items-center"><DoneCircle /></div>
            <div className="flex-1"><h4 className="font-medium text-sm text-foreground mb-1">Add instance in Phoenix Claw</h4><p className="text-xs text-muted-foreground mb-3">Click &quot;Add Instance,&quot; use <code className="px-1 py-0.5 bg-muted rounded text-[11px]">localhost</code> or your local IP, port 18800. Select &quot;Local Machine&quot; as node type.</p>
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-700 dark:text-blue-400"><strong>Note:</strong> For local instances, make sure the Phoenix API server can reach the OpenClaw port. If both run on the same machine, <code className="px-1 py-0.5 bg-muted rounded">localhost</code> works. Otherwise, use your machine&apos;s LAN IP.</div></div></div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Empty State ───────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
        <Server className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">No instances connected</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
        Connect your first OpenClaw runtime instance to start deploying and managing trading agents.
      </p>
      <Button onClick={onAdd}><Plus className="h-4 w-4 mr-2" /> Add Your First Instance</Button>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// INSTANCE DETAIL VIEW — full dashboard when clicking an instance card
// ════════════════════════════════════════════════════════════════════════════

function InstanceDetailView({ instance, onBack }: { instance: Instance; onBack: () => void }) {
  const qc = useQueryClient()
  const sc = statusConfig(instance.status)
  const hb = instance.capabilities?.last_heartbeat as Record<string, unknown> | undefined
  const cpuPercent = (hb?.cpu_percent as number) ?? null
  const memMb = (hb?.memory_usage_mb as number) ?? null
  const activeTasks = (hb?.active_tasks as number) ?? 0
  const totalPnl = (hb?.total_pnl as number) ?? 0
  const agentStatuses = (hb?.agents as Array<Record<string, unknown>>) ?? []

  // ── Fetch agents assigned to this instance ──
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents', 'instance', instance.id],
    queryFn: async () => {
      const res = await api.get('/api/v2/agents', { params: { instance_id: instance.id } })
      return res.data
    },
    refetchInterval: 15000,
  })

  // ── Health check ──
  const [checking, setChecking] = useState(false)
  const handleCheck = async () => {
    setChecking(true)
    try {
      await api.post(`/api/v2/instances/${instance.id}/check`)
      qc.invalidateQueries({ queryKey: ['instances'] })
    } catch {}
    setChecking(false)
  }

  // ── Agent logs (latest from all agents) ──
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const { data: agentLogs = [] } = useQuery<AgentLog[]>({
    queryKey: ['agent-logs', selectedAgentId ?? 'all'],
    queryFn: async () => {
      if (agents.length === 0) return []
      const target = selectedAgentId ?? agents[0]?.id
      if (!target) return []
      try {
        const res = await api.get(`/api/v2/agents/${target}/logs`, { params: { limit: 50 } })
        return res.data
      } catch { return [] }
    },
    refetchInterval: 10000,
    enabled: agents.length > 0,
  })

  // ── Chat ──
  const [chatMessages, setChatMessages] = useState<AgentMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const loadChat = useCallback(async () => {
    if (agents.length === 0) return
    try {
      const res = await api.get('/api/v2/agent-messages', { params: { agent_id: agents[0]?.id, limit: 100 } })
      setChatMessages(res.data)
    } catch {}
  }, [agents])

  useEffect(() => { loadChat() }, [loadChat])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  const sendChat = async () => {
    if (!chatInput.trim() || agents.length === 0) return
    setChatSending(true)
    try {
      await api.post('/api/v2/agent-messages', {
        from_agent_id: 'user',
        to_agent_id: agents[0]?.id,
        pattern: 'request-response',
        intent: 'user-chat',
        body: chatInput,
        data: {},
      })
      setChatInput('')
      await loadChat()
    } catch {}
    setChatSending(false)
  }

  // ── Agent actions ──
  const pauseAgent = async (id: string) => {
    try { await api.post(`/api/v2/agents/${id}/pause`); qc.invalidateQueries({ queryKey: ['agents', 'instance', instance.id] }) } catch {}
  }
  const resumeAgent = async (id: string) => {
    try { await api.post(`/api/v2/agents/${id}/resume`); qc.invalidateQueries({ queryKey: ['agents', 'instance', instance.id] }) } catch {}
  }

  // ── Expanded log agent ──
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

  const ProgressBar = ({ value, max, color }: { value: number; max: number; color: string }) => (
    <div className="h-2 rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
    </div>
  )

  const logLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR': return 'text-red-600 dark:text-red-400 bg-red-500/10'
      case 'WARN': case 'WARNING': return 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
      case 'INFO': return 'text-blue-600 dark:text-blue-400 bg-blue-500/10'
      default: return 'text-muted-foreground bg-muted'
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${sc.bg} border ${sc.border}`}>
              <Server className={`h-5 w-5 ${sc.color}`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{instance.name}</h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{instance.host}:{instance.port}</span>
                <CopyButton text={`${instance.host}:${instance.port}`} />
                <span>|</span>
                <span className="capitalize">{roleLabel(instance.role)}</span>
                <span>|</span>
                <span>{nodeTypeLabel(instance.node_type)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${sc.bg} ${sc.color} border ${sc.border}`}>
            <span className={`w-2 h-2 rounded-full ${sc.dot} ${['RUNNING', 'ONLINE'].includes(instance.status.toUpperCase()) ? 'animate-pulse' : ''}`} />
            {sc.label}
          </div>
          <Button variant="outline" size="sm" onClick={handleCheck} disabled={checking}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-1.5">Health Check</span>
          </Button>
        </div>
      </div>

      {/* ── Top row: System Health + Agent List ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* System Health Panel */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-primary" /> System Health
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="rounded-lg bg-muted/50 border border-border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Timer className="h-3 w-3" /> Uptime</div>
              <p className="text-sm font-semibold text-foreground">{uptimeStr(instance.created_at)}</p>
            </div>
            <div className="rounded-lg bg-muted/50 border border-border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Clock className="h-3 w-3" /> Last Heartbeat</div>
              <p className="text-sm font-semibold text-foreground">{timeAgo(instance.last_heartbeat_at)}</p>
            </div>
            <div className="rounded-lg bg-muted/50 border border-border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Zap className="h-3 w-3" /> Active Tasks</div>
              <p className="text-sm font-semibold text-foreground">{activeTasks}</p>
            </div>
            <div className="rounded-lg bg-muted/50 border border-border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Bot className="h-3 w-3" /> Agents</div>
              <p className="text-sm font-semibold text-foreground">{agents.length}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground flex items-center gap-1"><Cpu className="h-3 w-3" /> CPU Usage</span>
                <span className="font-medium text-foreground">{cpuPercent != null ? `${cpuPercent.toFixed(1)}%` : 'N/A'}</span>
              </div>
              <ProgressBar value={cpuPercent ?? 0} max={100} color={cpuPercent != null && cpuPercent > 80 ? 'bg-red-500' : cpuPercent != null && cpuPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'} />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground flex items-center gap-1"><HardDrive className="h-3 w-3" /> Memory</span>
                <span className="font-medium text-foreground">{memMb != null ? `${memMb.toFixed(0)} MB` : 'N/A'}</span>
              </div>
              <ProgressBar value={memMb ?? 0} max={2048} color="bg-blue-500" />
            </div>
          </div>

          {totalPnl !== 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total P&L</span>
                <span className={`font-semibold ${totalPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Agent List Panel */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <Bot className="h-4 w-4 text-primary" /> Agents ({agents.length})
          </h3>
          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Bot className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No agents assigned to this instance.</p>
              <p className="text-xs text-muted-foreground mt-1">Create agents from the Agents tab and assign them here.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {agents.map((agent) => {
                const asc = statusConfig(agent.status)
                const isExpanded = expandedAgent === agent.id
                return (
                  <div key={agent.id} className="rounded-lg border border-border bg-muted/30 overflow-hidden">
                    <div className="flex items-center gap-3 p-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${asc.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{agent.type} agent</p>
                      </div>
                      <StatusBadge status={agent.status} />
                      <div className="flex items-center gap-1">
                        {['RUNNING', 'ONLINE'].includes(agent.status.toUpperCase()) ? (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Pause" onClick={() => pauseAgent(agent.id)}>
                            <Pause className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Resume" onClick={() => resumeAgent(agent.id)}>
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost" size="sm" className="h-7 w-7 p-0" title="Logs"
                          onClick={() => { setExpandedAgent(isExpanded ? null : agent.id); setSelectedAgentId(agent.id) }}
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-border bg-muted/50 px-3 py-2 max-h-40 overflow-y-auto">
                        {agentLogs.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-2">No logs available</p>
                        ) : (
                          <div className="space-y-1">
                            {agentLogs.slice(0, 20).map((log) => (
                              <div key={log.id} className="flex items-start gap-2 text-xs">
                                <span className={`px-1 py-0.5 rounded text-[10px] font-medium shrink-0 ${logLevelColor(log.level)}`}>
                                  {log.level.toUpperCase().slice(0, 4)}
                                </span>
                                <span className="text-muted-foreground shrink-0">{timeAgo(log.created_at)}</span>
                                <span className="text-foreground truncate">{log.message}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom row: Chat + Activity Feed ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chat Panel */}
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <MessageSquare className="h-4 w-4 text-primary" /> Agent Chat
          </h3>
          <div className="flex-1 min-h-[250px] max-h-[350px] overflow-y-auto border border-border rounded-lg bg-muted/30 p-3 mb-3 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No messages yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Send a message to communicate with agents on this instance.</p>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isUser = msg.from_agent_id === 'user'
                return (
                  <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      isUser ? 'bg-primary text-primary-foreground' : 'bg-muted border border-border text-foreground'
                    }`}>
                      {!isUser && <p className="text-[10px] font-medium mb-0.5 opacity-70">{msg.from_agent_id}</p>}
                      <p>{msg.body || msg.intent}</p>
                      <p className="text-[10px] mt-1 opacity-50">{timeAgo(msg.created_at)}</p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="flex gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
              placeholder={agents.length === 0 ? 'No agents to chat with...' : 'Type a message...'}
              disabled={agents.length === 0}
              className="flex-1"
            />
            <Button size="sm" onClick={sendChat} disabled={chatSending || !chatInput.trim() || agents.length === 0}>
              {chatSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Activity Feed Panel */}
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <ScrollText className="h-4 w-4 text-primary" /> Activity Feed
          </h3>
          <div className="flex-1 min-h-[250px] max-h-[350px] overflow-y-auto space-y-2 pr-1">
            {/* Heartbeat events from agent statuses */}
            {agentStatuses.length > 0 && agentStatuses.map((as, i) => (
              <div key={`hb-${i}`} className="flex items-start gap-3 rounded-lg bg-muted/30 border border-border p-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-medium">{(as.name as string) || `Agent ${i + 1}`}</p>
                  <p className="text-xs text-muted-foreground">Status: {(as.status as string) || 'Unknown'} | Heartbeat snapshot</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{timeAgo(instance.last_heartbeat_at)}</span>
              </div>
            ))}

            {/* Agent logs as activity */}
            {agentLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 rounded-lg bg-muted/30 border border-border p-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  log.level.toUpperCase() === 'ERROR' ? 'bg-red-500/10' :
                    log.level.toUpperCase() === 'WARN' || log.level.toUpperCase() === 'WARNING' ? 'bg-amber-500/10' : 'bg-blue-500/10'
                }`}>
                  <ScrollText className={`h-4 w-4 ${
                    log.level.toUpperCase() === 'ERROR' ? 'text-red-600 dark:text-red-400' :
                      log.level.toUpperCase() === 'WARN' || log.level.toUpperCase() === 'WARNING' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${logLevelColor(log.level)}`}>{log.level.toUpperCase()}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(log.created_at)}</span>
                  </div>
                  <p className="text-sm text-foreground mt-1 break-words">{log.message}</p>
                </div>
              </div>
            ))}

            {agentStatuses.length === 0 && agentLogs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <ScrollText className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No recent activity.</p>
                <p className="text-xs text-muted-foreground mt-1">Agent logs and heartbeat events will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function NetworkPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editInstance, setEditInstance] = useState<Instance | null>(null)
  const [deleteInstance, setDeleteInstance] = useState<Instance | null>(null)
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set())
  const [checkingAll, setCheckingAll] = useState(false)
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null)

  const { data: instances = [], isLoading } = useQuery<Instance[]>({
    queryKey: ['instances'],
    queryFn: async () => {
      const res = await api.get('/api/v2/instances')
      return res.data
    },
    refetchInterval: 30000,
  })

  // Keep selectedInstance in sync with fresh data
  useEffect(() => {
    if (selectedInstance) {
      const fresh = instances.find((i) => i.id === selectedInstance.id)
      if (fresh) setSelectedInstance(fresh)
    }
  }, [instances])

  const createMutation = useMutation({
    mutationFn: async (data: InstanceFormData) => { const res = await api.post('/api/v2/instances', data); return res.data },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instances'] }),
    onError: (err: unknown) => { throw err instanceof Error ? err : new Error('Create failed') },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InstanceFormData> }) => { const res = await api.patch(`/api/v2/instances/${id}`, data); return res.data },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['instances'] }); setEditInstance(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/v2/instances/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instances'] }),
  })

  const handleHealthCheck = async (instId: string) => {
    setCheckingIds((prev) => new Set(prev).add(instId))
    try { await api.post(`/api/v2/instances/${instId}/check`); qc.invalidateQueries({ queryKey: ['instances'] }) } catch {}
    setCheckingIds((prev) => { const next = new Set(prev); next.delete(instId); return next })
  }

  const handleCheckAll = async () => {
    setCheckingAll(true)
    await Promise.allSettled(instances.map((inst) => handleHealthCheck(inst.id)))
    setCheckingAll(false)
  }

  // ── If an instance is selected, show the detail dashboard ──
  if (selectedInstance) {
    return <InstanceDetailView instance={selectedInstance} onBack={() => setSelectedInstance(null)} />
  }

  const online = instances.filter((i) => ['RUNNING', 'ONLINE'].includes(i.status.toUpperCase())).length
  const offline = instances.filter((i) => ['OFFLINE', 'ERROR'].includes(i.status.toUpperCase())).length
  const totalAgents = instances.reduce((a, i) => a + (i.agent_count ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <PageHeader icon={Network} title="Infrastructure" description="Manage your OpenClaw runtime instances" />
        <div className="flex items-center gap-2">
          {instances.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleCheckAll} disabled={checkingAll}>
              {checkingAll ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Checking...</> : <><RefreshCw className="h-4 w-4 mr-1.5" /> Check All</>}
            </Button>
          )}
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Instance
          </Button>
        </div>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2"><Server className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Total Instances</span></div>
          <p className="text-2xl font-bold text-foreground">{instances.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /><span className="text-xs text-emerald-600 dark:text-emerald-400">Online</span></div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{online}</p>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-center gap-2 mb-2"><XCircle className="h-4 w-4 text-red-600 dark:text-red-400" /><span className="text-xs text-red-600 dark:text-red-400">Offline</span></div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{offline}</p>
        </div>
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
          <div className="flex items-center gap-2 mb-2"><Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" /><span className="text-xs text-blue-600 dark:text-blue-400">Total Agents</span></div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalAgents}</p>
        </div>
      </div>

      <Tabs defaultValue="instances">
        <TabsList>
          <TabsTrigger value="instances" className="gap-1.5"><Server className="h-4 w-4" /> Instances</TabsTrigger>
          <TabsTrigger value="guide" className="gap-1.5"><BookOpen className="h-4 w-4" /> Connection Guide</TabsTrigger>
        </TabsList>

        <TabsContent value="instances" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : instances.length === 0 ? (
            <EmptyState onAdd={() => setCreateOpen(true)} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {instances.map((inst) => (
                <InstanceCard
                  key={inst.id}
                  instance={inst}
                  isChecking={checkingIds.has(inst.id)}
                  onEdit={() => setEditInstance(inst)}
                  onDelete={() => setDeleteInstance(inst)}
                  onHealthCheck={() => handleHealthCheck(inst.id)}
                  onClick={() => setSelectedInstance(inst)}
                />
              ))}
              <button
                onClick={() => setCreateOpen(true)}
                className="rounded-xl border border-dashed border-border p-5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/50 transition-all min-h-[200px]"
              >
                <Plus className="h-8 w-8" />
                <span className="text-sm font-medium">Add Instance</span>
              </button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="guide" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <ConnectionGuide />
          </div>
        </TabsContent>
      </Tabs>

      <AddInstanceDialog open={createOpen} onOpenChange={setCreateOpen} initial={EMPTY_FORM} title="Add OpenClaw Instance" onSubmit={async (data) => { await createMutation.mutateAsync(data) }} />
      {editInstance && (
        <AddInstanceDialog
          open={!!editInstance} onOpenChange={(v) => { if (!v) setEditInstance(null) }}
          initial={{ name: editInstance.name, host: editInstance.host, port: editInstance.port, role: editInstance.role, node_type: editInstance.node_type }}
          title={`Edit: ${editInstance.name}`} onSubmit={async (data) => { await updateMutation.mutateAsync({ id: editInstance.id, data }) }}
        />
      )}
      <ConfirmDialog
        open={!!deleteInstance} onOpenChange={(v) => { if (!v) setDeleteInstance(null) }}
        title="Remove Instance" description={`Remove "${deleteInstance?.name}" from your infrastructure? This only unregisters it — the actual OpenClaw process keeps running on the host.`}
        confirmLabel="Remove" variant="destructive"
        onConfirm={async () => { if (deleteInstance) await deleteMutation.mutateAsync(deleteInstance.id); setDeleteInstance(null) }}
      />
    </div>
  )
}
