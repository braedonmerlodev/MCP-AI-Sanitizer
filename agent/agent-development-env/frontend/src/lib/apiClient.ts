import axios from 'axios'
import type { AxiosInstance, AxiosResponse, AxiosError } from 'axios'
import { classifyError } from './errorClassifier'
import { globalCircuitBreaker } from './circuitBreaker'
import { offlineManager } from './offlineManager'
import {
  validateSanitizeResponse,
  validateProcessPdfStatusResponse,
  validateChatResponse,
  validateHealthResponse,
  sanitizeApiResponse,
} from './apiValidationUtils'

// Environment configuration
const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
const API_KEY = import.meta.env.VITE_API_KEY || ''

// Cache configuration
const cache = new Map<string, { data: any; timestamp: number }>()

// Retry configuration
const MAX_RETRIES = 10
const BASE_RETRY_DELAY = 1000 // 1 second
const MAX_RETRY_DELAY = 30000 // 30 seconds

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // 30 seconds default
  headers: {
    'Content-Type': 'application/json',
    ...(API_KEY && { Authorization: `Bearer ${API_KEY}` }),
  },
})

// Request interceptor for logging and circuit breaker
apiClient.interceptors.request.use(
  (config) => {
    // Check circuit breaker
    if (globalCircuitBreaker.isOpen()) {
      const circuitError = new Error(
        'Circuit breaker is open. Service temporarily unavailable.'
      )
      ;(circuitError as any).name = 'CircuitBreakerError'
      return Promise.reject(circuitError)
    }

    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('API Request Error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor for caching, logging, circuit breaker, and error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Record success for circuit breaker
    globalCircuitBreaker.recordSuccess()

    const method = response.config.method?.toUpperCase()
    const url = response.config.url
    const cacheKey = `${method}:${url}`

    // Validate and sanitize response data
    try {
      response.data = sanitizeApiResponse(response.data)

      // Schema validation based on endpoint
      if (url?.includes('/api/sanitize')) {
        const validation = validateSanitizeResponse(response.data)
        if (!validation.isValid) {
          console.warn('API response validation failed:', validation.errors)
        }
      } else if (
        url?.includes('/api/process-pdf') &&
        !url.includes('/api/process-pdf/')
      ) {
        // Job creation response
      } else if (url?.includes('/api/process-pdf/')) {
        const validation = validateProcessPdfStatusResponse(response.data)
        if (!validation.isValid) {
          console.warn('API response validation failed:', validation.errors)
        }
      } else if (url?.includes('/api/chat')) {
        const validation = validateChatResponse(response.data)
        if (!validation.isValid) {
          console.warn('API response validation failed:', validation.errors)
        }
      } else if (url?.includes('/health')) {
        const validation = validateHealthResponse(response.data)
        if (!validation.isValid) {
          console.warn('API response validation failed:', validation.errors)
        }
      }
    } catch (error) {
      console.error('Response validation error:', error)
    }

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

    // Handle offline mode
    if (offlineManager.isOffline()) {
      const method = config.method?.toUpperCase()
      const url = config.url

      // For GET requests, return cached response if available
      if (method === 'GET') {
        const cacheKey = `${method}:${url}`
        const cached = cache.get(cacheKey)
        if (cached && Date.now() - cached.timestamp < 300000) {
          // 5 minutes
          console.log('Returning cached response for offline GET:', url)
          return Promise.resolve({
            data: cached.data,
            status: 200,
            statusText: 'OK (cached)',
            headers: {},
            config,
          } as AxiosResponse)
        }
      }

      // Queue the request for later
      offlineManager.queueRequest(
        method || 'GET',
        url || '',
        config.data,
        config.headers
      )

      const offlineError = new Error(
        'Network is offline. Request queued for retry when online.'
      )
      ;(offlineError as any).name = 'OfflineError'
      return Promise.reject(offlineError)
    }

    // Classify the error
    const classification = classifyError(error)

    // Implement retry logic based on error classification
    const retryCount = config._retryCount || 0
    const shouldRetry = retryCount < MAX_RETRIES && classification.isRetryable

    if (shouldRetry) {
      config._retryCount = retryCount + 1
      // Exponential backoff: base * 2^(retry-1), capped at max
      const delay = Math.min(
        BASE_RETRY_DELAY * Math.pow(2, retryCount - 1),
        MAX_RETRY_DELAY
      )
      console.log(
        `Retrying request (${config._retryCount}/${MAX_RETRIES}): ${config.method?.toUpperCase()} ${config.url} - ${classification.userMessage}`
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
      return apiClient(config)
    }

    // Record failure for circuit breaker (only if not a circuit breaker error itself)
    if (error.name !== 'CircuitBreakerError') {
      globalCircuitBreaker.recordFailure()
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
