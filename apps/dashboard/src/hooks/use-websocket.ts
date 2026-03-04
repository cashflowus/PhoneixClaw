/**
 * WebSocket hook for real-time dashboard updates.
 * Connects to ws-gateway and subscribes to channels.
 */
import { useEffect, useRef, useCallback, useState } from 'react'

const WS_BASE = import.meta.env.VITE_WS_URL ?? `ws://${window.location.host}/ws`

type MessageHandler = (data: unknown) => void

interface UseWebSocketOptions {
  channel: string
  onMessage: MessageHandler
  enabled?: boolean
}

export function useWebSocket({ channel, onMessage, enabled = true }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()

  const connect = useCallback(() => {
    if (!enabled) return

    const token = localStorage.getItem('phoenix-v2-token')
    const url = `${WS_BASE}?channel=${channel}&token=${token ?? ''}`

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
        onMessage(data)
      } catch {
        // ignore non-JSON messages
      }
    }
  }, [channel, enabled, onMessage])

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
