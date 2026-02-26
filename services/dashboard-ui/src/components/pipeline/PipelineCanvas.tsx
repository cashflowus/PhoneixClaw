import { useCallback, useRef, useState } from 'react'
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import DataSourceNode from './nodes/DataSourceNode'
import ProcessingNode from './nodes/ProcessingNode'
import AIModelNode from './nodes/AIModelNode'
import BrokerNode from './nodes/BrokerNode'
import ControlNode from './nodes/ControlNode'
import { NodePalette, type PaletteItem } from './NodePalette'
import { NodeConfigPanel } from './NodeConfigPanel'
import { PipelineToolbar } from './PipelineToolbar'

const nodeTypes = {
  dataSource: DataSourceNode,
  processing: ProcessingNode,
  aiModel: AIModelNode,
  broker: BrokerNode,
  control: ControlNode,
}

interface Props {
  pipelineId?: string
  pipelineName: string
  initialNodes?: Node[]
  initialEdges?: Edge[]
  status?: string
  onSave: (nodes: Node[], edges: Edge[]) => Promise<void>
  onDeploy: (nodes: Node[], edges: Edge[]) => Promise<void>
  onTest: (nodes: Node[], edges: Edge[]) => Promise<void>
}

export function PipelineCanvas({
  pipelineName,
  initialNodes = [],
  initialEdges = [],
  status = 'draft',
  onSave,
  onDeploy,
  onTest,
}: Props) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const nodeIdCounter = useRef(initialNodes.length)

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges(eds => addEdge({ ...params, animated: true, style: { strokeWidth: 2 } }, eds))
      setIsDirty(true)
    },
    [setEdges],
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const data = event.dataTransfer.getData('application/pipeline-node')
      if (!data || !reactFlowInstance) return

      const item: PaletteItem = JSON.parse(data)
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      nodeIdCounter.current += 1
      const newNode: Node = {
        id: `node_${nodeIdCounter.current}`,
        type: item.type,
        position,
        data: { label: item.label, subtype: item.subtype },
      }

      setNodes(nds => nds.concat(newNode))
      setIsDirty(true)
    },
    [reactFlowInstance, setNodes],
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const handleNodeUpdate = useCallback(
    (id: string, data: Record<string, unknown>) => {
      setNodes(nds =>
        nds.map(n => (n.id === id ? { ...n, data } : n)),
      )
      setSelectedNode(prev => (prev?.id === id ? { ...prev, data } : prev))
      setIsDirty(true)
    },
    [setNodes],
  )

  const pushHistory = useCallback(() => {
    setHistory(h => [...h.slice(0, historyIndex + 1), { nodes: [...nodes], edges: [...edges] }])
    setHistoryIndex(i => i + 1)
  }, [nodes, edges, historyIndex])

  const handleUndo = useCallback(() => {
    if (historyIndex < 0) return
    const prev = history[historyIndex]
    setNodes(prev.nodes)
    setEdges(prev.edges)
    setHistoryIndex(i => i - 1)
  }, [history, historyIndex, setNodes, setEdges])

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return
    const next = history[historyIndex + 1]
    setNodes(next.nodes)
    setEdges(next.edges)
    setHistoryIndex(i => i + 1)
  }, [history, historyIndex, setNodes, setEdges])

  const handleSave = async () => {
    setIsSaving(true)
    pushHistory()
    try {
      await onSave(nodes, edges)
      setIsDirty(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeploy = async () => {
    setIsDeploying(true)
    try {
      await onDeploy(nodes, edges)
    } finally {
      setIsDeploying(false)
    }
  }

  const handleTest = async () => {
    setIsTesting(true)
    try {
      await onTest(nodes, edges)
    } finally {
      setIsTesting(false)
    }
  }

  const handleExport = () => {
    const data = JSON.stringify({ nodes, edges }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${pipelineName.replace(/\s+/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const data = JSON.parse(text)
        if (data.nodes) setNodes(data.nodes)
        if (data.edges) setEdges(data.edges)
        setIsDirty(true)
      } catch {
        alert('Invalid pipeline JSON file')
      }
    }
    input.click()
  }

  return (
    <div className="flex flex-col h-full">
      <PipelineToolbar
        pipelineName={pipelineName}
        status={status}
        isDirty={isDirty}
        isSaving={isSaving}
        isDeploying={isDeploying}
        isTesting={isTesting}
        onSave={handleSave}
        onDeploy={handleDeploy}
        onTest={handleTest}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onImport={handleImport}
        onExport={handleExport}
        onVersionHistory={() => {}}
        canUndo={historyIndex >= 0}
        canRedo={historyIndex < history.length - 1}
      />
      <div className="flex flex-1 overflow-hidden">
        <NodePalette onDragStart={() => {}} />
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode="Delete"
            className="bg-background"
          >
            <Controls className="!bg-background !border !shadow-sm" />
            <MiniMap
              className="!bg-muted"
              nodeColor={(n) => {
                if (n.type === 'dataSource') return '#3b82f6'
                if (n.type === 'processing') return '#22c55e'
                if (n.type === 'aiModel') return '#a855f7'
                if (n.type === 'broker') return '#f97316'
                return '#6b7280'
              }}
            />
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          </ReactFlow>
        </div>
        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            onUpdate={handleNodeUpdate}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  )
}
