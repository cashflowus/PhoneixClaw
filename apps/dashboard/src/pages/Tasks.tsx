import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DndContext, DragEndEvent, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import api from '@/lib/api'
import { FlexCard } from '@/components/ui/FlexCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, User, GripVertical } from 'lucide-react'

const COLUMNS = ['BACKLOG', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED'] as const
type ColumnStatus = (typeof COLUMNS)[number]

const COLUMN_LABELS: Record<ColumnStatus, string> = {
  BACKLOG: 'Backlog',
  IN_PROGRESS: 'In Progress',
  UNDER_REVIEW: 'Under Review',
  COMPLETED: 'Completed',
}

const COLUMN_COLORS: Record<ColumnStatus, string> = {
  BACKLOG: 'border-t-zinc-500',
  IN_PROGRESS: 'border-t-blue-500',
  UNDER_REVIEW: 'border-t-amber-500',
  COMPLETED: 'border-t-emerald-500',
}

type Priority = 'low' | 'medium' | 'high' | 'critical'

const PRIORITY_CONFIG: Record<Priority, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  medium: { label: 'Medium', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  high: { label: 'High', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  critical: { label: 'Critical', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
}

const AGENT_ROLES = [
  { value: 'day-trader', label: 'Day Trader' },
  { value: 'technical-analyst', label: 'Technical Analyst' },
  { value: 'risk-analyzer', label: 'Risk Analyzer' },
  { value: 'sentiment-analyst', label: 'Sentiment Analyst' },
  { value: 'portfolio-manager', label: 'Portfolio Manager' },
]

interface Task {
  id: string
  title: string
  description?: string
  status: ColumnStatus
  agent_role: string
  priority: Priority
  created_at: string
}

interface NewTaskForm {
  title: string
  description: string
  agent_role: string
  priority: Priority
}

const INITIAL_FORM: NewTaskForm = {
  title: '',
  description: '',
  agent_role: 'day-trader',
  priority: 'medium',
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const config = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.className}`}>
      {config.label}
    </span>
  )
}

function SortableTaskCard({ task, onDelete }: { task: Task; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group p-3 rounded-lg border bg-background hover:border-primary/30 transition-colors"
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-sm leading-snug">{task.title}</span>
            <PriorityBadge priority={task.priority} />
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {task.agent_role.replace(/-/g, ' ')}
              </Badge>
            </div>
            <StatusBadge status={task.status} className="text-[10px]" />
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-destructive hover:text-destructive"
          onClick={() => onDelete(task.id)}
        >
          Delete
        </Button>
      </div>
    </div>
  )
}

function TaskOverlayCard({ task }: { task: Task }) {
  return (
    <div className="p-3 rounded-lg border bg-background shadow-lg ring-2 ring-primary/20">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm">{task.title}</span>
        <PriorityBadge priority={task.priority} />
      </div>
      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
        <User className="h-3 w-3" />
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {task.agent_role.replace(/-/g, ' ')}
        </Badge>
      </div>
    </div>
  )
}

function KanbanColumn({
  status,
  tasks,
  onDelete,
}: {
  status: ColumnStatus
  tasks: Task[]
  onDelete: (id: string) => void
}) {
  const taskIds = tasks.map((t) => t.id)

  return (
    <FlexCard
      title={`${COLUMN_LABELS[status]} (${tasks.length})`}
      className={`min-h-[280px] border-t-2 ${COLUMN_COLORS[status]}`}
    >
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[60px]">
          {tasks.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">No tasks</p>
          )}
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} onDelete={onDelete} />
          ))}
        </div>
      </SortableContext>
    </FlexCard>
  )
}

export default function TasksPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [newTask, setNewTask] = useState<NewTaskForm>(INITIAL_FORM)
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const res = await api.get('/api/v2/tasks')
      return res.data
    },
  })

  const moveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/api/v2/tasks/${id}/move`, { status })
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const previous = queryClient.getQueryData<Task[]>(['tasks'])
      queryClient.setQueryData<Task[]>(['tasks'], (old) =>
        old?.map((t) => (t.id === id ? { ...t, status: status as ColumnStatus } : t)),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['tasks'], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload: { title: string; description: string; agent_role: string; status: string; priority: string }) => {
      const res = await api.post('/api/v2/tasks', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setNewTask(INITIAL_FORM)
      setCreateOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/v2/tasks/${id}`)
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const previous = queryClient.getQueryData<Task[]>(['tasks'])
      queryClient.setQueryData<Task[]>(['tasks'], (old) => old?.filter((t) => t.id !== id))
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['tasks'], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const tasksByColumn = (status: ColumnStatus) => tasks.filter((t) => t.status === status)

  function findColumnForTask(taskId: string): ColumnStatus | undefined {
    const task = tasks.find((t) => t.id === taskId)
    return task?.status as ColumnStatus | undefined
  }

  function handleDragStart(event: DragEndEvent) {
    const task = tasks.find((t) => t.id === event.active.id)
    setActiveTask(task ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    const sourceColumn = findColumnForTask(activeId)

    let targetColumn: ColumnStatus | undefined
    if (COLUMNS.includes(overId as ColumnStatus)) {
      targetColumn = overId as ColumnStatus
    } else {
      targetColumn = findColumnForTask(overId)
    }

    if (!sourceColumn || !targetColumn || sourceColumn === targetColumn) return

    moveMutation.mutate({ id: activeId, status: targetColumn })
  }

  function handleCreate() {
    if (!newTask.title.trim()) return
    createMutation.mutate({
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      agent_role: newTask.agent_role,
      status: 'BACKLOG',
      priority: newTask.priority,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tasks</h2>
          <p className="text-muted-foreground text-sm">Kanban board with agent role assignment</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Create Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  value={newTask.title}
                  onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Task title"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input
                  value={newTask.description}
                  onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Assign Agent Role</Label>
                <Select
                  value={newTask.agent_role}
                  onValueChange={(v) => setNewTask((prev) => ({ ...prev, agent_role: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={(v) => setNewTask((prev) => ({ ...prev, priority: v as Priority }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-2">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              p === 'low' ? 'bg-slate-400' :
                              p === 'medium' ? 'bg-blue-500' :
                              p === 'high' ? 'bg-orange-500' :
                              'bg-red-500'
                            }`}
                          />
                          {PRIORITY_CONFIG[p].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={!newTask.title.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col}
              status={col}
              tasks={tasksByColumn(col)}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
          {activeTask ? <TaskOverlayCard task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
