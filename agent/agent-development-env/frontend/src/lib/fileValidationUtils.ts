/**
 * File validation utilities for enhanced security checks
 */

export interface FileValidationResult {
  isValid: boolean
  error?: string
  details?: {
    fileSize: number
    mimeType: string
    detectedType?: string
    pageCount?: number
    dimensions?: { width: number; height: number }
  }
}

export interface FileValidationOptions {
  maxFileSize?: number
  allowedTypes?: string[]
  maxPages?: number
  checkMalware?: boolean
}

/**
 * Validate PDF file with enhanced security checks
 */
export async function validatePDFFile(
  file: File,
  options: FileValidationOptions = {}
): Promise<FileValidationResult> {
  const {
    maxFileSize = 10 * 1024 * 1024, // 10MB
    allowedTypes = ['application/pdf'],
    maxPages = 1000,
    checkMalware = true,
  } = options

  // Basic file checks
  if (file.size > maxFileSize) {
    return {
      isValid: false,
      error: `File too large (${Math.round(file.size / (1024 * 1024))}MB). Maximum: ${Math.round(maxFileSize / (1024 * 1024))}MB`,
    }
  }

  if (file.size === 0) {
    return { isValid: false, error: 'File is empty' }
  }

  // Check mime type and extension
  const isPDF =
    allowedTypes.includes(file.type) || file.name.toLowerCase().endsWith('.pdf')
  if (!isPDF) {
    return { isValid: false, error: 'Only PDF files are allowed' }
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    // Check PDF magic bytes (%PDF-)
    if (
      uint8Array.length < 8 ||
      !(
        uint8Array[0] === 0x25 && // %
        uint8Array[1] === 0x50 && // P
        uint8Array[2] === 0x44 && // D
        uint8Array[3] === 0x46 && // F
        uint8Array[4] === 0x2d // -
      )
    ) {
      return { isValid: false, error: 'Invalid PDF file header' }
    }

    // Extract PDF version
    const version = uint8Array[7] - 0x30 // Convert ASCII digit to number
    if (version < 1 || version > 2) {
      return { isValid: false, error: 'Unsupported PDF version' }
    }

    // Malware pattern detection
    if (checkMalware) {
      const suspiciousPatterns = [
        /javascript:/gi,
        /vbscript:/gi,
        /onload\s*=/gi,
        /onerror\s*=/gi,
        /<script/gi,
        /eval\s*\(/gi,
        /document\.write/gi,
        /window\.location/gi,
        /unescape\s*\(/gi,
        /fromCharCode/gi,
      ]

      const textSample = new TextDecoder('utf-8').decode(
        uint8Array.slice(0, Math.min(51200, uint8Array.length))
      ) // First 50KB
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(textSample)) {
          return {
            isValid: false,
            error: 'File contains potentially malicious content',
          }
        }
      }
    }

    // Use pdf.js for structure validation
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const numPages = pdf.numPages

    if (numPages === 0) {
      return { isValid: false, error: 'PDF has no pages' }
    }

    if (numPages > maxPages) {
      return {
        isValid: false,
        error: `PDF has too many pages (${numPages}). Maximum: ${maxPages}`,
      }
    }

    // Validate first page
    const firstPage = await pdf.getPage(1)
    const viewport = firstPage.getViewport({ scale: 1.0 })

    // Check dimensions are reasonable
    const { width, height } = viewport
    if (width < 10 || height < 10 || width > 20000 || height > 20000) {
      return { isValid: false, error: 'PDF page dimensions are invalid' }
    }

    return {
      isValid: true,
      details: {
        fileSize: file.size,
        mimeType: file.type,
        detectedType: 'application/pdf',
        pageCount: numPages,
        dimensions: { width, height },
      },
    }
  } catch (error) {
    console.error('PDF validation error:', error)
    return { isValid: false, error: 'Failed to validate PDF structure' }
  }
}

/**
 * Generic file validation function
 */
export async function validateFile(
  file: File,
  options: FileValidationOptions = {}
): Promise<FileValidationResult> {
  // For now, only PDF validation is implemented
  if (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  ) {
    return validatePDFFile(file, options)
  }

  return { isValid: false, error: 'Unsupported file type' }
}
