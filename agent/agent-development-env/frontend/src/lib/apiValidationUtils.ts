/**
 * API response validation utilities
 * Provides schema validation and sanitization for API responses
 */

import type {
  SanitizeResponse,
  ProcessPdfStatusResponse,
  ProcessPdfResult,
  ChatResponse,
  HealthResponse,
  WebSocketMessage,
} from '@/types/api'

/**
 * Generic validation result
 */
export interface ValidationResult<T = any> {
  isValid: boolean
  data?: T
  errors: string[]
}

/**
 * Validate SanitizeResponse
 */
export function validateSanitizeResponse(
  data: any
): ValidationResult<SanitizeResponse> {
  const errors: string[] = []

  if (typeof data !== 'object' || data === null) {
    errors.push('Response must be an object')
    return { isValid: false, errors }
  }

  if (typeof data.success !== 'boolean') {
    errors.push('success must be a boolean')
  }

  if (
    data.sanitized_content !== undefined &&
    typeof data.sanitized_content !== 'string'
  ) {
    errors.push('sanitized_content must be a string')
  }

  if (
    data.processing_time !== undefined &&
    typeof data.processing_time !== 'string'
  ) {
    errors.push('processing_time must be a string')
  }

  if (data.error !== undefined && typeof data.error !== 'string') {
    errors.push('error must be a string')
  }

  if (errors.length > 0) {
    return { isValid: false, errors }
  }

  return {
    isValid: true,
    data: data as SanitizeResponse,
    errors: [],
  }
}

/**
 * Validate ProcessPdfStatusResponse
 */
export function validateProcessPdfStatusResponse(
  data: any
): ValidationResult<ProcessPdfStatusResponse> {
  const errors: string[] = []

  if (typeof data !== 'object' || data === null) {
    errors.push('Response must be an object')
    return { isValid: false, errors }
  }

  if (typeof data.job_id !== 'string' || data.job_id.trim().length === 0) {
    errors.push('job_id must be a non-empty string')
  }

  if (typeof data.status !== 'string') {
    errors.push('status must be a string')
  }

  if (
    typeof data.progress_percentage !== 'number' ||
    data.progress_percentage < 0 ||
    data.progress_percentage > 100
  ) {
    errors.push('progress_percentage must be a number between 0 and 100')
  }

  if (
    typeof data.estimated_time_remaining !== 'number' ||
    data.estimated_time_remaining < 0
  ) {
    errors.push('estimated_time_remaining must be a non-negative number')
  }

  if (!Array.isArray(data.stages)) {
    errors.push('stages must be an array')
  } else {
    data.stages.forEach((stage: any, index: number) => {
      if (typeof stage !== 'object' || stage === null) {
        errors.push(`stages[${index}] must be an object`)
      } else {
        if (typeof stage.stage !== 'string') {
          errors.push(`stages[${index}].stage must be a string`)
        }
        if (!['in_progress', 'completed', 'failed'].includes(stage.status)) {
          errors.push(
            `stages[${index}].status must be one of: in_progress, completed, failed`
          )
        }
        if (typeof stage.timestamp !== 'string') {
          errors.push(`stages[${index}].timestamp must be a string`)
        }
      }
    })
  }

  if (data.filename !== undefined && typeof data.filename !== 'string') {
    errors.push('filename must be a string')
  }

  if (
    data.file_size !== undefined &&
    (typeof data.file_size !== 'number' || data.file_size < 0)
  ) {
    errors.push('file_size must be a non-negative number')
  }

  if (data.result !== undefined) {
    const resultValidation = validateProcessPdfResult(data.result)
    if (!resultValidation.isValid) {
      errors.push(...resultValidation.errors.map((err) => `result.${err}`))
    }
  }

  if (data.error !== undefined && typeof data.error !== 'string') {
    errors.push('error must be a string')
  }

  if (errors.length > 0) {
    return { isValid: false, errors }
  }

  return {
    isValid: true,
    data: data as ProcessPdfStatusResponse,
    errors: [],
  }
}

/**
 * Validate ProcessPdfResult
 */
