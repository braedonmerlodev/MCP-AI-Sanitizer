import apiClient from './apiClient'

interface QueuedRequest {
  id: string
  method: string
  url: string
  data?: any
  headers?: any
  timestamp: number
}

const QUEUE_KEY = 'offline-request-queue'
const MAX_QUEUE_SIZE = 50

class OfflineManager {
  private isOnline = navigator.onLine
  private processingQueue = false

  constructor() {
    // Listen to online/offline events
    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))

    // Also listen to visibility change for more robust detection
    document.addEventListener(
      'visibilitychange',
      this.handleVisibilityChange.bind(this)
    )
  }

  private handleOnline() {
    console.log('Network: Online')
    this.isOnline = true
    this.processQueue()
  }

  private handleOffline() {
    console.log('Network: Offline')
    this.isOnline = false
  }

  private handleVisibilityChange() {
    // When tab becomes visible, check online status
    if (!document.hidden && navigator.onLine !== this.isOnline) {
      this.isOnline = navigator.onLine
      if (this.isOnline) {
        this.processQueue()
      }
    }
  }

  isOffline(): boolean {
    return !this.isOnline
  }

  queueRequest(method: string, url: string, data?: any, headers?: any): void {
    if (!this.isOffline()) return

    const queue = this.getQueue()
    const request: QueuedRequest = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      method,
      url,
      data,
      headers,
      timestamp: Date.now(),
    }

    queue.push(request)

    // Limit queue size
    if (queue.length > MAX_QUEUE_SIZE) {
      queue.shift() // Remove oldest
    }

    this.saveQueue(queue)
    console.log('Request queued for offline mode:', method, url)
  }

  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.isOffline()) return

    this.processingQueue = true
    const queue = this.getQueue()

    while (queue.length > 0 && !this.isOffline()) {
      const request = queue.shift()
      if (!request) break

      try {
        await apiClient.request({
          method: request.method as any,
          url: request.url,
          data: request.data,
          headers: request.headers,
        })
        console.log('Processed queued request:', request.method, request.url)
      } catch (error) {
        console.error('Failed to process queued request:', error)
        // Re-queue if it's a retryable error
        // For simplicity, don't re-queue on failure
      }
    }

    this.saveQueue(queue)
    this.processingQueue = false
  }

  private getQueue(): QueuedRequest[] {
    try {
      const stored = localStorage.getItem(QUEUE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  private saveQueue(queue: QueuedRequest[]): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
    } catch (error) {
      console.error('Failed to save request queue:', error)
    }
  }
}

export const offlineManager = new OfflineManager()
