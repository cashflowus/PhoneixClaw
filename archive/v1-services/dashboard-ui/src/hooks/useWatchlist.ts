import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from './useAuth'

export interface WatchlistItem {
  id: string
  ticker: string
  notes: string | null
  created_at: string
}

const API = '/api/v1/watchlist'

export function useWatchlist() {
  const { token } = useAuth()
  const qc = useQueryClient()
  const headers = { Authorization: `Bearer ${token}` }

  const query = useQuery<WatchlistItem[]>({
    queryKey: ['watchlist'],
    queryFn: async () => {
      const { data } = await axios.get(API, { headers })
      return data
    },
    enabled: !!token,
  })

  const addMutation = useMutation({
    mutationFn: async ({ ticker, notes }: { ticker: string; notes?: string }) => {
      const { data } = await axios.post(API, { ticker, notes }, { headers })
      return data as WatchlistItem
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  })

  const removeMutation = useMutation({
    mutationFn: async (ticker: string) => {
      await axios.delete(`${API}/${ticker}`, { headers })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  })

  const isInWatchlist = (ticker: string): boolean => {
    return (query.data ?? []).some(w => w.ticker === ticker.toUpperCase())
  }

  return {
    watchlist: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    addToWatchlist: addMutation.mutateAsync,
    removeFromWatchlist: removeMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
    isInWatchlist,
    refetch: query.refetch,
  }
}
