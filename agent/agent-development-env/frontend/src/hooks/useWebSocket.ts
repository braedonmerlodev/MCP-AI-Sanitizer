import { useEffect, useRef, useState, useCallback } from 'react'

export interface WebSocketMessage {
  type: 'chunk' | 'complete' | 'error' | 'typing' | 'pong'
  content?: string
  error?: string
  status?: boolean
}

export interface UseWebSocketOptions {
  url: string
  onMessage?: (message: WebSocketMessage) => void
  onError?: (error: Event) => void
  onOpen?: () => void
  onClose?: () => void
  reconnectAttempts?: number
  reconnectInterval?: number
  maxReconnectInterval?: number
  heartbeatInterval?: number
}

export const useWebSocket = ({
  url,
  onMessage,
  onError,
  onOpen,
  onClose,
  reconnectAttempts = 5,
  reconnectInterval = 1000,
  maxReconnectInterval = 30000,
  heartbeatInterval = 30000,
}: UseWebSocketOptions) => {
  const [isConnected, setIsConnected] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectCountRef = useRef(0)
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastPongRef = useRef<number>(Date.now())

  const startHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current)
    }

    heartbeatTimeoutRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Send ping
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
        lastPongRef.current = Date.now()

        // Check for pong response after 10 seconds
        setTimeout(() => {
          if (Date.now() - lastPongRef.current > 10000) {
            // No pong received, close connection
            wsRef.current?.close()
          }
        }, 10000)
      }
    }, heartbeatInterval)
  }, [heartbeatInterval])

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current)
      heartbeatTimeoutRef.current = null
    }
  }, [])

  // Connect function moved here to fix "accessed before declared" error
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        setIsReconnecting(false)
        reconnectCountRef.current = 0
        lastPongRef.current = Date.now()
        startHeartbeat()
        onOpen?.()
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          if (message.type === 'pong') {
            lastPongRef.current = Date.now()
          } else {
            onMessage?.(message)
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        onError?.(error)
      }

      ws.onclose = () => {
        setIsConnected(false)
        stopHeartbeat()
        onClose?.()

        // Attempt reconnection if not manually closed
        if (reconnectCountRef.current < reconnectAttempts) {
          setIsReconnecting(true)
          const delay = Math.min(
            reconnectInterval * Math.pow(2, reconnectCountRef.current),
            maxReconnectInterval
          )
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectCountRef.current++
            connect()
          }, delay)
        }
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      onError?.(error as Event)
    }
  }, [
    url,
    onMessage,
    onError,
    onOpen,
    onClose,
    reconnectAttempts,
    reconnectInterval,
    maxReconnectInterval,
    startHeartbeat,
    stopHeartbeat,
  ])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    stopHeartbeat()
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
    setIsReconnecting(false)
    reconnectCountRef.current = 0
  }, [stopHeartbeat])

  const sendMessage = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
      return true
    }
    return false
  }, [])

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    isConnected,
    isReconnecting,
    sendMessage,
    connect,
    disconnect,
  }
}
