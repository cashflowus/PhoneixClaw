import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export default function TradingAccounts() {
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => axios.get('/api/v1/accounts').then((r) => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Trading Accounts</h1>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          Add Account
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(accounts || []).map(
          (a: { id: string; display_name: string; paper_mode: boolean; broker_type: string; health_status: string }) => (
            <div key={a.id} className="bg-white p-4 rounded-xl shadow-sm border">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold">{a.display_name}</h3>
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    a.paper_mode ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                  }`}
                >
                  {a.paper_mode ? 'Paper' : 'Live'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-1">{a.broker_type}</p>
              <p className="text-xs text-gray-400">Health: {a.health_status}</p>
            </div>
          )
        )}
        {(!accounts || accounts.length === 0) && (
          <p className="text-gray-500 col-span-full">No trading accounts configured.</p>
        )}
      </div>
    </div>
  )
}
