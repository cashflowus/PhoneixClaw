import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export default function DataSources() {
  const { data: sources } = useQuery({
    queryKey: ['sources'],
    queryFn: () => axios.get('/api/v1/sources').then((r) => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Data Sources</h1>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          Add Source
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(sources || []).map((s: { id: string; display_name: string; connection_status: string; source_type: string }) => (
          <div key={s.id} className="bg-white p-4 rounded-xl shadow-sm border">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold">{s.display_name}</h3>
              <span
                className={`px-2 py-0.5 rounded text-xs ${
                  s.connection_status === 'CONNECTED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {s.connection_status}
              </span>
            </div>
            <p className="text-sm text-gray-500">{s.source_type}</p>
          </div>
        ))}
        {(!sources || sources.length === 0) && (
          <p className="text-gray-500 col-span-full">No data sources configured.</p>
        )}
      </div>
    </div>
  )
}
