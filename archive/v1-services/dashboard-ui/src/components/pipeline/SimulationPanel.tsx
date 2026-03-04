import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Play, X, ChevronRight, CheckCircle2, AlertCircle, Loader2, Clock,
} from 'lucide-react'
import type { Node, Edge } from '@xyflow/react'

interface NodeResult {
  node_id: string
  node_type: string
  label: string
  status: 'pending' | 'running' | 'success' | 'error'
  input_sample: Record<string, unknown> | null
  output_sample: Record<string, unknown> | null
  duration_ms: number | null
  error?: string
}

interface SimulationResult {
  pipeline_id: string
  test_results: NodeResult[]
  overall: string
  started_at: string
  completed_at: string
}

interface Props {
  nodes: Node[]
  edges: Edge[]
  onClose: () => void
  onSimulate: (input: string) => Promise<SimulationResult>
  onHighlightNode: (nodeId: string | null) => void
}

const SAMPLE_INPUTS: Record<string, string> = {
  discord: JSON.stringify({
    source: 'discord',
    channel: '#trades',
    author: 'TraderMike',
    content: 'BUY AAPL 150C 3/21 @ $2.50 — Strong momentum play, sentiment very bullish on tech earnings',
    timestamp: new Date().toISOString(),
  }, null, 2),
  sentiment: JSON.stringify({
    source: 'sentiment_feed',
    ticker: 'AAPL',
    messages: [
      { text: 'Apple earnings looking great, bullish!', score: 0.85 },
      { text: 'AAPL breaking out of resistance', score: 0.72 },
    ],
    timestamp: new Date().toISOString(),
  }, null, 2),
  news: JSON.stringify({
    source: 'news_feed',
    headline: 'Apple Reports Record Q4 Revenue, Beats Estimates',
    ticker: 'AAPL',
    sentiment_score: 0.78,
    url: 'https://example.com/news/apple-q4',
    timestamp: new Date().toISOString(),
  }, null, 2),
}

