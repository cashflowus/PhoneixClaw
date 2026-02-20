import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'

export default function System() {
  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => axios.get('/api/v1/system/health').then((r) => r.data),
  })
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => axios.get('/api/v1/notifications?limit=10').then((r) => r.data),
  })
  const { logout } = useAuth()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">System</h1>
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h2 className="text-lg font-semibold mb-4">Service Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {health?.services &&
            Object.entries(health.services).map(([name, status]) => (
              <div key={name} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                <div
                  className={`w-2 h-2 rounded-full ${(status as string) === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`}
                />
                <span className="text-sm">{name}</span>
              </div>
            ))}
        </div>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h2 className="text-lg font-semibold mb-4">Recent Notifications</h2>
        {(notifications || []).length === 0 ? (
          <p className="text-gray-500 text-sm">No notifications</p>
        ) : (
          <div className="space-y-2">
            {(notifications || []).map(
              (n: { id: number; title: string; body: string }) => (
                <div key={n.id} className="p-3 rounded-lg bg-gray-50 border">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-gray-500">{n.body}</p>
                </div>
              )
            )}
          </div>
        )}
      </div>
      <button onClick={logout} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
        Sign Out
      </button>
    </div>
  )
}
