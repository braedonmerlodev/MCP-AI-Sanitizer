import {
  validateChatMessage,
  validateApiKey,
  validateInput,
  validateEmail,
  validateFilename,
} from './validationUtils'

describe('validateChatMessage', () => {
  it('should validate valid chat messages', () => {
    const result = validateChatMessage('Hello, how are you?')
    expect(result.isValid).toBe(true)
    expect(result.sanitizedValue).toBe('Hello, how are you?')
  })

  it('should reject empty messages', () => {
    const result = validateChatMessage('')
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('Message cannot be empty')
  })

  it('should reject messages that are too long', () => {
    const longMessage = 'a'.repeat(10001)
    const result = validateChatMessage(longMessage)
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('Message too long (max 10,000 characters)')
  })

  it('should reject messages with dangerous content', () => {
    const result = validateChatMessage('<script>alert("xss")</script>')
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('Message contains potentially dangerous content')
  })

  it('should trim whitespace', () => {
    const result = validateChatMessage('  hello  ')
    expect(result.isValid).toBe(true)
    expect(result.sanitizedValue).toBe('hello')
  })
})

describe('validateApiKey', () => {
  it('should validate valid API keys', () => {
    const result = validateApiKey('sk-1234567890abcdef')
    expect(result.isValid).toBe(true)
    expect(result.sanitizedValue).toBe('sk-1234567890abcdef')
  })

  it('should reject empty API keys', () => {
    const result = validateApiKey('')
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('API key is required')
  })

  it('should reject API keys that are too short', () => {
    const result = validateApiKey('123')
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('API key too short (minimum 10 characters)')
  })

  it('should reject API keys that are too long', () => {
    const longKey = 'a'.repeat(201)
    const result = validateApiKey(longKey)
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('API key too long (maximum 200 characters)')
  })

  it('should reject API keys with invalid characters', () => {
    const result = validateApiKey('sk-123@invalid')
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('API key contains invalid characters')
  })

  it('should trim whitespace', () => {
    const result = validateApiKey('  sk-1234567890  ')
    expect(result.isValid).toBe(true)
    expect(result.sanitizedValue).toBe('sk-1234567890')
  })
})

describe('validateInput', () => {
  it('should validate with custom options', () => {
    const result = validateInput('test', {
      required: true,
      minLength: 2,
      maxLength: 10,
    })
    expect(result.isValid).toBe(true)
    expect(result.sanitizedValue).toBe('test')
  })

  it('should reject when required but empty', () => {
    const result = validateInput('', { required: true })
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('This field is required')
  })

  it('should reject when too short', () => {
    const result = validateInput('a', { minLength: 2 })
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('Minimum length is 2 characters')
  })

  it('should reject when too long', () => {
    const result = validateInput('abcdefghijk', { maxLength: 5 })
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('Maximum length is 5 characters')
  })

  it('should validate with regex pattern', () => {
    const result = validateInput('123', { pattern: /^\d+$/ })
    expect(result.isValid).toBe(true)
  })

  it('should reject when pattern does not match', () => {
    const result = validateInput('abc', { pattern: /^\d+$/ })
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('Input format is invalid')
  })
})

describe('validateEmail', () => {
  it('should validate valid emails', () => {
    const result = validateEmail('test@example.com')
    expect(result.isValid).toBe(true)
    expect(result.sanitizedValue).toBe('test@example.com')
  })

  it('should reject invalid emails', () => {
    const result = validateEmail('invalid-email')
    expect(result.isValid).toBe(false)
  })

  it('should convert to lowercase', () => {
    const result = validateEmail('Test@Example.COM')
    expect(result.isValid).toBe(true)
    expect(result.sanitizedValue).toBe('test@example.com')
  })
})

describe('validateFilename', () => {
  it('should validate valid filenames', () => {
    const result = validateFilename('document.pdf')
    expect(result.isValid).toBe(true)
    expect(result.sanitizedValue).toBe('document.pdf')
  })

  it('should reject empty filenames', () => {
    const result = validateFilename('')
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('Filename is required')
  })

  it('should reject filenames with dangerous characters', () => {
    const result = validateFilename('doc<script>.pdf')
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('Filename contains invalid characters')
  })

  it('should reject filenames with path traversal', () => {
    const result = validateFilename('../../../etc/passwd')
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('Filename contains invalid path characters')
  })

  it('should trim whitespace', () => {
    const result = validateFilename('  file.txt  ')
    expect(result.isValid).toBe(true)
    expect(result.sanitizedValue).toBe('file.txt')
  })
})
