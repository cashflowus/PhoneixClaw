import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'

export default function Analytics() {
  const { data: metrics } = useQuery({
    queryKey: ['analytics-metrics'],
    queryFn: () => axios.get('/api/v1/metrics/daily?days=30').then((r) => r.data),
  })

  const cumulativePnl = (metrics || []).reduce(
    (acc: { date: string; cumulative: number; daily: number }[], m: { date: string; total_pnl?: number }) => {
      const prev = acc.length > 0 ? acc[acc.length - 1].cumulative : 0
      acc.push({
        date: m.date,
        cumulative: prev + (m.total_pnl || 0),
        daily: m.total_pnl || 0,
      })
      return acc
    },
    []
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h2 className="text-lg font-semibold mb-4">Cumulative P&L</h2>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={cumulativePnl}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="cumulative" stroke="#3b82f6" fill="#dbeafe" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h2 className="text-lg font-semibold mb-4">Win Rate Trend</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart
            data={(metrics || []).map((m: { date: string; winning_trades?: number; total_trades?: number }) => ({
              date: m.date,
              winRate:
                m.winning_trades && m.total_trades ? Math.round((m.winning_trades / m.total_trades) * 100) : 0,
            }))}
          >
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="winRate" stroke="#10b981" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
