import { useState } from 'react'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { store, persistor } from '@/store'
import {
  Header,
  Main,
  Footer,
  UploadZone,
  ChatInterface,
  ProgressIndicator,
} from '@/components'

interface ProcessingStatus {
  status: 'idle' | 'processing' | 'success' | 'error'
  message?: string
  currentStage?: string
  stages?: Array<{
    stage: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    timestamp?: string
    error?: string
  }>
}

interface ProcessingResult {
  success: boolean
  sanitized_content?: string
  enhanced_content?: string
  structured_output?: Record<string, unknown>
  processing_time?: string
  error?: string
  extracted_text_length?: number
  processing_stages?: Array<{
    stage: string
    status: string
    timestamp?: string
    error?: string
  }>
}

function App() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    status: 'idle',
  })
  const [processingResult, setProcessingResult] =
    useState<ProcessingResult | null>(null)

  const getUserFriendlyError = (error: string): string => {
    if (error.includes('Failed to extract PDF text')) {
      return "The PDF file could not be read. Please ensure it's a valid PDF file and try again."
    }
    if (error.includes('Only PDF files are allowed')) {
      return 'Please upload a PDF file only.'
    }
    if (error.includes('No text could be extracted')) {
      return 'No readable text was found in the PDF. It might be an image-based PDF.'
    }
    if (error.includes('Sanitize tool not found')) {
      return 'Processing service is temporarily unavailable. Please try again later.'
    }
    if (error.includes('Enhancement tool not found')) {
      return 'AI enhancement service is temporarily unavailable. Please try again later.'
    }
    if (error.includes('HTTP error')) {
      return 'Network error occurred. Please check your connection and try again.'
    }
    return error // fallback to original
  }

  const startPdfProcessing = (
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', file)

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100
          onProgress(progress)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText)
            resolve(data)
          } catch (e) {
            reject(new Error('Invalid response'))
          }
        } else {
          reject(new Error(`HTTP error! status: ${xhr.status}`))
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Network error'))
      })

      xhr.open('POST', '/api/process-pdf')
      xhr.send(formData)
    })
  }

  const handleFileSelect = (file: File) => {
    setUploadedFile(file)
    console.log(
      'File selected:',
      file.name,
      'Size:',
      (file.size / (1024 * 1024)).toFixed(2),
      'MB'
    )
  }

  const handleFileValidated = async (
    file: File,
    isValid: boolean,
    error?: string
  ) => {
    if (isValid) {
      console.log('File validated successfully:', file.name)
      setProcessingStatus({
        status: 'processing',
        message: 'Uploading PDF file...',
      })

      try {
        await startPdfProcessing(file, (progress) => {
          setProcessingStatus({
            status: 'processing',
            message: `Uploading PDF file... ${Math.round(progress)}%`,
          })
        })
        setProcessingStatus({
          status: 'processing',
          message: 'PDF processing job started',
        })
      } catch (err) {
        console.error('Processing start error:', err)
        setProcessingStatus({
          status: 'error',
          message: getUserFriendlyError(
            err instanceof Error ? err.message : 'Failed to start processing'
          ),
        })
      }
    } else {
      console.error('File validation failed:', error)
      setProcessingStatus({ status: 'idle' })
    }
  }

  const handleRetry = async () => {
    if (!uploadedFile) return

    setProcessingResult(null)
    setProcessingStatus({
      status: 'processing',
      message: 'Retrying PDF processing...',
    })

    try {
      await startPdfProcessing(uploadedFile, () => {})
      setProcessingStatus({
        status: 'processing',
        message: 'PDF processing job restarted',
      })
    } catch (err) {
      console.error('Retry error:', err)
      setProcessingStatus({
        status: 'error',
        message: getUserFriendlyError(
          err instanceof Error ? err.message : 'Failed to restart processing'
        ),
      })
    }
  }

  const handleCancel = () => {
    setProcessingStatus({ status: 'idle' })
    setProcessingResult(null)
  }

  const handleComplete = (result: ProcessingResult) => {
    setProcessingResult(result)
    setProcessingStatus({
      status: 'success',
      message: 'Content processed and enhanced successfully',
    })
  }

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <div className="min-h-screen flex flex-col">
          <Header />
          <Main>
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Welcome to MCP Security Agent
                </h2>
                <p className="text-gray-600">
                  Upload PDF documents and interact with our AI-powered security
                  analysis tool.
                </p>
              </div>

              <div className="mb-8">
                <UploadZone
                  onFileSelect={handleFileSelect}
                  onFileValidated={handleFileValidated}
                  className="max-w-md mx-auto"
                />
              </div>

              {uploadedFile && processingStatus.status !== 'success' && (
                <ProgressIndicator
                  file={uploadedFile}
                  startProcessing={startPdfProcessing}
                  onCancel={handleCancel}
                  onRetry={handleRetry}
                  onComplete={handleComplete}
                  className="max-w-md mx-auto"
                />
              )}

              {processingStatus.status === 'success' && processingResult && (
                <div className="max-w-4xl mx-auto">
                  <ChatInterface processingResult={processingResult} />
                </div>
              )}
            </div>
          </Main>
          <Footer />
        </div>
      </PersistGate>
    </Provider>
  )
}

export default App
