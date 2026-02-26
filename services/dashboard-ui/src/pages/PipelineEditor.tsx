import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { PipelineCanvas } from '@/components/pipeline/PipelineCanvas'
import type { Node, Edge } from '@xyflow/react'
import { ReactFlowProvider } from '@xyflow/react'

interface PipelineData {
  id: string
  name: string
  description: string | null
  flow_json: { nodes?: Node[]; edges?: Edge[] }
  status: string
  version: number
}

export default function PipelineEditorPage() {
  const { pipelineId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: pipeline, isLoading } = useQuery<PipelineData>({
    queryKey: ['advanced-pipeline', pipelineId],
    queryFn: () => axios.get(`/api/v1/advanced-pipelines/${pipelineId}`).then(r => r.data),
    enabled: !!pipelineId,
  })

  const saveMutation = useMutation({
    mutationFn: (flowJson: object) =>
      axios.put(`/api/v1/advanced-pipelines/${pipelineId}`, {
        flow_json: flowJson,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['advanced-pipeline', pipelineId] }),
  })

  const deployMutation = useMutation({
    mutationFn: () => axios.post(`/api/v1/advanced-pipelines/${pipelineId}/deploy`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['advanced-pipeline', pipelineId] }),
  })

  const testMutation = useMutation({
    mutationFn: () => axios.post(`/api/v1/advanced-pipelines/${pipelineId}/test`),
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    )
  }

  if (!pipeline) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Pipeline not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/advanced-pipelines')}>
          Back to Pipelines
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/advanced-pipelines')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">Advanced Pipelines /</span>
        <span className="text-sm font-medium">{pipeline.name}</span>
      </div>
      <div className="flex-1">
        <ReactFlowProvider>
          <PipelineCanvas
            pipelineId={pipeline.id}
            pipelineName={pipeline.name}
            initialNodes={pipeline.flow_json?.nodes || []}
            initialEdges={pipeline.flow_json?.edges || []}
            status={pipeline.status}
            onSave={async (nodes, edges) => {
              await saveMutation.mutateAsync({ nodes, edges })
            }}
            onDeploy={async () => {
              await deployMutation.mutateAsync()
            }}
            onTest={async () => {
              await testMutation.mutateAsync()
            }}
          />
        </ReactFlowProvider>
      </div>
    </div>
  )
}
