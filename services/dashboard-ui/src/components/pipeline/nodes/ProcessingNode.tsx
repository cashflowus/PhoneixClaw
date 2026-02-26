import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Cog } from 'lucide-react'

function ProcessingNode({ data }: NodeProps) {
  return (
    <div className="rounded-lg border-2 border-green-500/50 bg-green-500/5 px-4 py-3 min-w-[180px] shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-green-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-green-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-500/15">
          <Cog className="h-4 w-4 text-green-500" />
        </div>
        <div>
          <p className="text-xs font-semibold text-green-600 dark:text-green-400">{(data as any).label || 'Processor'}</p>
          <p className="text-[10px] text-muted-foreground">{(data as any).subtype || 'Filter'}</p>
        </div>
      </div>
    </div>
  )
}

export default memo(ProcessingNode)
