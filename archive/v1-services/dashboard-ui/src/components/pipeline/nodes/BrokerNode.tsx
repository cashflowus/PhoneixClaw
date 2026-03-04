import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Wallet } from 'lucide-react'

function BrokerNode({ data }: NodeProps) {
  return (
    <div className="rounded-lg border-2 border-orange-500/50 bg-orange-500/5 px-4 py-3 min-w-[180px] shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-orange-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-500/15">
          <Wallet className="h-4 w-4 text-orange-500" />
        </div>
        <div>
          <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">{(data as any).label || 'Broker'}</p>
          <p className="text-[10px] text-muted-foreground">{(data as any).subtype || 'Alpaca'}</p>
        </div>
      </div>
    </div>
  )
}

export default memo(BrokerNode)
