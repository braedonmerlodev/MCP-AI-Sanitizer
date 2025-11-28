import type { WebSocketMessage, WebSocketChatMessage } from '../types/api'

class WebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectInterval = 1000 // Start with 1 second
  private messageHandlers: ((message: WebSocketMessage) => void)[] = []
  private connectionHandlers: ((connected: boolean) => void)[] = []

  constructor(url: string) {
    this.url = url
  }

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return
    }

    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.reconnectAttempts = 0
        this.reconnectInterval = 1000
        this.connectionHandlers.forEach((handler) => handler(true))
      }

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          this.messageHandlers.forEach((handler) => handler(message))
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      this.ws.onclose = () => {
        console.log('WebSocket disconnected')
        this.connectionHandlers.forEach((handler) => handler(false))
        this.attemptReconnect()
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      this.attemptReconnect()
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  sendMessage(message: WebSocketChatMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.error('WebSocket is not connected')
    }
  }

  onMessage(handler: (message: WebSocketMessage) => void): void {
    this.messageHandlers.push(handler)
  }

  onConnectionChange(handler: (connected: boolean) => void): void {
    this.connectionHandlers.push(handler)
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectInterval}ms`
    )

    setTimeout(() => {
      this.reconnectInterval = Math.min(this.reconnectInterval * 2, 30000) // Exponential backoff, max 30s
      this.connect()
    }, this.reconnectInterval)
  }
}

// Create WebSocket client instance
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/chat'
const wsClient = new WebSocketClient(WS_URL)

export default wsClient
