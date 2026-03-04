/**
 * AgentLeaderCard — reusable card for agent leaderboards on Trades/Strategies pages.
 * Shows name, status dot, P&L, win rate, Sharpe, trade count.
 */
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { useNavigate } from 'react-router-dom'

export interface AgentLeaderData {
  id: string
  rank: number
  name: string
  pnl: number
  winRate: number
  sharpe: number
  trades: number
  status: 'running' | 'paper' | 'paused' | 'error' | 'created' | 'backtesting'
}

const STATUS_DOT: Record<string, string> = {
  running: 'bg-emerald-500',
  paper: 'bg-yellow-500',
  paused: 'bg-muted-foreground/50',
  error: 'bg-red-500',
  created: 'bg-sky-400',
  backtesting: 'bg-blue-500',
}

export function AgentLeaderCard({ agent, className }: { agent: AgentLeaderData; className?: string }) {
  const navigate = useNavigate()

  return (
    <Card
      className={cn(
        'cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group',
        className,
      )}
      onClick={() => navigate(`/agents/${agent.id}`)}
    >
      <CardContent className="p-3 sm:p-4 space-y-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-muted-foreground w-5 shrink-0 text-right">
            #{agent.rank}
          </span>
          <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', STATUS_DOT[agent.status] ?? STATUS_DOT.created)} />
          <span className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
            {agent.name}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">P&L</span>
            <span className={cn('font-mono font-medium', agent.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
              {agent.pnl >= 0 ? '+' : ''}{agent.pnl >= 1000 || agent.pnl <= -1000 ? `$${(agent.pnl / 1000).toFixed(1)}k` : `$${agent.pnl.toFixed(0)}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Win</span>
            <span className="font-mono font-medium">{(agent.winRate * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sharpe</span>
            <span className="font-mono font-medium">{agent.sharpe.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Trades</span>
            <span className="font-mono font-medium">{agent.trades}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function AgentLeaderboardTable({
  agents,
  className,
}: {
  agents: AgentLeaderData[]
  className?: string
}) {
  const navigate = useNavigate()
  const sorted = [...agents].sort((a, b) => b.pnl - a.pnl)

  return (
    <div className={cn('rounded-lg border', className)}>
      <div className="px-3 py-2.5 border-b">
        <h3 className="text-sm font-semibold">Leaderboard</h3>
      </div>
      <div className="divide-y max-h-[500px] overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No agents</div>
        ) : (
          sorted.map((agent, idx) => (
            <div
              key={agent.id}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/agents/${agent.id}`)}
            >
              <span className="w-5 shrink-0 text-right text-xs font-mono text-muted-foreground">
                {idx + 1}
              </span>
              <span className={cn('h-2 w-2 rounded-full shrink-0', STATUS_DOT[agent.status] ?? STATUS_DOT.created)} />
              <span className="truncate flex-1 font-medium">{agent.name}</span>
              <span className={cn(
                'font-mono text-xs shrink-0',
                agent.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
              )}>
                {agent.pnl >= 0 ? '+' : ''}${Math.abs(agent.pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-muted-foreground w-10 text-right shrink-0">
                {(agent.winRate * 100).toFixed(0)}%
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
