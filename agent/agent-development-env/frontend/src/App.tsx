import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { PersistGate } from 'redux-persist/integration/react'
import { persistor } from '@/store'
import { AuthProvider } from '@/contexts/AuthContext'
import {
  Header,
  Main,
  Footer,
  UploadZone,
  ChatInterface,
  ProgressIndicator,
  Toast,
  About,
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
    <PersistGate loading={null} persistor={persistor}>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col">
            <Header />
            <Routes>
              <Route
                path="/"
                element={
                  <Main>
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                      <div className="text-center mb-8 sm:mb-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-6">
                          <svg
                            className="w-8 h-8 text-primary"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        </div>
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
                          Model Context Protocol
                        </h1>
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
                          Security Agent
                        </h1>
                        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                          Upload PDF documents and interact with our AI-powered
                          security analysis tool for comprehensive threat
                          assessment and insights.
                        </p>
                      </div>

                      <div className="mb-8 sm:mb-12">
                        <UploadZone
                          onFileSelect={handleFileSelect}
                          onFileValidated={handleFileValidated}
                          className="max-w-lg mx-auto"
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
                       <div className="max-w-4xl mx-auto">
          <div className="bg-card p-6 rounded-lg border">
            <h2 className="text-2xl font-semibold mb-4">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-primary font-bold text-lg">1</span>
                </div>
                <h3 className="font-semibold mb-2">Upload</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your PDF document securely to our platform
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-primary font-bold text-lg">2</span>
                </div>
                <h3 className="font-semibold mb-2">Analyze</h3>
                <p className="text-sm text-muted-foreground">
                  Our AI analyzes the document for security threats
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-primary font-bold text-lg">3</span>
                </div>
                <h3 className="font-semibold mb-2">Review</h3>
                <p className="text-sm text-muted-foreground">
                  Review detailed analysis results and recommendations
                </p>
              </div>
            </div>
          </div>
        
          {/* <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-card p-6 rounded-lg border">
              <h2 className="text-2xl font-semibold mb-4">What We Do</h2>
              <p className="text-muted-foreground mb-4">
                MCP Security Agent provides comprehensive security analysis of
                PDF documents using advanced AI technology. Our tool helps
                identify potential security threats, vulnerabilities, and
                sensitive information within uploaded documents.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Automated threat detection</li>
                <li>Sensitive data identification</li>
                <li>Security vulnerability assessment</li>
                <li>Real-time analysis results</li>
              </ul>
            </div>

            <div className="bg-card p-6 rounded-lg border">
              <h2 className="text-2xl font-semibold mb-4">Technology</h2>
              <p className="text-muted-foreground mb-4">
                Built with cutting-edge technologies to ensure fast, accurate,
                and secure document analysis.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>React & TypeScript frontend</li>
                <li>AI-powered analysis engine</li>
                <li>Secure file upload handling</li>
                <li>Real-time progress tracking</li>
              </ul>
            </div>
          </div> */}

          
        </div>
                  </Main>

                  
                }
              />
              <Route path="/about" element={<About />} />
            </Routes>
            <Footer />
            <Toast />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </PersistGate>
  )
}

export default App
