/**
 * Sanitization utilities for client-side content sanitization
 * Provides functions to clean and escape user inputs to prevent XSS and injection attacks
 */

/**
 * Sanitize HTML content by escaping dangerous characters
 */
export function sanitizeHtml(input: string): string {
  if (!input) return ''

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Sanitize text for display in HTML, allowing some safe tags
 */
export function sanitizeTextForHtml(input: string): string {
  if (!input) return ''

  // First escape all HTML
  let sanitized = sanitizeHtml(input)

  // Allow only safe tags (bold, italic, etc.)
  const allowedTags = ['b', 'i', 'em', 'strong', 'code', 'pre']

  for (const tag of allowedTags) {
    // Re-enable allowed tags
    const openTagRegex = new RegExp(`&lt;(${tag})&gt;`, 'gi')
    const closeTagRegex = new RegExp(`&lt;&#x2F;(${tag})&gt;`, 'gi')
    sanitized = sanitized.replace(openTagRegex, `<${tag}>`)
    sanitized = sanitized.replace(closeTagRegex, `</${tag}>`)
  }

  return sanitized
}

/**
 * Sanitize input for API calls (remove dangerous characters)
 */
export function sanitizeForApi(input: string): string {
  if (!input) return ''

  return input
    .replace(/[<>'"&/()]/g, '') // Remove HTML characters and parens
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim()
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return ''

  return filename
    .replace(/[<>:"|?*]/g, '_') // Replace dangerous chars
    .replace(/[/\\]/g, '_') // Replace path separators
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_+|_+$/g, '') // Trim underscores
    .substring(0, 255) // Limit length
}

/**
 * Encode URI component safely
 */
export function safeEncodeURIComponent(input: string): string {
  if (!input) return ''

  try {
    return encodeURIComponent(input)
  } catch {
    // Fallback for invalid UTF-8
    return encodeURIComponent(input.replace(/[\uD800-\uDFFF]/g, ''))
  }
}

/**
 * Decode URI component safely
 */
export function safeDecodeURIComponent(input: string): string {
  if (!input) return ''

  try {
    return decodeURIComponent(input)
  } catch {
    // Return original if decoding fails
    return input
  }
}

/**
 * Sanitize JSON string input
 */
export function sanitizeJsonInput(input: string): string {
  if (!input) return ''

  let sanitized = input

  // Remove script tags
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '')

  // Remove javascript URLs
  sanitized = sanitized.replace(/javascript:[^\s]*/gi, '')

  // Remove event handlers
  sanitized = sanitized.replace(/on\w+\s*=[^\s]*/gi, '')

  return sanitized.trim()
}

/**
 * Create a Content Security Policy meta tag
 */
export function createCSPMetaTag(): string {
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ws: wss:;">`
}

/**
 * Sanitize chat message for display
 */
export function sanitizeChatMessage(message: string): string {
  if (!message) return ''

  // Allow basic formatting but escape dangerous content
  return sanitizeTextForHtml(message)
    .replace(/\n/g, '<br>') // Convert newlines to HTML breaks
    .replace(/\t/g, '    ') // Convert tabs to spaces
}
