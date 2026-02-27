import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Send, Loader2, Bot, User, Sparkles, Play, Rocket, Trash2,
  ChevronRight, CheckCircle2, AlertCircle, Brain, TrendingUp, Code,
  FlaskConical, Settings2,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip,
} from 'recharts'

interface Strategy {
  id: string
  name: string
  strategy_text: string
  parsed_config: Record<string, unknown>
  backtest_summary: Record<string, unknown> | null
  status: string
  created_at: string
  updated_at: string
}

interface AgentStep {
  type: 'thinking' | 'action' | 'response' | 'error'
  content?: string
  tool?: string
  status?: string
  result?: Record<string, unknown>
  error?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  steps?: AgentStep[]
  timestamp: string
}

const SUGGESTIONS = [
  'Create a momentum strategy for AAPL that buys on bullish sentiment',
  'Build a mean reversion strategy for SPY with tight stop losses',
  'Design a strategy that trades options based on Discord sentiment signals',
  'Backtest a simple SMA crossover strategy on TSLA for the last 2 years',
  'Create an aggressive options strategy for NVDA earnings plays',
]

export default function StrategyBuilder() {
  const qc = useQueryClient()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [activeStrategyId, setActiveStrategyId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: strategies, isLoading: strategiesLoading } = useQuery<Strategy[]>({
    queryKey: ['strategies'],
    queryFn: () => axios.get('/api/v1/strategies').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/v1/strategies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategies'] }),
  })

  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      axios.post('/api/v1/strategies/agent/chat', {
        message,
        conversation_history: messages.slice(-10).map(m => ({
          role: m.role,
          content: m.content,
        })),
        strategy_context: activeStrategyId ? { active_strategy_id: activeStrategyId } : undefined,
      }).then(r => r.data),
    onSuccess: (data) => {
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.message || '',
        steps: data.steps || [],
        timestamp: data.timestamp || new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])
      qc.invalidateQueries({ queryKey: ['strategies'] })

      for (const step of (data.steps || [])) {
        if (step.tool === 'create_strategy' && step.result?.id) {
          setActiveStrategyId(step.result.id as string)
        }
      }
    },
  })

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = (text?: string) => {
    const msg = text || input.trim()
    if (!msg || chatMutation.isPending) return

    const userMsg: ChatMessage = {
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    chatMutation.mutate(msg)
  }

  const selectedStrategy = strategies?.find(s => s.id === activeStrategyId)
  const report = selectedStrategy?.backtest_summary as any
  const equityCurve = report?.equity_curve?.map((v: number, i: number) => ({ i, value: v })) || []

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sidebar — strategies list */}
      <div className="w-72 border-r flex flex-col bg-muted/20">
        <div className="p-3 border-b">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-500" />
            <h3 className="text-sm font-semibold">Strategy Agent</h3>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Autonomous AI strategy builder</p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {strategiesLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)
            ) : !strategies?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <FlaskConical className="h-6 w-6 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No strategies yet</p>
                <p className="text-[10px]">Chat with the agent to create one</p>
              </div>
            ) : (
              strategies.map(s => (
                <div
                  key={s.id}
                  className={`rounded-lg border p-2 cursor-pointer transition-all ${
                    activeStrategyId === s.id
                      ? 'border-purple-500/50 bg-purple-500/5 shadow-sm'
                      : 'hover:border-muted-foreground/30'
                  }`}
                  onClick={() => setActiveStrategyId(s.id)}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{s.strategy_text.slice(0, 60)}</p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Badge variant="outline" className="text-[8px] px-1">
                        {s.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-destructive opacity-0 group-hover:opacity-100"
                        onClick={e => { e.stopPropagation(); deleteMutation.mutate(s.id) }}
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main — chat interface */}
      <div className="flex-1 flex flex-col">
        {/* Chat messages */}
        <div className="flex-1 overflow-auto" ref={scrollRef}>
          <div className="max-w-3xl mx-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 mb-4">
                  <Sparkles className="h-8 w-8 text-purple-500" />
                </div>
                <h2 className="text-xl font-bold mb-1">Strategy Agent</h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  I'm your autonomous trading strategy agent. Tell me what you want to build
                  and I'll create, backtest, and deploy strategies for you.
                </p>
                <div className="grid gap-2 max-w-lg mx-auto">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      className="text-left text-xs p-3 rounded-lg border hover:border-purple-500/40 hover:bg-purple-500/5 transition-colors"
                      onClick={() => handleSend(s)}
                    >
                      <ChevronRight className="h-3 w-3 inline mr-1.5 text-purple-500" />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <div className={`max-w-[85%] space-y-2 ${msg.role === 'user' ? 'items-end' : ''}`}>
                  {msg.role === 'user' ? (
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5">
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  ) : (
                    <>
                      {/* Agent steps */}
                      {msg.steps?.filter(s => s.type !== 'response').map((step, si) => (
                        <AgentStepCard key={si} step={step} />
                      ))}
                      {/* Agent message */}
                      <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-2.5">
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="flex gap-3">
                <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
                    <span className="text-xs text-muted-foreground">Agent is working...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="border-t bg-background p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Tell the agent what to do... e.g. 'Create a momentum strategy for TSLA'"
                className="flex-1"
                disabled={chatMutation.isPending}
              />
              <Button
                onClick={() => handleSend()}
                disabled={!input.trim() || chatMutation.isPending}
                className="gap-1.5"
              >
                {chatMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
              The agent can create strategies, run backtests, analyze sentiment, and deploy — all autonomously.
            </p>
          </div>
        </div>
      </div>

      {/* Right sidebar — active strategy details */}
      {selectedStrategy && report && (
        <div className="w-80 border-l flex flex-col bg-muted/20 overflow-auto">
          <div className="p-3 border-b">
            <h3 className="text-sm font-semibold truncate">{selectedStrategy.name}</h3>
            <Badge variant="outline" className="text-[9px] mt-1">{selectedStrategy.status}</Badge>
          </div>
          <div className="p-3 space-y-3">
            {report.narrative && (
              <Card className="border-purple-500/20 bg-purple-500/5">
                <CardContent className="p-3">
                  <p className="text-[10px] font-semibold uppercase text-purple-500 mb-1">AI Analysis</p>
                  <p className="text-[11px] leading-relaxed">{report.narrative}</p>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Return', value: `${report.metrics?.total_return_pct?.toFixed(1) || 0}%` },
                { label: 'Sharpe', value: report.metrics?.sharpe_ratio?.toFixed(2) || '0' },
                { label: 'Drawdown', value: `${report.metrics?.max_drawdown_pct?.toFixed(1) || 0}%` },
                { label: 'Win Rate', value: `${((report.metrics?.win_rate || 0) * 100).toFixed(0)}%` },
              ].map(m => (
                <Card key={m.label}>
                  <CardContent className="p-2 text-center">
                    <p className="text-[9px] text-muted-foreground uppercase">{m.label}</p>
                    <p className="text-sm font-bold">{m.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {equityCurve.length > 0 && (
              <Card>
                <CardHeader className="pb-1 p-3"><CardTitle className="text-[11px]">Equity Curve</CardTitle></CardHeader>
                <CardContent className="p-2">
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={equityCurve}>
                        <defs>
                          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="i" hide />
                        <YAxis domain={['auto', 'auto']} hide />
                        <RTooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Portfolio']} />
                        <Area type="monotone" dataKey="value" stroke="#a855f7" fill="url(#eqGrad)" strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {report.pseudocode && (
              <Card>
                <CardHeader className="pb-1 p-3"><CardTitle className="text-[11px]">Strategy Logic</CardTitle></CardHeader>
                <CardContent className="p-2">
                  <pre className="text-[9px] font-mono bg-muted p-2 rounded overflow-auto max-h-40 whitespace-pre-wrap">
                    {report.pseudocode}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AgentStepCard({ step }: { step: AgentStep }) {
  if (step.type === 'thinking') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-muted-foreground">
        <Brain className="h-3 w-3 text-purple-400 animate-pulse" />
        <span className="italic">{step.content}</span>
      </div>
    )
  }

  if (step.type === 'action') {
    const isSuccess = step.status === 'success'
    return (
      <div className={`rounded-lg border px-3 py-2 ${isSuccess ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
        <div className="flex items-center gap-2">
          {isSuccess ? (
            <CheckCircle2 className="h-3 w-3 text-green-500" />
          ) : (
            <AlertCircle className="h-3 w-3 text-red-500" />
          )}
          <span className="text-[11px] font-medium">{step.tool?.replace(/_/g, ' ')}</span>
          <Badge variant="outline" className="text-[8px]">{step.status}</Badge>
        </div>
        {step.result && (
          <details className="mt-1.5">
            <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
              View result
            </summary>
            <pre className="text-[9px] font-mono bg-muted/50 rounded p-1.5 mt-1 overflow-auto max-h-24 whitespace-pre-wrap">
              {JSON.stringify(step.result, null, 2)}
            </pre>
          </details>
        )}
        {step.error && (
          <p className="text-[10px] text-red-500 mt-1">{step.error}</p>
        )}
      </div>
    )
  }

  if (step.type === 'error') {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-3 w-3 text-red-500" />
          <span className="text-[11px] text-red-500">{step.content}</span>
        </div>
      </div>
    )
  }

  return null
}
