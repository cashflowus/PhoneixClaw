/**
 * Network page — Modern infrastructure dashboard for OpenClaw instances.
 * Instance cards with live health status, agent counts, and a connection guide.
 */
import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
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
  Server, Plus, Pencil, Trash2, Wifi, WifiOff, Activity, Clock, Bot,
  RefreshCw, CheckCircle2, XCircle, AlertTriangle, ChevronRight, Copy,
  Terminal, Globe, Monitor, HardDrive, Network, BookOpen, Cpu, MemoryStick,
  Loader2, ArrowUpRight, Shield, Check,
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

interface HealthCheckResult {
  id: string
  name: string
  status: string
  online: boolean
  detail: string
  metadata: Record<string, unknown>
  agent_count: number
  checked_at: string
}

const ROLES = ['general', 'strategy-lab', 'data-research', 'risk-promote', 'live-trading']
const NODE_TYPES = ['vps', 'local']
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

function statusConfig(status: string) {
  const s = status.toUpperCase()
  if (['RUNNING', 'ONLINE'].includes(s)) return {
    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30',
    dot: 'bg-emerald-500', label: 'Online', icon: CheckCircle2,
  }
  if (['IDLE', 'DEGRADED'].includes(s)) return {
    color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30',
    dot: 'bg-amber-500', label: 'Degraded', icon: AlertTriangle,
  }
  if (['ERROR', 'OFFLINE'].includes(s)) return {
    color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30',
    dot: 'bg-red-500', label: 'Offline', icon: XCircle,
  }
  return {
    color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30',
    dot: 'bg-zinc-500', label: 'Unknown', icon: AlertTriangle,
  }
}

function roleIcon(role: string) {
  switch (role) {
    case 'strategy-lab': return '🧪'
    case 'data-research': return '📊'
    case 'risk-promote': return '🛡️'
    case 'live-trading': return '📈'
    default: return '⚙️'
  }
}

