import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Save, Play, Undo2, Redo2, Upload, Download, History, Loader2, Rocket, FlaskConical,
} from 'lucide-react'

interface Props {
  pipelineName: string
  status: string
  isDirty: boolean
  isSaving: boolean
  isDeploying: boolean
  isTesting: boolean
  onSave: () => void
  onDeploy: () => void
  onTest: () => void
  onUndo: () => void
  onRedo: () => void
  onImport: () => void
  onExport: () => void
  onVersionHistory: () => void
  canUndo: boolean
  canRedo: boolean
  isSimulating?: boolean
}

export function PipelineToolbar({
  pipelineName,
  status,
  isDirty,
  isSaving,
  isDeploying,
  isTesting,
  onSave,
  onDeploy,
  onTest,
  onUndo,
  onRedo,
  onImport,
  onExport,
  onVersionHistory,
  canUndo,
  canRedo,
  isSimulating,
}: Props) {
  const statusColors: Record<string, string> = {
    draft: 'bg-gray-500/15 text-gray-600',
    deployed: 'bg-green-500/15 text-green-600',
    testing: 'bg-yellow-500/15 text-yellow-600',
    error: 'bg-red-500/15 text-red-600',
  }

  return (
    <div className="flex items-center justify-between border-b px-4 py-2 bg-background">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold">{pipelineName}</h3>
        <Badge variant="outline" className={`text-[10px] ${statusColors[status] || ''}`}>
          {status}
        </Badge>
        {isDirty && <span className="text-[10px] text-muted-foreground italic">Unsaved changes</span>}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onUndo} disabled={!canUndo} title="Undo">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRedo} disabled={!canRedo} title="Redo">
          <Redo2 className="h-4 w-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onImport} title="Import">
          <Upload className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onExport} title="Export">
          <Download className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onVersionHistory} title="Version History">
          <History className="h-4 w-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button
          variant={isSimulating ? 'default' : 'outline'}
          size="sm"
          className="h-8 gap-1.5"
          onClick={onTest}
        >
          <FlaskConical className="h-3.5 w-3.5" />
          {isSimulating ? 'Close Simulator' : 'Simulate'}
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onSave} disabled={isSaving || !isDirty}>
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
        <Button size="sm" className="h-8 gap-1.5" onClick={onDeploy} disabled={isDeploying}>
          {isDeploying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
          Deploy
        </Button>
      </div>
    </div>
  )
}
