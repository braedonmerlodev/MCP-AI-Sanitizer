import { classifyError, getUserFriendlyMessage } from './errorClassifier'

describe('errorClassifier', () => {
  it('classifies network error as retryable', () => {
    const error = {
      code: 'NETWORK_ERROR',
      message: 'Network Error',
    } as any

    const result = classifyError(error)
    expect(result.isRetryable).toBe(true)
    expect(result.category).toBe('network')
    expect(result.userMessage).toContain('Network connection lost')
  })

  it('classifies timeout as retryable', () => {
    const error = {
      code: 'TIMEOUT',
      message: 'Timeout',
    } as any

    const result = classifyError(error)
    expect(result.isRetryable).toBe(true)
    expect(result.category).toBe('timeout')
  })

  it('classifies 5xx error as retryable', () => {
    const error = {
      response: { status: 500, data: 'Server Error' },
    } as any

    const result = classifyError(error)
    expect(result.isRetryable).toBe(true)
    expect(result.category).toBe('server')
  })

  it('classifies 4xx error as non-retryable', () => {
    const error = {
      response: { status: 404, data: 'Not Found' },
    } as any

    const result = classifyError(error)
    expect(result.isRetryable).toBe(false)
    expect(result.category).toBe('client')
  })

  it('classifies auth error as non-retryable', () => {
    const error = {
      response: { status: 401, data: 'Unauthorized' },
    } as any

    const result = classifyError(error)
    expect(result.isRetryable).toBe(false)
    expect(result.category).toBe('auth')
  })

  it('returns user friendly message', () => {
    const error = {
      response: { status: 500, data: 'Server Error' },
    } as any

    const message = getUserFriendlyMessage(error)
    expect(message).toContain('Server error occurred')
  })
})