function nodeTypeLabel(type: string) {
  return type === 'vps' ? 'Cloud VPS' : 'Local Machine'
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

// ─── Instance Card ─────────────────────────────────────────────────────────

function InstanceCard({
  instance,
  onEdit,
  onDelete,
  onHealthCheck,
  isChecking,
}: {
  instance: Instance
  onEdit: () => void
  onDelete: () => void
  onHealthCheck: () => void
  isChecking: boolean
}) {
  const sc = statusConfig(instance.status)
  const StatusIcon = sc.icon
  const agents = instance.agent_count ?? 0
  const hb = instance.capabilities?.last_heartbeat as Record<string, unknown> | undefined
  const cpuPercent = hb?.cpu_percent as number | undefined
  const memMb = hb?.memory_usage_mb as number | undefined

  return (
    <div className={`group relative rounded-xl border ${sc.border} ${sc.bg} p-5 transition-all hover:shadow-lg hover:shadow-black/5`}>
      {/* Status indicator strip */}
      <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${sc.dot}`} />

      <div className="flex items-start justify-between mb-4 mt-1">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${sc.bg} border ${sc.border}`}>
            <Server className={`h-5 w-5 ${sc.color}`} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{instance.name}</h3>
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
        <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3 text-center">
          <Bot className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-lg font-bold">{agents}</p>
          <p className="text-[10px] text-muted-foreground">Agents</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3 text-center">
          <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-sm font-semibold mt-0.5">{timeAgo(instance.last_heartbeat_at)}</p>
          <p className="text-[10px] text-muted-foreground">Heartbeat</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3 text-center">
          {instance.node_type === 'vps'
            ? <Globe className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            : <Monitor className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          }
          <p className="text-sm font-semibold mt-0.5">{nodeTypeLabel(instance.node_type)}</p>
          <p className="text-[10px] text-muted-foreground">Type</p>
        </div>
      </div>

      {/* Resource usage if available */}
      {(cpuPercent != null || memMb != null) && (
        <div className="flex gap-3 mb-4">
          {cpuPercent != null && (
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground flex items-center gap-1"><Cpu className="h-3 w-3" /> CPU</span>
                <span className="font-medium">{cpuPercent.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
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
                <span className="font-medium">{memMb.toFixed(0)} MB</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${Math.min((memMb / 2048) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{roleIcon(instance.role)}</span>
          <span className="text-xs text-muted-foreground capitalize">{instance.role.replace('-', ' ')}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="sm" className="h-7 w-7 p-0"
            title="Check health"
            disabled={isChecking}
            onClick={onHealthCheck}
          >
            {isChecking
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />
            }
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" title="Delete" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Instance Dialog with Verification ─────────────────────────────────

function AddInstanceDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  title,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: InstanceFormData
  onSubmit: (data: InstanceFormData) => Promise<void>
  title: string
}) {
  const [form, setForm] = useState<InstanceFormData>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)

  useEffect(() => {
    if (open) { setForm(initial); setError(''); setVerifyResult(null) }
  }, [open, initial])

  const handleVerify = async () => {
    if (!form.host.trim()) { setError('Host is required to verify'); return }
    setVerifying(true)
    setVerifyResult(null)
    setError('')
    try {
      const res = await api.post('/api/v2/instances/verify', { host: form.host, port: form.port })
      setVerifyResult(res.data)
    } catch {
      setVerifyResult({ reachable: false, is_openclaw: false, detail: 'Verification request failed', metadata: {} })
    } finally {
      setVerifying(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.host.trim()) {
      setError('Name and Host are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit(form)
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Connect an OpenClaw runtime instance running on your VPS or local machine.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="inst-name">Instance Name</Label>
            <Input
              id="inst-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g., prod-trading-1"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Connection</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={form.host}
                  onChange={(e) => { setForm((f) => ({ ...f, host: e.target.value })); setVerifyResult(null) }}
                  placeholder="IP or hostname (e.g., 192.168.1.100)"
                />
              </div>
              <div className="w-24">
                <Input
                  type="number"
                  value={form.port}
                  onChange={(e) => { setForm((f) => ({ ...f, port: Number(e.target.value) || 18800 })); setVerifyResult(null) }}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={handleVerify}
                disabled={verifying || !form.host.trim()}
              >
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                <span className="ml-1.5">Verify</span>
              </Button>
            </div>
          </div>

          {/* Verify result */}
          {verifyResult && (
            <div className={`rounded-lg border p-3 text-sm ${
              verifyResult.is_openclaw
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                : verifyResult.reachable
                  ? 'border-amber-500/30 bg-amber-500/5 text-amber-400'
                  : 'border-red-500/30 bg-red-500/5 text-red-400'
            }`}>
              <div className="flex items-center gap-2">
                {verifyResult.is_openclaw
                  ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                  : verifyResult.reachable
                    ? <AlertTriangle className="h-4 w-4 shrink-0" />
                    : <XCircle className="h-4 w-4 shrink-0" />
                }
                <span className="font-medium">
                  {verifyResult.is_openclaw
                    ? 'OpenClaw instance detected!'
                    : verifyResult.reachable
                      ? 'Host reachable but not confirmed as OpenClaw'
                      : 'Cannot reach host'
                  }
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
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}><span className="capitalize">{r.replace('-', ' ')}</span></SelectItem>)}
                </SelectContent>
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
    <div className="rounded-lg border border-white/10 bg-black/30 overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-white/[0.02]">
          <span className="text-[11px] text-muted-foreground font-medium">{title}</span>
          <CopyButton text={code} />
        </div>
      )}
      <pre className="px-3 py-2 text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre">
        {code}
      </pre>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-semibold">How to Connect OpenClaw Instances</h3>
          <p className="text-xs text-muted-foreground">Step-by-step guide for VPS and local deployments</p>
        </div>
      </div>

      <Tabs value={expandedTab} onValueChange={(v) => setExpandedTab(v as 'vps' | 'local')}>
        <TabsList className="w-full">
          <TabsTrigger value="vps" className="flex-1 gap-2"><Globe className="h-4 w-4" /> Cloud VPS</TabsTrigger>
          <TabsTrigger value="local" className="flex-1 gap-2"><Monitor className="h-4 w-4" /> Local Machine</TabsTrigger>
        </TabsList>

        <TabsContent value="vps" className="space-y-4 mt-4">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary">1</div>
              <div className="w-px flex-1 bg-white/10 mt-2" />
            </div>
            <div className="flex-1 pb-6">
              <h4 className="font-medium text-sm mb-1">SSH into your VPS</h4>
              <p className="text-xs text-muted-foreground mb-3">Connect to your server using SSH. Make sure Docker is installed.</p>
              <CodeBlock code="ssh root@your-vps-ip" title="Terminal" />
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary">2</div>
              <div className="w-px flex-1 bg-white/10 mt-2" />
            </div>
            <div className="flex-1 pb-6">
              <h4 className="font-medium text-sm mb-1">Install Docker (if not already installed)</h4>
              <p className="text-xs text-muted-foreground mb-3">OpenClaw runs as a Docker container. If you're using Hostinger VPS, Docker is pre-installed via the Docker Manager.</p>
              <CodeBlock
                code={`# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Or use your VPS provider's Docker manager (Hostinger, DigitalOcean, etc.)`}
                title="Terminal"
              />
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary">3</div>
              <div className="w-px flex-1 bg-white/10 mt-2" />
            </div>
            <div className="flex-1 pb-6">
              <h4 className="font-medium text-sm mb-1">Deploy the OpenClaw container</h4>
              <p className="text-xs text-muted-foreground mb-3">Pull and run the OpenClaw Docker image. The default port is 18800.</p>
              <CodeBlock
                code={`# Using Docker Compose (recommended)
mkdir openclaw && cd openclaw

cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  openclaw:
    image: openclaw/runtime:latest
    container_name: openclaw-node
    ports:
      - "18800:18800"
    environment:
      - OPENCLAW_NODE_NAME=my-vps-node
      - OPENCLAW_API_KEY=\${OPENCLAW_API_KEY}
    volumes:
      - openclaw_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18800/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  openclaw_data:
EOF

docker compose up -d`}
                title="docker-compose.yml"
              />
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary">4</div>
              <div className="w-px flex-1 bg-white/10 mt-2" />
            </div>
            <div className="flex-1 pb-6">
              <h4 className="font-medium text-sm mb-1">Open firewall port</h4>
              <p className="text-xs text-muted-foreground mb-3">Ensure port 18800 is accessible from this dashboard's server.</p>
              <CodeBlock
                code={`# UFW (Ubuntu)
sudo ufw allow 18800/tcp

# Or configure via your VPS provider's firewall panel
# Hostinger: VPS → Firewall → Add rule → Port 18800 TCP`}
                title="Terminal"
              />
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-sm mb-1">Add the instance in Phoenix Claw</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Click "Add Instance" above, enter your VPS IP address and port 18800.
                Use the "Verify" button to confirm connectivity before saving.
              </p>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-400">
                <strong>Tip:</strong> The verify button will ping the health endpoint to confirm it's a real OpenClaw instance before you add it.
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="local" className="space-y-4 mt-4">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary">1</div>
              <div className="w-px flex-1 bg-white/10 mt-2" />
            </div>
            <div className="flex-1 pb-6">
              <h4 className="font-medium text-sm mb-1">Install Docker Desktop</h4>
              <p className="text-xs text-muted-foreground mb-3">Download and install Docker Desktop for your OS.</p>
              <CodeBlock
                code={`# macOS (using Homebrew)
brew install --cask docker

# Windows: Download from https://docker.com/products/docker-desktop
# Linux: curl -fsSL https://get.docker.com | sh`}
                title="Terminal"
              />
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary">2</div>
              <div className="w-px flex-1 bg-white/10 mt-2" />
            </div>
            <div className="flex-1 pb-6">
              <h4 className="font-medium text-sm mb-1">Run OpenClaw locally</h4>
              <p className="text-xs text-muted-foreground mb-3">Start the OpenClaw runtime on your machine.</p>
              <CodeBlock
                code={`docker run -d \\
  --name openclaw-local \\
  -p 18800:18800 \\
  -e OPENCLAW_NODE_NAME=my-local-node \\
  -v openclaw_data:/data \\
  --restart unless-stopped \\
  openclaw/runtime:latest`}
                title="Terminal"
              />
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary">3</div>
              <div className="w-px flex-1 bg-white/10 mt-2" />
            </div>
            <div className="flex-1 pb-6">
              <h4 className="font-medium text-sm mb-1">Verify it's running</h4>
              <p className="text-xs text-muted-foreground mb-3">Check that the health endpoint responds.</p>
              <CodeBlock
                code={`curl http://localhost:18800/health
# Expected: {"status":"ok","version":"x.x.x"}`}
                title="Terminal"
              />
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary">4</div>
              <div className="w-px flex-1 bg-white/10 mt-2" />
            </div>
            <div className="flex-1 pb-6">
              <h4 className="font-medium text-sm mb-1">Expose for remote access (optional)</h4>
              <p className="text-xs text-muted-foreground mb-3">If your dashboard runs on a different machine, you need to expose the port or use a tunnel.</p>
              <CodeBlock
                code={`# Option A: Use your local IP (same network)
# Find IP: ifconfig | grep inet  (macOS/Linux)
# Then add instance with your-local-ip:18800

# Option B: Use ngrok for remote access
ngrok http 18800
# Use the ngrok URL as the host`}
                title="Terminal"
              />
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-sm mb-1">Add instance in Phoenix Claw</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Click "Add Instance," use <code className="px-1 py-0.5 bg-white/5 rounded text-[11px]">localhost</code> or your local IP, port 18800.
                Select "Local Machine" as node type.
              </p>
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-400">
                <strong>Note:</strong> For local instances, make sure the Phoenix API server can reach the OpenClaw port.
                If both run on the same machine, <code className="px-1 py-0.5 bg-white/5 rounded">localhost</code> works.
                Otherwise, use your machine's LAN IP.
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Empty State ───────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 p-10 text-center">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
        <Server className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No instances connected</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
        Connect your first OpenClaw runtime instance to start deploying and managing trading agents.
        Instances can run on a cloud VPS or your local machine.
      </p>
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4 mr-2" /> Add Your First Instance
      </Button>
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

  const { data: instances = [], isLoading } = useQuery<Instance[]>({
    queryKey: ['instances'],
    queryFn: async () => {
      const res = await api.get('/api/v2/instances')
      return res.data
    },
    refetchInterval: 30000,
  })

  const createMutation = useMutation({
    mutationFn: async (data: InstanceFormData) => {
      const res = await api.post('/api/v2/instances', data)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instances'] }),
    onError: (err: unknown) => {
      throw err instanceof Error ? err : new Error('Create failed')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InstanceFormData> }) => {
      const res = await api.patch(`/api/v2/instances/${id}`, data)
      return res.data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['instances'] }); setEditInstance(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/v2/instances/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instances'] }),
  })

  const handleHealthCheck = async (instId: string) => {
    setCheckingIds((prev) => new Set(prev).add(instId))
    try {
      await api.post(`/api/v2/instances/${instId}/check`)
      qc.invalidateQueries({ queryKey: ['instances'] })
    } catch { /* silently fail, status stays the same */ }
    setCheckingIds((prev) => {
      const next = new Set(prev)
      next.delete(instId)
      return next
    })
  }

  const handleCheckAll = async () => {
    setCheckingAll(true)
    await Promise.allSettled(instances.map((inst) => handleHealthCheck(inst.id)))
    setCheckingAll(false)
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
              {checkingAll
                ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Checking...</>
                : <><RefreshCw className="h-4 w-4 mr-1.5" /> Check All</>
              }
            </Button>
          )}
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Instance
          </Button>
        </div>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/10 bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total Instances</span>
          </div>
          <p className="text-2xl font-bold">{instances.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-emerald-400/80">Online</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{online}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-4 w-4 text-red-400" />
            <span className="text-xs text-red-400/80">Offline</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{offline}</p>
        </div>
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-blue-400/80">Total Agents</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{totalAgents}</p>
        </div>
      </div>

      <Tabs defaultValue="instances">
        <TabsList>
          <TabsTrigger value="instances" className="gap-1.5">
            <Server className="h-4 w-4" /> Instances
          </TabsTrigger>
          <TabsTrigger value="guide" className="gap-1.5">
            <BookOpen className="h-4 w-4" /> Connection Guide
          </TabsTrigger>
        </TabsList>

        <TabsContent value="instances" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
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
                />
              ))}
              {/* Add new card */}
              <button
                onClick={() => setCreateOpen(true)}
                className="rounded-xl border border-dashed border-white/10 p-5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-white/20 hover:bg-white/[0.02] transition-all min-h-[200px]"
              >
                <Plus className="h-8 w-8" />
                <span className="text-sm font-medium">Add Instance</span>
              </button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="guide" className="mt-4">
          <div className="rounded-xl border border-white/10 bg-card p-6">
            <ConnectionGuide />
          </div>
        </TabsContent>
      </Tabs>

      {/* Create modal */}
      <AddInstanceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initial={EMPTY_FORM}
        title="Add OpenClaw Instance"
        onSubmit={async (data) => { await createMutation.mutateAsync(data) }}
      />

      {/* Edit modal */}
      {editInstance && (
        <AddInstanceDialog
          open={!!editInstance}
          onOpenChange={(v) => { if (!v) setEditInstance(null) }}
          initial={{
            name: editInstance.name,
            host: editInstance.host,
            port: editInstance.port,
            role: editInstance.role,
            node_type: editInstance.node_type,
          }}
          title={`Edit: ${editInstance.name}`}
          onSubmit={async (data) => { await updateMutation.mutateAsync({ id: editInstance.id, data }) }}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteInstance}
        onOpenChange={(v) => { if (!v) setDeleteInstance(null) }}
        title="Remove Instance"
        description={`Remove "${deleteInstance?.name}" from your infrastructure? This only unregisters it — the actual OpenClaw process keeps running on the host.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={async () => {
          if (deleteInstance) await deleteMutation.mutateAsync(deleteInstance.id)
          setDeleteInstance(null)
        }}
      />
    </div>
  )
}
