import { useState, useEffect } from 'react'
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
  Toast,
} from '@/components'
import {
  useProcessPdfMutation,
  useGetPdfStatusQuery,
} from '@/store/slices/apiSlice'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState } from '@/store'
import {
  startUpload,
  updateUploadProgress,
  setJobId,
  updateProcessingStatus,
  setError,
  resetProcessing,
  retryProcessing,
} from '@/store/slices/pdfSlice'

function App() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const dispatch = useDispatch()
  const pdfState = useSelector((state: RootState) => state.pdf)
  const [processPdf] = useProcessPdfMutation()
  const { data: statusData } = useGetPdfStatusQuery(pdfState.jobId || '', {
    pollingInterval: pdfState.status === 'processing' ? 2000 : 0,
    skip:
      !pdfState.jobId ||
      pdfState.status === 'completed' ||
      pdfState.status === 'failed',
  })

  // Update processing status when status data changes
  useEffect(() => {
    if (statusData && pdfState.jobId) {
      dispatch(
        updateProcessingStatus({
          status: statusData.status,
          progress_percentage: statusData.progress_percentage,
          stages: statusData.stages,
          estimated_time_remaining: statusData.estimated_time_remaining,
          error: statusData.error,
          result: statusData.result,
        })
      )
    }
  }, [statusData, pdfState.jobId, dispatch])

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
      dispatch(startUpload({ filename: file.name, fileSize: file.size }))

      try {
        const formData = new FormData()
        formData.append('file', file)

        const result = await processPdf(formData).unwrap()
        dispatch(updateUploadProgress(100))
        dispatch(setJobId(result.job_id))
      } catch (err: any) {
        console.error('Processing start error:', err)
        dispatch(
          setError(
            getUserFriendlyError(
              err?.data?.detail || err.message || 'Failed to start processing'
            )
          )
        )
      }
    } else {
      console.error('File validation failed:', error)
      dispatch(setError(error || 'File validation failed'))
    }
  }

  const handleRetry = () => {
    if (!uploadedFile) return
    dispatch(retryProcessing())
  }

  const handleCancel = () => {
    dispatch(resetProcessing())
  }

  const handleComplete = () => {
    // Result is already in Redux state
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

              {uploadedFile &&
                pdfState.status !== 'completed' &&
                pdfState.status !== 'failed' &&
                pdfState.status !== 'cancelled' && (
                  <ProgressIndicator
                    file={uploadedFile}
                    onCancel={handleCancel}
                    onRetry={handleRetry}
                    onComplete={handleComplete}
                    className="max-w-md mx-auto"
                  />
                )}

              {pdfState.status === 'completed' && pdfState.result && (
                <div className="max-w-4xl mx-auto">
                  <ChatInterface processingResult={pdfState.result} />
                </div>
              )}
            </div>
          </Main>
          <Footer />
          <Toast />
        </div>
      </PersistGate>
    </Provider>
  )
}

export default App
