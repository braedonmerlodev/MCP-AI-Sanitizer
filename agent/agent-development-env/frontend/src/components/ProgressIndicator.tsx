import React, { useEffect } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import { X, CheckCircle, XCircle, RefreshCw, Clock } from 'lucide-react'

interface ProgressIndicatorProps {
  file: File | null
  onCancel?: () => void
  onRetry?: () => void
  onComplete?: () => void
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
  onCancel,
  onRetry,
  onComplete,
  className = '',
}) => {
  const pdfState = useSelector((state: RootState) => state.pdf)
  const [showCancelConfirm, setShowCancelConfirm] = React.useState(false)

  // Trigger onComplete when status becomes completed
  useEffect(() => {
    if (pdfState.status === 'completed' && pdfState.result) {
      onComplete?.()
    }
  }, [pdfState.status, pdfState.result, onComplete])

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
    setShowCancelConfirm(false)
    onCancel?.()
  }

  const handleRetry = () => {
    onRetry?.()
  }

  const getStatusIcon = () => {
    switch (pdfState.status) {
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

  const getCurrentMessage = () => {
    if (pdfState.error) return pdfState.error
    if (pdfState.status === 'uploading') return 'Uploading PDF file...'
    if (pdfState.status === 'processing') {
      const activeStage = pdfState.stages.find(
        (s) => s.status === 'in_progress'
      )
      if (activeStage) {
        return (
          STAGE_MESSAGES[activeStage.stage as keyof typeof STAGE_MESSAGES] ||
          'Processing...'
        )
      }
      return 'Processing PDF file...'
    }
    if (pdfState.status === 'completed')
      return 'Processing completed successfully!'
    return ''
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <h3 className="text-lg font-semibold text-gray-900">
            {pdfState.status === 'uploading'
              ? 'Uploading File'
              : pdfState.status === 'processing'
                ? 'Processing File'
                : pdfState.status === 'completed'
                  ? 'Processing Complete'
                  : pdfState.status === 'failed'
                    ? 'Processing Failed'
                    : pdfState.status === 'cancelled'
                      ? 'Processing Cancelled'
                      : 'Ready to Process'}
          </h3>
        </div>
        {(pdfState.status === 'processing' ||
          pdfState.status === 'uploading') &&
          onCancel && (
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

      {getCurrentMessage() && (
        <p
          className="text-sm text-gray-700 mb-4"
          role="status"
          aria-live="polite"
        >
          {getCurrentMessage()}
        </p>
      )}

      {/* Progress Bars */}
      {pdfState.status === 'uploading' && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Upload Progress</span>
            <span>{pdfState.uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-200"
              style={{ width: `${pdfState.uploadProgress}%` }}
              role="progressbar"
              aria-valuenow={pdfState.uploadProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Upload progress"
            />
          </div>
        </div>
      )}

      {(pdfState.status === 'processing' ||
        pdfState.status === 'completed') && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Processing Progress</span>
            <span>{Math.round(pdfState.processingProgress)}%</span>
            {pdfState.estimatedTimeRemaining && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(pdfState.estimatedTimeRemaining)} remaining
              </span>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-200"
              style={{ width: `${pdfState.processingProgress}%` }}
              role="progressbar"
              aria-valuenow={pdfState.processingProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Processing progress"
            />
          </div>
        </div>
      )}

      {/* Stages */}
      {pdfState.stages.length > 0 && (
        <div className="space-y-2 mb-4">
          {pdfState.stages.map((stage) => (
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
      {pdfState.status === 'failed' && onRetry && (
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
