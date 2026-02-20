import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
  const { data: trades } = useQuery({
    queryKey: ['trades'],
    queryFn: () => axios.get('/api/v1/trades?limit=20').then((r) => r.data),
  })
  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => axios.get('/api/v1/metrics/daily?days=7').then((r) => r.data),
  })

  const stats = {
    total: trades?.length || 0,
    executed: trades?.filter((t: { status: string }) => t.status === 'EXECUTED').length || 0,
    rejected: trades?.filter((t: { status: string }) => t.status === 'REJECTED').length || 0,
    errored: trades?.filter((t: { status: string }) => t.status === 'ERROR').length || 0,
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'blue' },
          { label: 'Executed', value: stats.executed, color: 'green' },
          { label: 'Rejected', value: stats.rejected, color: 'yellow' },
          { label: 'Errors', value: stats.errored, color: 'red' },
        ].map((s) => (
          <div key={s.label} className="bg-white p-4 rounded-xl shadow-sm border">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>
      {metrics && metrics.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h2 className="text-lg font-semibold mb-4">Daily P&L</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total_pnl" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Recent Trades</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Ticker', 'Action', 'Strike', 'Price', 'Status', 'Time'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-medium text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(trades || []).map((t: { trade_id: string; ticker: string; action: string; strike: number; price: number; status: string; created_at: string }) => (
                <tr key={t.trade_id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{t.ticker}</td>
                  <td className="px-4 py-2">
                    <span className={t.action === 'BUY' ? 'text-green-600' : 'text-red-600'}>{t.action}</span>
                  </td>
                  <td className="px-4 py-2">{t.strike}</td>
                  <td className="px-4 py-2">${t.price?.toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        t.status === 'EXECUTED'
                          ? 'bg-green-100 text-green-800'
                          : t.status === 'ERROR'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {t.created_at ? new Date(t.created_at).toLocaleString() : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
