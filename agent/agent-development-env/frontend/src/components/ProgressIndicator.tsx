import React, { useState, useEffect, useRef } from 'react'
import { X, CheckCircle, XCircle, RefreshCw, Clock } from 'lucide-react'

interface ProcessingStage {
  stage: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  timestamp?: string
  error?: string
  duration?: number
}

interface ProgressIndicatorProps {
  file: File | null
  startProcessing: (
    file: File,
    onProgress: (progress: number) => void
  ) => Promise<any>
  onCancel?: () => void
  onRetry?: () => void
  onComplete?: (result: any) => void
  className?: string
}

const STAGE_MESSAGES = {
  file_validation: 'Validating file...',
  text_extraction: 'Extracting text from PDF...',
  sanitization: 'Sanitizing content...',
  ai_enhancement: 'Enhancing with AI...',
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  file,
  startProcessing,
  onCancel,
  onRetry,
  onComplete,
  className = '',
}) => {
  const [status, setStatus] = useState<
    'idle' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled'
  >('idle')
  const [jobId, setJobId] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [stages, setStages] = useState<ProcessingStage[]>([])
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<
    number | null
  >(null)
  const [currentMessage, setCurrentMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Start processing when file is provided
  useEffect(() => {
    if (file && status === 'idle') {
      setStatus('uploading')
      setCurrentMessage('Uploading PDF file...')
      startProcessing(file, (progress) => {
        setUploadProgress(progress)
        if (progress >= 100) {
          setStatus('processing')
          setCurrentMessage('Processing PDF file...')
        }
      })
        .then((jobData) => {
          setJobId(jobData.job_id)
        })
        .catch((err) => {
          setStatus('failed')
          setError(err.message || 'Upload failed')
        })
    }
  }, [file, startProcessing, status])

  // Load persisted progress
  useEffect(() => {
    if (jobId) {
      try {
        const persisted = localStorage.getItem(`pdf_progress_${jobId}`)
        if (persisted) {
          const data = JSON.parse(persisted)
          setStatus(data.status)
          setProcessingProgress(data.processingProgress)
          setStages(data.stages)
          setEstimatedTimeRemaining(data.estimatedTimeRemaining)
          setCurrentMessage(data.currentMessage)
          setError(data.error)
        }
      } catch (err) {
        console.warn('Failed to load persisted progress:', err)
        // Continue without persisted data
      }
    }
  }, [jobId])

  // Persist progress
  const persistProgress = () => {
    if (jobId) {
      try {
        const data = {
          status,
          processingProgress,
          stages,
          estimatedTimeRemaining,
          currentMessage,
          error,
          timestamp: Date.now(),
        }
        localStorage.setItem(`pdf_progress_${jobId}`, JSON.stringify(data))
      } catch (err) {
        console.warn('Failed to persist progress:', err)
        // Continue without persistence
      }
    }
  }

  // Poll for status updates
  useEffect(() => {
    if (
      !jobId ||
      status === 'completed' ||
      status === 'failed' ||
      status === 'cancelled'
    ) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/process-pdf/${jobId}`)
        if (response.ok) {
          const data = await response.json()
          setStatus(data.status)
          setProcessingProgress(data.progress_percentage || 0)
          setStages(data.stages || [])
          setEstimatedTimeRemaining(data.estimated_time_remaining || null)

          // Set current message based on active stage
          const activeStage = data.stages?.find(
            (s: ProcessingStage) => s.status === 'in_progress'
          )
          if (activeStage) {
            setCurrentMessage(
              STAGE_MESSAGES[
                activeStage.stage as keyof typeof STAGE_MESSAGES
              ] || 'Processing...'
            )
          }

          if (data.status === 'completed') {
            setCurrentMessage('Processing completed successfully!')
            persistProgress()
            onComplete?.(data.result)
          } else if (data.status === 'failed') {
            setError(data.error || 'Processing failed')
            persistProgress()
          }
        }
      } catch (err) {
        console.error('Error polling status:', err)
      }
    }

    // Poll every 2 seconds
    intervalRef.current = setInterval(pollStatus, 2000)
    pollStatus() // Initial poll

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [jobId, status])

  // Update persistence
  useEffect(() => {
    persistProgress()
  }, [
    status,
    processingProgress,
    stages,
    estimatedTimeRemaining,
    currentMessage,
    error,
  ])

  // Calculate upload progress (simulate for now)
  useEffect(() => {
    if (status === 'uploading') {
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            setStatus('processing')
            return 100
          }
          return prev + 10
        })
      }, 200)
      return () => clearInterval(interval)
    }
  }, [status])

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const handleCancel = () => {
    setShowCancelConfirm(true)
  }

  const confirmCancel = () => {
    setStatus('cancelled')
    setShowCancelConfirm(false)
    onCancel?.()
  }

  const handleRetry = () => {
    setStatus('idle')
    setUploadProgress(0)
    setProcessingProgress(0)
    setStages([])
    setEstimatedTimeRemaining(null)
    setCurrentMessage('')
    setError(null)
    onRetry?.()
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'cancelled':
        return <X className="w-5 h-5 text-gray-500" />
      default:
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
    }
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <h3 className="text-lg font-semibold text-gray-900">
            {status === 'uploading'
              ? 'Uploading File'
              : status === 'processing'
                ? 'Processing File'
                : status === 'completed'
                  ? 'Processing Complete'
                  : status === 'failed'
                    ? 'Processing Failed'
                    : status === 'cancelled'
                      ? 'Processing Cancelled'
                      : 'Ready to Process'}
          </h3>
        </div>
        {(status === 'processing' || status === 'uploading') && onCancel && (
          <button
            onClick={handleCancel}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            aria-label="Cancel processing"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
        <span className="font-medium">{file?.name}</span>
        <span>•</span>
        <span>{file ? (file.size / (1024 * 1024)).toFixed(2) : 0} MB</span>
      </div>

      {currentMessage && (
        <p
          className="text-sm text-gray-700 mb-4"
          role="status"
          aria-live="polite"
        >
          {currentMessage}
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {error}
        </p>
      )}

      {/* Progress Bars */}
      {status === 'uploading' && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Upload Progress</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
              role="progressbar"
              aria-valuenow={uploadProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Upload progress"
            />
          </div>
        </div>
      )}

      {(status === 'processing' || status === 'completed') && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Processing Progress</span>
            <span>{Math.round(processingProgress)}%</span>
            {estimatedTimeRemaining && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(estimatedTimeRemaining)} remaining
              </span>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-200"
              style={{ width: `${processingProgress}%` }}
              role="progressbar"
              aria-valuenow={processingProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Processing progress"
            />
          </div>
        </div>
      )}

      {/* Stages */}
      {stages.length > 0 && (
        <div className="space-y-2 mb-4">
          {stages.map((stage) => (
            <div key={stage.stage} className="flex items-center gap-2 text-sm">
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
                aria-label={`${stage.stage} status: ${stage.status}`}
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
                <span className="text-red-500 text-xs">({stage.error})</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {status === 'failed' && onRetry && (
        <div className="mt-4">
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
            aria-label="Retry processing"
          >
            Retry Processing
          </button>
        </div>
      )}

      {/* Cancel Confirmation */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h4 className="text-lg font-semibold mb-4">Cancel Processing?</h4>
            <p className="text-gray-600 mb-6">
              Are you sure you want to cancel the PDF processing? This action
              cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Continue Processing
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
              >
                Cancel Processing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
