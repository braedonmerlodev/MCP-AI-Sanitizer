import { useState } from 'react'
import { Header, Main, Footer, UploadZone } from '@/components'

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

function App() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    status: 'idle',
  })

  const processPdfFile = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/process-pdf', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error processing PDF:', error)
      throw error
    }
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
        message: 'Processing PDF file...',
        currentStage: 'Initializing',
        stages: [
          { stage: 'file_validation', status: 'completed' },
          { stage: 'text_extraction', status: 'pending' },
          { stage: 'sanitization', status: 'pending' },
          { stage: 'ai_enhancement', status: 'pending' },
        ],
      })

      try {
        // Process PDF file (extract text, sanitize, and enhance)
        const result = await processPdfFile(file)

        if (result.success) {
          setProcessingStatus({
            status: 'success',
            message: 'Content processed and enhanced successfully',
            stages: result.processing_stages || [],
          })
        } else {
          setProcessingStatus({
            status: 'error',
            message: result.error || 'Processing failed',
            stages: result.processing_stages || [],
          })
        }
      } catch (err) {
        console.error('Processing error:', err)
        setProcessingStatus({
          status: 'error',
          message:
            err instanceof Error ? err.message : 'Unknown error occurred',
        })
      }
    } else {
      console.error('File validation failed:', error)
      setProcessingStatus({ status: 'idle' })
    }
  }

  return (
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

          {uploadedFile && (
            <div className="bg-white rounded-lg shadow p-6 max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {processingStatus.status === 'processing'
                  ? 'Processing File'
                  : processingStatus.status === 'success'
                    ? 'Processing Complete'
                    : processingStatus.status === 'error'
                      ? 'Processing Failed'
                      : 'File Ready for Processing'}
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="font-medium">{uploadedFile.name}</span>
                <span>•</span>
                <span>{(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
              <p
                className={`text-sm mt-2 ${
                  processingStatus.status === 'success'
                    ? 'text-green-600'
                    : processingStatus.status === 'error'
                      ? 'text-red-600'
                      : processingStatus.status === 'processing'
                        ? 'text-blue-600'
                        : 'text-gray-500'
                }`}
              >
                {processingStatus.message ||
                  'Chat interface and AI processing coming in the next update...'}
              </p>

              {processingStatus.stages &&
                processingStatus.stages.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {processingStatus.stages.map((stage) => (
                      <div
                        key={stage.stage}
                        className="flex items-center gap-2 text-sm"
                      >
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                            stage.status === 'completed'
                              ? 'bg-green-500 text-white'
                              : stage.status === 'in_progress'
                                ? 'bg-blue-500 text-white animate-pulse'
                                : stage.status === 'failed'
                                  ? 'bg-red-500 text-white'
                                  : 'bg-gray-300 text-gray-600'
                          }`}
                        >
                          {stage.status === 'completed'
                            ? '✓'
                            : stage.status === 'in_progress'
                              ? '⟳'
                              : stage.status === 'failed'
                                ? '✗'
                                : '○'}
                        </div>
                        <span
                          className={`capitalize ${
                            stage.status === 'completed'
                              ? 'text-green-600'
                              : stage.status === 'in_progress'
                                ? 'text-blue-600'
                                : stage.status === 'failed'
                                  ? 'text-red-600'
                                  : 'text-gray-500'
                          }`}
                        >
                          {stage.stage.replace('_', ' ')}
                        </span>
                        {stage.error && (
                          <span className="text-red-500 text-xs">
                            ({stage.error})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

              {processingStatus.status === 'processing' && (
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full animate-pulse"
                      style={{
                        width: processingStatus.stages
                          ? `${(processingStatus.stages.filter((s) => s.status === 'completed').length / processingStatus.stages.length) * 100}%`
                          : '60%',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Main>
      <Footer />
    </div>
  )
}

export default App
