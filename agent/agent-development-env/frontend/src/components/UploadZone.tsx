import React, { useState, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

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
      // Check file type
      if (
        !acceptedFileTypes.includes(file.type) &&
        !file.name.toLowerCase().endsWith('.pdf')
      ) {
        return { isValid: false, error: 'Only PDF files are allowed' }
      }

      // Check file size
      if (file.size > maxFileSize) {
        return {
          isValid: false,
          error: `File size must be less than ${Math.round(maxFileSize / (1024 * 1024))}MB`,
        }
      }

      // Validate PDF structure
      try {
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const numPages = pdf.numPages

        if (numPages === 0) {
          return { isValid: false, error: 'PDF file appears to be empty' }
        }

        // Try to get the first page to ensure it's readable
        await pdf.getPage(1)
      } catch (error) {
        console.error('PDF validation error:', error)
        return { isValid: false, error: 'Invalid PDF file structure' }
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
    if (validationError) return 'border-red-300 bg-red-50'
    if (selectedFile && !isValidating) return 'border-green-300 bg-green-50'
    if (isDragOver) return 'border-blue-300 bg-blue-50'
    return 'border-gray-300 bg-gray-50 hover:bg-gray-100'
  }

  const getStateIcon = () => {
    if (validationError) return <AlertCircle className="w-8 h-8 text-red-500" />
    if (selectedFile && !isValidating)
      return <CheckCircle className="w-8 h-8 text-green-500" />
    return <Upload className="w-8 h-8 text-gray-400" />
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
                  <p className="text-sm font-medium text-gray-900">
                    Validating file...
                  </p>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.round(uploadProgress)}%
                  </p>
                </div>
              ) : selectedFile && !validationError ? (
                <div>
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-4 h-4 text-green-500" />
                    <p className="text-sm font-medium text-gray-900">
                      {selectedFile.name}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleReplace()
                    }}
                    className="mt-2"
                  >
                    Replace File
                  </Button>
                </div>
              ) : validationError ? (
                <div>
                  <p className="text-sm font-medium text-red-900">
                    Upload Failed
                  </p>
                  <p className="text-xs text-red-600 mt-1">{validationError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRetry()
                    }}
                    className="mt-2"
                  >
                    Try Again
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {isDragOver
                      ? 'Drop your PDF here'
                      : 'Drag & drop your PDF here'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
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