export function SimulationPanel({ nodes, edges, onClose, onSimulate, onHighlightNode }: Props) {
  const [input, setInput] = useState(SAMPLE_INPUTS.discord)
  const [results, setResults] = useState<SimulationResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [activeNodeIdx, setActiveNodeIdx] = useState<number>(-1)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  const orderedNodes = getTopologicalOrder(nodes, edges)

  const handleRun = async () => {
    setIsRunning(true)
    setResults(null)
    setActiveNodeIdx(0)

    try {
      const result = await onSimulate(input)
      setResults(result)
      setActiveNodeIdx(-1)
      setExpandedNodes(new Set(result.test_results.map(r => r.node_id)))
    } catch {
      setResults(null)
    } finally {
      setIsRunning(false)
    }
  }

  const loadSample = (key: string) => setInput(SAMPLE_INPUTS[key] || SAMPLE_INPUTS.discord)

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
      case 'error': return <AlertCircle className="h-3.5 w-3.5 text-red-500" />
      case 'running': return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
      default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
    }
  }

  return (
    <div className="w-96 border-l bg-background flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4 text-green-500" />
          <h3 className="text-sm font-semibold">Pipeline Simulation</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Test Input
              </p>
              <div className="flex gap-1">
                {Object.keys(SAMPLE_INPUTS).map(k => (
                  <Button
                    key={k}
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px]"
                    onClick={() => loadSample(k)}
                  >
                    {k}
                  </Button>
                ))}
              </div>
            </div>
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              className="font-mono text-[11px] min-h-[120px] resize-none"
              placeholder="Enter test message or JSON..."
            />
            <Button
              size="sm"
              className="w-full gap-1.5"
              onClick={handleRun}
              disabled={isRunning || !input.trim()}
            >
              {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Run Simulation
            </Button>
          </div>

          {results && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Data Flow
                </p>
                <Badge
                  variant="outline"
                  className={results.overall === 'passed'
                    ? 'text-green-600 border-green-500/30 bg-green-500/10'
                    : 'text-red-600 border-red-500/30 bg-red-500/10'}
                >
                  {results.overall}
                </Badge>
              </div>

              <div className="space-y-1">
                {results.test_results.map((nr, idx) => (
                  <div key={nr.node_id}>
                    {idx > 0 && (
                      <div className="flex justify-center py-0.5">
                        <ChevronRight className="h-3 w-3 text-muted-foreground rotate-90" />
                      </div>
                    )}
                    <div
                      className={`rounded-lg border p-2 cursor-pointer transition-all ${
                        nr.status === 'error' ? 'border-red-500/40 bg-red-500/5' :
                        nr.status === 'success' ? 'border-green-500/30 bg-green-500/5' :
                        'border-muted'
                      }`}
                      onClick={() => {
                        toggleExpand(nr.node_id)
                        onHighlightNode(nr.node_id)
                      }}
                      onMouseEnter={() => onHighlightNode(nr.node_id)}
                      onMouseLeave={() => onHighlightNode(null)}
                    >
                      <div className="flex items-center gap-2">
                        {statusIcon(nr.status)}
                        <span className="text-xs font-medium flex-1 truncate">{nr.label}</span>
                        <Badge variant="outline" className="text-[9px]">{nr.node_type}</Badge>
                        {nr.duration_ms != null && (
                          <span className="text-[9px] text-muted-foreground">{nr.duration_ms}ms</span>
                        )}
                      </div>

                      {expandedNodes.has(nr.node_id) && (
                        <div className="mt-2 space-y-1.5">
                          {nr.input_sample && (
                            <div>
                              <p className="text-[9px] font-semibold text-muted-foreground mb-0.5">INPUT</p>
                              <pre className="text-[10px] font-mono bg-muted/50 rounded p-1.5 overflow-auto max-h-24 whitespace-pre-wrap">
                                {JSON.stringify(nr.input_sample, null, 2)}
                              </pre>
                            </div>
                          )}
                          {nr.output_sample && (
                            <div>
                              <p className="text-[9px] font-semibold text-muted-foreground mb-0.5">OUTPUT</p>
                              <pre className="text-[10px] font-mono bg-muted/50 rounded p-1.5 overflow-auto max-h-24 whitespace-pre-wrap">
                                {JSON.stringify(nr.output_sample, null, 2)}
                              </pre>
                            </div>
                          )}
                          {nr.error && (
                            <p className="text-[10px] text-red-500">{nr.error}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!results && !isRunning && (
            <div className="text-center py-8 text-muted-foreground">
              <Play className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-xs">Enter test input and run simulation to see data flow through each node</p>
            </div>
          )}

          {isRunning && (
            <div className="space-y-1">
              {orderedNodes.map((n, idx) => (
                <div key={n.id}>
                  {idx > 0 && (
                    <div className="flex justify-center py-0.5">
                      <ChevronRight className="h-3 w-3 text-muted-foreground rotate-90" />
                    </div>
                  )}
                  <div className={`rounded-lg border p-2 ${idx === activeNodeIdx ? 'border-blue-500/40 bg-blue-500/5' : 'border-muted opacity-50'}`}>
                    <div className="flex items-center gap-2">
                      {idx < activeNodeIdx
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        : idx === activeNodeIdx
                          ? <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                          : <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className="text-xs font-medium">{(n.data as any)?.label || n.type}</span>
                      <Badge variant="outline" className="text-[9px]">{n.type}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function getTopologicalOrder(nodes: Node[], edges: Edge[]): Node[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const n of nodes) {
    inDegree.set(n.id, 0)
    adj.set(n.id, [])
  }
  for (const e of edges) {
    const source = typeof e.source === 'string' ? e.source : (e.source as any).id
    const target = typeof e.target === 'string' ? e.target : (e.target as any).id
    adj.get(source)?.push(target)
    inDegree.set(target, (inDegree.get(target) || 0) + 1)
  }

  const queue = [...nodes.filter(n => (inDegree.get(n.id) || 0) === 0)]
  const result: Node[] = []

  while (queue.length > 0) {
    const node = queue.shift()!
    result.push(node)
    for (const neighbor of (adj.get(node.id) || [])) {
      const d = (inDegree.get(neighbor) || 1) - 1
      inDegree.set(neighbor, d)
      if (d === 0) {
        const nn = nodeMap.get(neighbor)
        if (nn) queue.push(nn)
      }
    }
  }

  for (const n of nodes) {
    if (!result.find(r => r.id === n.id)) result.push(n)
  }

  return result
}
