import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type {
  SanitizeRequest,
  SanitizeResponse,
  ProcessPdfJobResponse,
  ProcessPdfStatusResponse,
  ChatMessage,
  ChatResponse,
  HealthResponse,
} from '../../types/api'

// Environment configuration
const BASE_URL = import.meta.env.VITE_BACKEND_URL || ''

const baseQueryWithAuth = fetchBaseQuery({
  baseUrl: BASE_URL,
  prepareHeaders: (headers, { getState, endpoint }) => {
    // Don't set Content-Type for FormData endpoints
    if (endpoint !== 'processPdf') {
      headers.set('Content-Type', 'application/json')
    }
    // Get API key from auth state
    const state = getState() as any
    const apiKey = state.auth?.apiKey
    if (apiKey) {
      headers.set('Authorization', `Bearer ${apiKey}`)
    }
    return headers
  },
})

// Enhanced base query with auth and rate limit handling
const baseQueryWithRetry = async (args: any, api: any, extraOptions: any) => {
  let result = await baseQueryWithAuth(args, api, extraOptions)

  // Handle authentication errors
  if (result.error?.status === 401) {
    // Dispatch logout action
    api.dispatch({ type: 'auth/logout' })
    return result
  }

  // Handle rate limiting with exponential backoff
  if (result.error?.status === 429) {
    const retryCount = args._retryCount || 0
    const maxRetries = 3
    const baseDelay = 1000 // 1 second

    if (retryCount < maxRetries) {
      const delay = baseDelay * Math.pow(2, retryCount)
      await new Promise((resolve) => setTimeout(resolve, delay))

      // Retry with incremented count
      return baseQueryWithRetry(
        { ...args, _retryCount: retryCount + 1 },
        api,
        extraOptions
      )
    }
  }

  return result
}

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithRetry,
  endpoints: (builder) => ({
    // Sanitize content
    sanitizeContent: builder.mutation<SanitizeResponse, SanitizeRequest>({
      query: (body) => ({
        url: '/api/sanitize/json',
        method: 'POST',
        body,
      }),
    }),

    // Process PDF
    processPdf: builder.mutation<ProcessPdfJobResponse, FormData>({
      query: (formData) => ({
        url: '/api/documents/upload',
        method: 'POST',
        body: formData,
        formData: true, // This tells RTK Query to not set Content-Type header
      }),
    }),

    // Get PDF processing status
    getPdfStatus: builder.query<ProcessPdfStatusResponse, string>({
      query: (jobId) => `/api/documents/${jobId}/status`,
    }),

    // Chat
    sendChat: builder.mutation<ChatResponse, ChatMessage>({
      query: (body) => ({
        url: '/api/chat',
        method: 'POST',
        body,
      }),
    }),

    // Health check
    getHealth: builder.query<HealthResponse, void>({
      query: () => '/health',
    }),
  }),
})

export const {
  useSanitizeContentMutation,
  useProcessPdfMutation,
  useGetPdfStatusQuery,
  useSendChatMutation,
  useGetHealthQuery,
} = apiSlice
