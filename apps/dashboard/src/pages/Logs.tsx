/**
 * Logs — Unified system log viewer for client, server, and agent logs.
 */
import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  Terminal, RefreshCw, ChevronDown, ChevronRight,
  AlertCircle, AlertTriangle, Info, Bug,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const SOURCE_TABS = ['all', 'client', 'server', 'agent', 'backtest'] as const
const LEVELS = ['ALL', 'DEBUG', 'INFO', 'WARN', 'ERROR'] as const

const LEVEL_STYLES: Record<string, { bg: string; text: string; icon: typeof Info }> = {
  DEBUG: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', icon: Bug },
  INFO: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Info },
  WARN: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: AlertTriangle },
  ERROR: { bg: 'bg-red-500/20', text: 'text-red-400', icon: AlertCircle },
}

interface LogEntry {
  id: string
  source: string
  level: string
  service: string
  agent_id: string | null
  backtest_id: string | null
  message: string
  details: Record<string, unknown>
  step: string | null
  progress_pct: number | null
  created_at: string
}

export default function Logs() {
  const [source, setSource] = useState<string>('all')
  const [level, setLevel] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const params = new URLSearchParams()
  if (source !== 'all') params.set('source', source)
  if (level !== 'ALL') params.set('level', level)
  params.set('limit', '200')

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['system-logs', source, level],
    queryFn: () => api.get<LogEntry[]>(`/api/v2/system-logs?${params.toString()}`).then(r => r.data),
    refetchInterval: autoRefresh ? 3000 : false,
  })

  const filtered = search
    ? logs.filter(l => l.message.toLowerCase().includes(search.toLowerCase()) || l.service.toLowerCase().includes(search.toLowerCase()))
    : logs

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Terminal className="h-6 w-6 text-emerald-500" />
            System Logs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Unified log stream from all services, agents, and backtests
          </p>
        </div>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors',
            autoRefresh
              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
              : 'border-border bg-card text-muted-foreground'
          )}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', autoRefresh && 'animate-spin')} />
          {autoRefresh ? 'Live' : 'Paused'}
        </button>
      </div>

      {/* Source Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {SOURCE_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setSource(tab)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors',
              source === tab
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {tab}
          </button>
        ))}
        <div className="mx-2 h-6 w-px bg-border" />
        <select
          value={level}
          onChange={e => setLevel(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm"
        >
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <input
          type="text"
          placeholder="Search logs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[200px]"
        />
        <span className="text-xs text-muted-foreground">{filtered.length} entries</span>
      </div>

      {/* Log Table */}
      <div ref={scrollRef} className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[140px_70px_70px_120px_1fr] gap-2 px-4 py-2 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <span>Time</span>
          <span>Source</span>
          <span>Level</span>
          <span>Service</span>
          <span>Message</span>
        </div>
        <div className="divide-y divide-border max-h-[calc(100vh-280px)] overflow-y-auto font-mono text-xs">
          {isLoading && (
            <div className="px-4 py-8 text-center text-muted-foreground">Loading...</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-muted-foreground">No logs found</div>
          )}
          {filtered.map(log => {
            const ls = LEVEL_STYLES[log.level] || LEVEL_STYLES.INFO
            const LevelIcon = ls.icon
            const isExpanded = expandedId === log.id
            const time = log.created_at ? new Date(log.created_at).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''
            const date = log.created_at ? new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
            return (
              <div key={log.id}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="w-full grid grid-cols-[140px_70px_70px_120px_1fr] gap-2 px-4 py-2 hover:bg-muted/50 transition-colors text-left items-center"
                >
                  <span className="text-muted-foreground">{date} {time}</span>
                  <span className="capitalize text-muted-foreground">{log.source}</span>
                  <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium', ls.bg, ls.text)}>
                    <LevelIcon className="h-3 w-3" />
                    {log.level}
                  </span>
                  <span className="text-muted-foreground truncate">{log.service}</span>
                  <span className="text-foreground truncate flex items-center gap-1">
                    {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                    {log.step && <span className="text-cyan-400 mr-1">[{log.step}]</span>}
                    {log.message}
                  </span>
                </button>
                {isExpanded && (
                  <div className="px-4 py-3 bg-muted/30 border-t border-border">
                    {log.agent_id && <div className="mb-1"><span className="text-muted-foreground">Agent:</span> <span className="text-cyan-400">{log.agent_id}</span></div>}
                    {log.backtest_id && <div className="mb-1"><span className="text-muted-foreground">Backtest:</span> <span className="text-cyan-400">{log.backtest_id}</span></div>}
                    {log.progress_pct !== null && (
                      <div className="mb-2">
                        <span className="text-muted-foreground">Progress:</span>
                        <div className="mt-1 w-full bg-muted rounded-full h-1.5">
                          <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${log.progress_pct}%` }} />
                        </div>
                      </div>
                    )}
                    {Object.keys(log.details).length > 0 && (
                      <pre className="mt-2 p-2 bg-black/30 rounded text-[11px] text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
