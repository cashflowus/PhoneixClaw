import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Bell, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  created_at: string | null
}

export default function Notifications() {
  const qc = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications-all'],
    queryFn: () => axios.get('/api/v1/notifications?limit=200').then(r => r.data),
  })

  const markAllRead = useMutation({
    mutationFn: () => axios.patch('/api/v1/notifications/mark-read'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-all'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-unread'] })
    },
  })

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Notifications</h2>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckCheck className="h-4 w-4" />
            Mark All Read
          </Button>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead className="w-28">Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="w-44">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : notifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  <Bell className="h-6 w-6 mx-auto opacity-30 mb-2" />
                  No notifications yet
                </TableCell>
              </TableRow>
            ) : (
              notifications.map(n => (
                <TableRow key={n.id} className={!n.read ? 'bg-primary/5' : ''}>
                  <TableCell>
                    {!n.read && <span className="block h-2 w-2 rounded-full bg-primary" />}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{n.type || 'general'}</Badge>
                  </TableCell>
                  <TableCell className="font-medium text-sm">{n.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                    {n.body}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {n.created_at ? new Date(n.created_at).toLocaleString() : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
