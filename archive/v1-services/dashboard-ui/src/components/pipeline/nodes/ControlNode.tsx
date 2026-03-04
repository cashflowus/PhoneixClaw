import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { GitBranch } from 'lucide-react'

function ControlNode({ data }: NodeProps) {
  return (
    <div className="rounded-lg border-2 border-gray-500/50 bg-gray-500/5 px-4 py-3 min-w-[180px] shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-gray-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-gray-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} id="false" className="!bg-gray-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-500/15">
          <GitBranch className="h-4 w-4 text-gray-500" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">{(data as any).label || 'Condition'}</p>
          <p className="text-[10px] text-muted-foreground">{(data as any).subtype || 'Filter'}</p>
        </div>
      </div>
    </div>
  )
}

export default memo(ControlNode)
