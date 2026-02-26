import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Database } from 'lucide-react'

function DataSourceNode({ data }: NodeProps) {
  return (
    <div className="rounded-lg border-2 border-blue-500/50 bg-blue-500/5 px-4 py-3 min-w-[180px] shadow-sm">
      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/15">
          <Database className="h-4 w-4 text-blue-500" />
        </div>
        <div>
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">{(data as any).label || 'Data Source'}</p>
          <p className="text-[10px] text-muted-foreground">{(data as any).subtype || 'Discord'}</p>
        </div>
      </div>
    </div>
  )
}

export default memo(DataSourceNode)
