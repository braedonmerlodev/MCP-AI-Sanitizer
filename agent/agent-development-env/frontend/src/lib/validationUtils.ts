/**
 * Validation utilities for client-side input validation
 * Provides comprehensive validation functions for different input types
 */

export interface ValidationResult {
  isValid: boolean
  error?: string
  sanitizedValue?: string
}

export interface ValidationOptions {
  minLength?: number
  maxLength?: number
  required?: boolean
  pattern?: RegExp
  customValidator?: (value: string) => ValidationResult
}

/**
 * Validate chat message input
 */
export function validateChatMessage(message: string): ValidationResult {
  if (!message || message.trim().length === 0) {
    return { isValid: false, error: 'Message cannot be empty' }
  }

  const trimmed = message.trim()

  if (trimmed.length > 10000) {
    return { isValid: false, error: 'Message too long (max 10,000 characters)' }
  }

  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<object[^>]*>.*?<\/object>/gi,
    /<embed[^>]*>.*?<\/embed>/gi,
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      return {
        isValid: false,
        error: 'Message contains potentially dangerous content',
      }
    }
  }

  return { isValid: true, sanitizedValue: trimmed }
}

/**
 * Validate API key input
 */
export function validateApiKey(apiKey: string): ValidationResult {
  if (!apiKey || apiKey.trim().length === 0) {
    return { isValid: false, error: 'API key is required' }
  }

  const trimmed = apiKey.trim()

  // API keys should be alphanumeric with some special chars, reasonable length
  if (trimmed.length < 10) {
    return {
      isValid: false,
      error: 'API key too short (minimum 10 characters)',
    }
  }

  if (trimmed.length > 200) {
    return {
      isValid: false,
      error: 'API key too long (maximum 200 characters)',
    }
  }

  // Allow alphanumeric, hyphens, underscores, dots
  const apiKeyPattern = /^[a-zA-Z0-9\-_.]+$/
  if (!apiKeyPattern.test(trimmed)) {
    return { isValid: false, error: 'API key contains invalid characters' }
  }

  return { isValid: true, sanitizedValue: trimmed }
}

/**
 * Generic input validation function
 */
export function validateInput(
  value: string,
  options: ValidationOptions = {}
): ValidationResult {
  const {
    minLength = 0,
    maxLength = 1000000,
    required = false,
    pattern,
    customValidator,
  } = options

  if (required && (!value || value.trim().length === 0)) {
    return { isValid: false, error: 'This field is required' }
  }

  const trimmed = value.trim()

  if (trimmed.length < minLength) {
    return {
      isValid: false,
      error: `Minimum length is ${minLength} characters`,
    }
  }

  if (trimmed.length > maxLength) {
    return {
      isValid: false,
      error: `Maximum length is ${maxLength} characters`,
    }
  }

  if (pattern && !pattern.test(trimmed)) {
    return { isValid: false, error: 'Input format is invalid' }
  }

  if (customValidator) {
    const customResult = customValidator(trimmed)
    if (!customResult.isValid) {
      return customResult
    }
  }

  return { isValid: true, sanitizedValue: trimmed }
}

/**
 * Validate email input
 */
export function validateEmail(email: string): ValidationResult {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const baseValidation = validateInput(email, {
    required: true,
    maxLength: 254, // RFC 5321 limit
    pattern: emailPattern,
  })

  if (!baseValidation.isValid) {
    return baseValidation
  }

  return { isValid: true, sanitizedValue: email.toLowerCase().trim() }
}

/**
 * Validate filename for uploads
 */
export function validateFilename(filename: string): ValidationResult {
  if (!filename || filename.trim().length === 0) {
    return { isValid: false, error: 'Filename is required' }
  }

  const trimmed = filename.trim()

  if (trimmed.length > 255) {
    return { isValid: false, error: 'Filename too long' }
  }

  // Check for dangerous characters in filename
  const dangerousChars = /[<>:"|?*\x00-\x1f]/g
  if (dangerousChars.test(trimmed)) {
    return { isValid: false, error: 'Filename contains invalid characters' }
  }

  // Check for path traversal attempts
  if (
    trimmed.includes('..') ||
    trimmed.includes('/') ||
    trimmed.includes('\\')
  ) {
    return {
      isValid: false,
      error: 'Filename contains invalid path characters',
    }
  }

  return { isValid: true, sanitizedValue: trimmed }
}

/**
 * Real-time validation hook helper
 */
export function createValidationHook(
  validator: (value: string) => ValidationResult
) {
  return (value: string): ValidationResult => {
    return validator(value)
  }
}
