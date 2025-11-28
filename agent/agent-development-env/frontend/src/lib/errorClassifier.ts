import type { AxiosError } from 'axios'

export interface ErrorClassification {
  isRetryable: boolean
  category: 'network' | 'server' | 'client' | 'auth' | 'timeout' | 'unknown'
  userMessage: string
}

export function classifyError(error: AxiosError): ErrorClassification {
  // Network errors
  if (!error.response && error.code === 'NETWORK_ERROR') {
    return {
      isRetryable: true,
      category: 'network',
      userMessage: 'Network connection lost. Retrying automatically...',
    }
  }

  // Timeout errors
  if (error.code === 'TIMEOUT') {
    return {
      isRetryable: true,
      category: 'timeout',
      userMessage: 'Request timed out. Retrying automatically...',
    }
  }

  // Server errors (5xx)
  if (error.response && error.response.status >= 500) {
    return {
      isRetryable: true,
      category: 'server',
      userMessage: 'Server error occurred. Retrying automatically...',
    }
  }

  // Rate limiting (429)
  if (error.response && error.response.status === 429) {
    return {
      isRetryable: true,
      category: 'server',
      userMessage: 'Too many requests. Retrying with backoff...',
    }
  }

  // Client errors (4xx)
  if (
    error.response &&
    error.response.status >= 400 &&
    error.response.status < 500
  ) {
    // Auth errors
    if (error.response.status === 401 || error.response.status === 403) {
      return {
        isRetryable: false,
        category: 'auth',
        userMessage:
          'Authentication failed. Please check your credentials and try again.',
      }
    }

    // Validation errors
    if (error.response.status === 400 || error.response.status === 422) {
      return {
        isRetryable: false,
        category: 'client',
        userMessage:
          'Invalid request data. Please check your input and try again.',
      }
    }

    // Not found
    if (error.response.status === 404) {
      return {
        isRetryable: false,
        category: 'client',
        userMessage: 'Resource not found. Please check the URL and try again.',
      }
    }

    // Other 4xx
    return {
      isRetryable: false,
      category: 'client',
      userMessage: 'Request error. Please try again later.',
    }
  }

  // Unknown errors
  return {
    isRetryable: false,
    category: 'unknown',
    userMessage: 'An unexpected error occurred. Please try again.',
  }
}

export function getUserFriendlyMessage(error: AxiosError): string {
  return classifyError(error).userMessage
}
