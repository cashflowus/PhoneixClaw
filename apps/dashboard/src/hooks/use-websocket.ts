/**
 * WebSocket hooks for real-time dashboard updates.
 *
 * useWebSocket     — low-level WS connection to a channel
 * useRealtimeQuery — integrates WS events with React Query cache invalidation
 */
import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

const WS_BASE =
  import.meta.env.VITE_WS_URL ??
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v2/ws`

type MessageHandler = (data: unknown) => void

interface UseWebSocketOptions {
  channel: string
  onMessage: MessageHandler
  enabled?: boolean
}

/**
 * Low-level WebSocket hook. Connects to a channel and invokes onMessage for each event.
 */
export function useWebSocket({ channel, onMessage, enabled = true }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const connect = useCallback(() => {
    if (!enabled) return

    const token = localStorage.getItem('phoenix-v2-token')
    const url = `${WS_BASE}/${channel}${token ? `?token=${token}` : ''}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => {
      setConnected(false)
      reconnectTimer.current = setTimeout(connect, 3000)
    }
    ws.onerror = () => ws.close()
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessageRef.current(data)
      } catch {
        // ignore non-JSON messages
      }
    }
  }, [channel, enabled])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { connected, send }
}

/**
 * Channel → React Query keys that should be invalidated when events arrive.
 */
const CHANNEL_QUERY_MAP: Record<string, string[][]> = {
  trades: [['trade-intents'], ['trades']],
  positions: [['positions'], ['positions', 'summary']],
  'backtest-progress': [['backtests'], ['backtest-logs']],
  'agent-status': [['agents'], ['agent-metrics']],
  signals: [['signals'], ['connectors']],
  metrics: [['agent-metrics'], ['metrics']],
  'dev-incidents': [['dev-incidents'], ['dev-agent']],
}

interface UseRealtimeQueryOptions {
  /** WS channel to subscribe to */
  channel: string
  /** React Query keys to invalidate on events. Defaults to CHANNEL_QUERY_MAP lookup. */
  queryKeys?: string[][]
  /** Additional callback on each event */
  onEvent?: (event: { event_type: string; data: unknown }) => void
  /** Enable/disable the subscription */
  enabled?: boolean
}

/**
 * Subscribes to a WebSocket channel and auto-invalidates React Query caches
 * when events arrive, so components re-fetch with fresh data.
 *
 * Usage:
 *   const { connected } = useRealtimeQuery({ channel: 'positions' })
 *   // Your existing useQuery('positions', ...) will auto-refresh on WS events
 */
export function useRealtimeQuery({
  channel,
  queryKeys,
  onEvent,
  enabled = true,
}: UseRealtimeQueryOptions) {
  const queryClient = useQueryClient()

  const handleMessage = useCallback(
    (raw: unknown) => {
      const msg = raw as { event_type?: string; data?: unknown; channel?: string }
      if (!msg?.event_type || msg.event_type === 'connected' || msg.event_type === 'pong') {
        return
      }

      // Invalidate matching query keys
      const keys = queryKeys ?? CHANNEL_QUERY_MAP[channel] ?? []
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key })
      }

      onEvent?.({ event_type: msg.event_type, data: msg.data })
    },
    [channel, queryClient, queryKeys, onEvent],
  )

  return useWebSocket({ channel, onMessage: handleMessage, enabled })
}
