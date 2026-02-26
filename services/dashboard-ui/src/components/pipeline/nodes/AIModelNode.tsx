import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Brain } from 'lucide-react'

function AIModelNode({ data }: NodeProps) {
  return (
    <div className="rounded-lg border-2 border-purple-500/50 bg-purple-500/5 px-4 py-3 min-w-[180px] shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-purple-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-purple-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-500/15">
          <Brain className="h-4 w-4 text-purple-500" />
        </div>
        <div>
          <p className="text-xs font-semibold text-purple-600 dark:text-purple-400">{(data as any).label || 'AI Model'}</p>
          <p className="text-[10px] text-muted-foreground">{(data as any).subtype || 'LLM'}</p>
        </div>
      </div>
    </div>
  )
}

export default memo(AIModelNode)
