// API Response Types

export interface SanitizeRequest {
  content: string
  classification: 'general' | 'llm' | 'api'
}

export interface SanitizeResponse {
  success: boolean
  sanitized_content?: string
  processing_time?: string
  error?: string
}

export interface ProcessPdfJobResponse {
  job_id: string
  status: string
  message: string
}

export interface ProcessingStage {
  stage: string
  status: 'in_progress' | 'completed' | 'failed'
  timestamp: string
  duration?: number
  error?: string
}

export interface ProcessPdfStatusResponse {
  job_id: string
  status: string
  progress_percentage: number
  estimated_time_remaining: number
  stages: ProcessingStage[]
  filename?: string
  file_size?: number
  created_at?: string
  result?: ProcessPdfResult
  error?: string
}

export interface TrustToken {
  contentHash: string
  originalHash: string
  sanitizationVersion: string
  rulesApplied: string[]
  timestamp: string
  expiresAt: string
  signature: string
  nonce: string
}

export interface ProcessPdfResult {
  success: boolean
  sanitized_content?: string
  enhanced_content?: string
  structured_output?: Record<string, any>
  trustToken?: TrustToken
  processing_time?: string
  error?: string
  extracted_text_length?: number
}

export interface ChatMessage {
  message: string
  context?: Record<string, any>
}

export interface ChatResponse {
  success: boolean
  response: string
  timestamp: string
}

export interface HealthResponse {
  status: string
  timestamp: string
  version: string
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: 'chunk' | 'complete' | 'error' | 'typing'
  content?: string
  error?: string
  status?: boolean
}

export interface WebSocketChatMessage {
  message: string
  context?: Record<string, any>
}
