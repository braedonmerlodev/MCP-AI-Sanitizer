import React, { useState, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

export interface UploadZoneProps {
  onFileSelect?: (file: File) => void
  onFileValidated?: (file: File, isValid: boolean, error?: string) => void
  maxFileSize?: number // in bytes
  acceptedFileTypes?: string[]
  className?: string
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFileSelect,
  onFileValidated,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  acceptedFileTypes = ['application/pdf'],
  className = '',
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback(
    async (file: File): Promise<{ isValid: boolean; error?: string }> => {
      // Check file type by extension and mime type
      if (
        !acceptedFileTypes.includes(file.type) &&
        !file.name.toLowerCase().endsWith('.pdf')
      ) {
        return { isValid: false, error: 'Only PDF files are allowed' }
      }

      // Check file size with detailed feedback
      if (file.size > maxFileSize) {
        const maxMB = Math.round(maxFileSize / (1024 * 1024))
        const fileMB = Math.round(file.size / (1024 * 1024))
        return {
          isValid: false,
          error: `File too large (${fileMB}MB). Maximum size: ${maxMB}MB`,
        }
      }

      if (file.size === 0) {
        return { isValid: false, error: 'File appears to be empty' }
      }

      // Validate file content and structure
      try {
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)

        // Check PDF magic bytes
        if (
          uint8Array.length < 4 ||
          !(
            uint8Array[0] === 0x25 && // %
            uint8Array[1] === 0x50 && // P
            uint8Array[2] === 0x44 && // D
            uint8Array[3] === 0x46 // F
          )
        ) {
          return {
            isValid: false,
            error: 'File is not a valid PDF (invalid header)',
          }
        }

        // Basic malware pattern detection
        const suspiciousPatterns = [
          /javascript:/gi,
          /vbscript:/gi,
          /onload\s*=/gi,
          /onerror\s*=/gi,
          /<script/gi,
          /eval\s*\(/gi,
          /document\.write/gi,
          /window\.location/gi,
        ]

        // Convert first 10KB to string for pattern checking
        const textSample = new TextDecoder('utf-8').decode(
          uint8Array.slice(0, Math.min(10240, uint8Array.length))
        )
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(textSample)) {
            return {
              isValid: false,
              error: 'File contains suspicious content that may be malicious',
            }
          }
        }

        // Validate PDF structure with pdf.js
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const numPages = pdf.numPages

        if (numPages === 0) {
          return {
            isValid: false,
            error: 'PDF file appears to be empty or corrupted',
          }
        }

        if (numPages > 1000) {
          return {
            isValid: false,
            error: 'PDF has too many pages (maximum 1000 allowed)',
          }
        }

        // Try to get the first page to ensure it's readable
        const firstPage = await pdf.getPage(1)
        const viewport = firstPage.getViewport({ scale: 1.0 })

        // Check for reasonable page dimensions
        if (
          viewport.width < 10 ||
          viewport.height < 10 ||
          viewport.width > 10000 ||
          viewport.height > 10000
        ) {
          return { isValid: false, error: 'PDF page dimensions appear invalid' }
        }
      } catch (error) {
        console.error('PDF validation error:', error)
        return { isValid: false, error: 'Invalid or corrupted PDF file' }
      }

      return { isValid: true }
    },
    [acceptedFileTypes, maxFileSize]
  )

  const processFile = useCallback(
    async (file: File) => {
      setIsValidating(true)
      setValidationError(null)
      setUploadProgress(0)

      // Validate file
      const validation = await validateFile(file)

      if (!validation.isValid) {
        setValidationError(validation.error!)
        setIsValidating(false)
        onFileValidated?.(file, false, validation.error)
        return
      }

      // Simulate file reading progress
      const reader = new FileReader()
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100
          setUploadProgress(progress)
        }
      }

      reader.onload = () => {
        setUploadProgress(100)
        setSelectedFile(file)
        setIsValidating(false)
        onFileSelect?.(file)
        onFileValidated?.(file, true)
      }

      reader.onerror = () => {
        setValidationError('Failed to read file')
        setIsValidating(false)
        onFileValidated?.(file, false, 'Failed to read file')
      }

      reader.readAsArrayBuffer(file)
    },
    [validateFile, onFileSelect, onFileValidated]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        processFile(files[0])
      }
    },
    [processFile]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        processFile(files[0])
      }
    },
    [processFile]
  )

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleRetry = useCallback(() => {
    setValidationError(null)
    setSelectedFile(null)
    setUploadProgress(0)
  }, [])

  const handleReplace = useCallback(() => {
    setSelectedFile(null)
    setValidationError(null)
    setUploadProgress(0)
    fileInputRef.current?.click()
  }, [])

  const getStateStyles = () => {
    if (validationError)
      return 'border-destructive/50 bg-destructive/5 hover:bg-destructive/10'
    if (selectedFile && !isValidating)
      return 'border-green-500/50 bg-green-500/5 hover:bg-green-500/10'
    if (isDragOver)
      return 'border-primary/50 bg-primary/5 hover:bg-primary/10 ring-2 ring-primary/20'
    return 'border-border bg-card hover:bg-accent/50 transition-all duration-200'
  }

  const getStateIcon = () => {
    if (validationError)
      return <AlertCircle className="w-8 h-8 text-destructive" />
    if (selectedFile && !isValidating)
      return <CheckCircle className="w-8 h-8 text-green-500" />
    return <Upload className="w-8 h-8 text-muted-foreground" />
  }

  return (
    <Card
      className={`${getStateStyles()} transition-colors duration-200 ${className}`}
    >
      <CardContent className="p-6">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          className="cursor-pointer"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleClick()
            }
          }}
          aria-label="Upload PDF file by dragging and dropping or clicking to select"
        >
          <div className="text-center">
            {getStateIcon()}

            <div className="mt-4">
              {isValidating ? (
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Validating file...
                  </p>
                  <div className="mt-3 w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {Math.round(uploadProgress)}%
                  </p>
                </div>
              ) : selectedFile && !validationError ? (
                <div>
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-4 h-4 text-green-500" />
                    <p className="text-sm font-medium text-foreground">
                      {selectedFile.name}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleReplace()
                    }}
                    className="mt-3 rounded-lg"
                  >
                    Replace File
                  </Button>
                </div>
              ) : validationError ? (
                <div>
                  <p className="text-sm font-medium text-destructive">
                    Upload Failed
                  </p>
                  <p className="text-xs text-destructive/80 mt-1">
                    {validationError}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRetry()
                    }}
                    className="mt-3 rounded-lg border-destructive/50 text-destructive hover:bg-destructive/10"
                  >
                    Try Again
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {isDragOver
                      ? 'Drop your PDF here'
                      : 'Drag & drop your PDF here'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or click to browse files (max 10MB)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
          aria-hidden="true"
        />
      </CardContent>
    </Card>
  )
}
