import axios from 'axios'
import type { AxiosInstance, AxiosResponse, AxiosError } from 'axios'

// Environment configuration
const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
const API_KEY = import.meta.env.VITE_API_KEY || ''

// Cache configuration
const cache = new Map<string, { data: any; timestamp: number }>()

// Retry configuration
const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // 1 second

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // 30 seconds default
  headers: {
    'Content-Type': 'application/json',
    ...(API_KEY && { Authorization: `Bearer ${API_KEY}` }),
  },
})

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('API Request Error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor for caching, logging, and error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const method = response.config.method?.toUpperCase()
    const url = response.config.url
    const cacheKey = `${method}:${url}`

    // For GET requests, cache the response
    if (method === 'GET') {
      cache.set(cacheKey, { data: response.data, timestamp: Date.now() })
    }

    console.log(`API Response: ${response.status} ${url}`)
    return response
  },
  async (error: AxiosError) => {
    const config = error.config as any
    if (!config) return Promise.reject(error)

    // Implement retry logic for network errors and 5xx responses
    const retryCount = config._retryCount || 0
    const shouldRetry =
      retryCount < MAX_RETRIES &&
      (error.code === 'NETWORK_ERROR' ||
        error.code === 'TIMEOUT' ||
        (error.response && error.response.status >= 500))

    if (shouldRetry) {
      config._retryCount = retryCount + 1
      console.log(
        `Retrying request (${config._retryCount}/${MAX_RETRIES}): ${config.method?.toUpperCase()} ${config.url}`
      )
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAY * config._retryCount)
      )
      return apiClient(config)
    }

    if (error.response) {
      // Server responded with error status
      console.error(`API Error ${error.response.status}:`, error.response.data)
    } else if (error.request) {
      // Network error
      console.error('API Network Error:', error.message)
    } else {
      // Other error
      console.error('API Error:', error.message)
    }
    return Promise.reject(error)
  }
)

export default apiClient
