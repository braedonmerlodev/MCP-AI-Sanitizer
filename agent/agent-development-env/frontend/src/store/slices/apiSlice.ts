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
const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
const API_KEY = import.meta.env.VITE_API_KEY || ''

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: BASE_URL,
    prepareHeaders: (headers) => {
      headers.set('Content-Type', 'application/json')
      if (API_KEY) {
        headers.set('Authorization', `Bearer ${API_KEY}`)
      }
      return headers
    },
  }),
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
        url: '/api/process-pdf',
        method: 'POST',
        body: formData,
      }),
    }),

    // Get PDF processing status
    getPdfStatus: builder.query<ProcessPdfStatusResponse, string>({
      query: (jobId) => `/api/process-pdf/${jobId}`,
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
