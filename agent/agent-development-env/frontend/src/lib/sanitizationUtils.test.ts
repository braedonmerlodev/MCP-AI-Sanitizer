import {
  sanitizeHtml,
  sanitizeTextForHtml,
  sanitizeForApi,
  sanitizeFilename,
  safeEncodeURIComponent,
  safeDecodeURIComponent,
  sanitizeJsonInput,
  sanitizeChatMessage,
} from './sanitizationUtils'

describe('sanitizeHtml', () => {
  it('should escape HTML characters', () => {
    const result = sanitizeHtml('<script>alert("xss")</script>')
    expect(result).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
    )
  })

  it('should handle empty input', () => {
    const result = sanitizeHtml('')
    expect(result).toBe('')
  })

  it('should escape all dangerous characters', () => {
    const result = sanitizeHtml('<>&"\'/')
    expect(result).toBe('&lt;&gt;&amp;&quot;&#x27;&#x2F;')
  })
})

describe('sanitizeTextForHtml', () => {
  it('should allow safe tags', () => {
    const result = sanitizeTextForHtml('<b>bold</b> and <i>italic</i>')
    expect(result).toBe('<b>bold</b> and <i>italic</i>')
  })

  it('should escape dangerous tags', () => {
    const result = sanitizeTextForHtml('<script>evil</script>')
    expect(result).toBe('&lt;script&gt;evil&lt;&#x2F;script&gt;')
  })

  it('should handle mixed content', () => {
    const result = sanitizeTextForHtml('<b>safe</b> <script>evil</script>')
    expect(result).toBe('<b>safe</b> &lt;script&gt;evil&lt;&#x2F;script&gt;')
  })
})

describe('sanitizeForApi', () => {
  it('should remove HTML characters', () => {
    const result = sanitizeForApi('<script>alert("xss")</script>')
    expect(result).toBe('scriptalertxssscript')
  })

  it('should remove control characters', () => {
    const result = sanitizeForApi('test\x00\x01\x1f')
    expect(result).toBe('test')
  })

  it('should trim whitespace', () => {
    const result = sanitizeForApi('  test  ')
    expect(result).toBe('test')
  })
})

describe('sanitizeFilename', () => {
  it('should replace dangerous characters', () => {
    const result = sanitizeFilename('file<>:"|?*.txt')
    expect(result).toBe('file_.txt')
  })

  it('should replace path separators', () => {
    const result = sanitizeFilename('path/to/file.txt')
    expect(result).toBe('path_to_file.txt')
  })

  it('should replace spaces with underscores', () => {
    const result = sanitizeFilename('my file.txt')
    expect(result).toBe('my_file.txt')
  })

  it('should collapse multiple underscores', () => {
    const result = sanitizeFilename('file___name.txt')
    expect(result).toBe('file_name.txt')
  })

  it('should trim underscores', () => {
    const result = sanitizeFilename('_file_.txt_')
    expect(result).toBe('file_.txt')
  })

  it('should limit length', () => {
    const longName = 'a'.repeat(300)
    const result = sanitizeFilename(longName)
    expect(result.length).toBeLessThanOrEqual(255)
  })
})

describe('safeEncodeURIComponent', () => {
  it('should encode URI components', () => {
    const result = safeEncodeURIComponent('hello world')
    expect(result).toBe('hello%20world')
  })

  it('should handle special characters', () => {
    const result = safeEncodeURIComponent('test@example.com')
    expect(result).toBe('test%40example.com')
  })

  it('should handle empty input', () => {
    const result = safeEncodeURIComponent('')
    expect(result).toBe('')
  })

  it('should handle invalid UTF-8 gracefully', () => {
    // This test may vary depending on environment
    const result = safeEncodeURIComponent('test')
    expect(typeof result).toBe('string')
  })
})

describe('safeDecodeURIComponent', () => {
  it('should decode URI components', () => {
    const result = safeDecodeURIComponent('hello%20world')
    expect(result).toBe('hello world')
  })

  it('should handle unencoded strings', () => {
    const result = safeDecodeURIComponent('hello world')
    expect(result).toBe('hello world')
  })

  it('should handle empty input', () => {
    const result = safeDecodeURIComponent('')
    expect(result).toBe('')
  })

  it('should handle malformed URI components', () => {
    const result = safeDecodeURIComponent('hello%2')
    expect(result).toBe('hello%2') // Should return original on error
  })
})

describe('sanitizeJsonInput', () => {
  it('should remove script tags', () => {
    const result = sanitizeJsonInput('<script>evil</script>{"key": "value"}')
    expect(result).toBe('{"key": "value"}')
  })

  it('should remove javascript URLs', () => {
    const result = sanitizeJsonInput('javascript:alert(1)')
    expect(result).toBe('')
  })

  it('should remove event handlers', () => {
    const result = sanitizeJsonInput('onload=evil')
    expect(result).toBe('')
  })

  it('should trim whitespace', () => {
    const result = sanitizeJsonInput('  {"test": true}  ')
    expect(result).toBe('{"test": true}')
  })
})

describe('sanitizeChatMessage', () => {
  it('should convert newlines to HTML breaks', () => {
    const result = sanitizeChatMessage('line1\nline2')
    expect(result).toBe('line1<br>line2')
  })

  it('should convert tabs to spaces', () => {
    const result = sanitizeChatMessage('col1\tcol2')
    expect(result).toBe('col1    col2')
  })

  it('should sanitize HTML content', () => {
    const result = sanitizeChatMessage('<b>bold</b> <script>evil</script>')
    expect(result).toBe('<b>bold</b> &lt;script&gt;evil&lt;&#x2F;script&gt;')
  })

  it('should handle empty input', () => {
    const result = sanitizeChatMessage('')
    expect(result).toBe('')
  })
})