export function validateProcessPdfResult(
  data: any
): ValidationResult<ProcessPdfResult> {
  const errors: string[] = []

  if (typeof data !== 'object' || data === null) {
    errors.push('Result must be an object')
    return { isValid: false, errors }
  }

  if (typeof data.success !== 'boolean') {
    errors.push('success must be a boolean')
  }

  if (
    data.sanitized_content !== undefined &&
    typeof data.sanitized_content !== 'string'
  ) {
    errors.push('sanitized_content must be a string')
  }

  if (
    data.enhanced_content !== undefined &&
    typeof data.enhanced_content !== 'string'
  ) {
    errors.push('enhanced_content must be a string')
  }

  if (
    data.structured_output !== undefined &&
    typeof data.structured_output !== 'object'
  ) {
    errors.push('structured_output must be an object')
  }

  if (
    data.processing_time !== undefined &&
    typeof data.processing_time !== 'string'
  ) {
    errors.push('processing_time must be a string')
  }

  if (data.error !== undefined && typeof data.error !== 'string') {
    errors.push('error must be a string')
  }

  if (
    data.extracted_text_length !== undefined &&
    (typeof data.extracted_text_length !== 'number' ||
      data.extracted_text_length < 0)
  ) {
    errors.push('extracted_text_length must be a non-negative number')
  }

  if (errors.length > 0) {
    return { isValid: false, errors }
  }

  return {
    isValid: true,
    data: data as ProcessPdfResult,
    errors: [],
  }
}

/**
 * Validate ChatResponse
 */
export function validateChatResponse(
  data: any
): ValidationResult<ChatResponse> {
  const errors: string[] = []

  if (typeof data !== 'object' || data === null) {
    errors.push('Response must be an object')
    return { isValid: false, errors }
  }

  if (typeof data.success !== 'boolean') {
    errors.push('success must be a boolean')
  }

  if (typeof data.response !== 'string') {
    errors.push('response must be a string')
  }

  if (typeof data.timestamp !== 'string') {
    errors.push('timestamp must be a string')
  }

  if (errors.length > 0) {
    return { isValid: false, errors }
  }

  return {
    isValid: true,
    data: data as ChatResponse,
    errors: [],
  }
}

/**
 * Validate HealthResponse
 */
export function validateHealthResponse(
  data: any
): ValidationResult<HealthResponse> {
  const errors: string[] = []

  if (typeof data !== 'object' || data === null) {
    errors.push('Response must be an object')
    return { isValid: false, errors }
  }

  if (typeof data.status !== 'string') {
    errors.push('status must be a string')
  }

  if (typeof data.timestamp !== 'string') {
    errors.push('timestamp must be a string')
  }

  if (typeof data.version !== 'string') {
    errors.push('version must be a string')
  }

  if (errors.length > 0) {
    return { isValid: false, errors }
  }

  return {
    isValid: true,
    data: data as HealthResponse,
    errors: [],
  }
}

/**
 * Validate WebSocketMessage
 */
export function validateWebSocketMessage(
  data: any
): ValidationResult<WebSocketMessage> {
  const errors: string[] = []

  if (typeof data !== 'object' || data === null) {
    errors.push('Message must be an object')
    return { isValid: false, errors }
  }

  if (
    typeof data.type !== 'string' ||
    !['chunk', 'complete', 'error', 'typing'].includes(data.type)
  ) {
    errors.push('type must be one of: chunk, complete, error, typing')
  }

  if (data.content !== undefined && typeof data.content !== 'string') {
    errors.push('content must be a string')
  }

  if (data.error !== undefined && typeof data.error !== 'string') {
    errors.push('error must be a string')
  }

  if (data.status !== undefined && typeof data.status !== 'boolean') {
    errors.push('status must be a boolean')
  }

  if (errors.length > 0) {
    return { isValid: false, errors }
  }

  return {
    isValid: true,
    data: data as WebSocketMessage,
    errors: [],
  }
}

/**
 * Sanitize API response data for safe display
 */
export function sanitizeApiResponse(data: any): any {
  if (typeof data === 'string') {
    // Basic sanitization for strings
    return data
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/javascript:/gi, '')
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeApiResponse)
  }

  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeApiResponse(value)
    }
    return sanitized
  }

  return data
}
