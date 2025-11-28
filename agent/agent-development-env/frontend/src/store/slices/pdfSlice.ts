import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface ProcessingStage {
  stage: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  timestamp?: string
  error?: string
  duration?: number
}

export interface PdfProcessingState {
  jobId: string | null
  status:
    | 'idle'
    | 'uploading'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'cancelled'
  uploadProgress: number
  processingProgress: number
  stages: ProcessingStage[]
  estimatedTimeRemaining: number | null
  error: string | null
  filename: string | null
  fileSize: number | null
  createdAt: string | null
  result: any | null
}

const initialState: PdfProcessingState = {
  jobId: null,
  status: 'idle',
  uploadProgress: 0,
  processingProgress: 0,
  stages: [],
  estimatedTimeRemaining: null,
  error: null,
  filename: null,
  fileSize: null,
  createdAt: null,
  result: null,
}

const pdfSlice = createSlice({
  name: 'pdf',
  initialState,
  reducers: {
    startUpload: (
      state,
      action: PayloadAction<{ filename: string; fileSize: number }>
    ) => {
      state.status = 'uploading'
      state.filename = action.payload.filename
      state.fileSize = action.payload.fileSize
      state.uploadProgress = 0
      state.error = null
    },
    updateUploadProgress: (state, action: PayloadAction<number>) => {
      state.uploadProgress = action.payload
      if (action.payload >= 100) {
        state.status = 'processing'
      }
    },
    setJobId: (state, action: PayloadAction<string>) => {
      state.jobId = action.payload
      state.createdAt = new Date().toISOString()
    },
    updateProcessingStatus: (
      state,
      action: PayloadAction<{
        status: string
        progress_percentage: number
        stages: ProcessingStage[]
        estimated_time_remaining: number | null
        error?: string
        result?: any
      }>
    ) => {
      state.status = action.payload.status as any
      state.processingProgress = action.payload.progress_percentage
      state.stages = action.payload.stages
      state.estimatedTimeRemaining = action.payload.estimated_time_remaining
      if (action.payload.error) {
        state.error = action.payload.error
      }
      if (action.payload.result) {
        state.result = action.payload.result
      }
    },
    setError: (state, action: PayloadAction<string>) => {
      state.status = 'failed'
      state.error = action.payload
    },
    cancelProcessing: (state) => {
      state.status = 'cancelled'
    },
    resetProcessing: () => {
      return initialState
    },
    retryProcessing: (state) => {
      state.status = 'idle'
      state.uploadProgress = 0
      state.processingProgress = 0
      state.stages = []
      state.estimatedTimeRemaining = null
      state.error = null
      state.result = null
    },
  },
})

export const {
  startUpload,
  updateUploadProgress,
  setJobId,
  updateProcessingStatus,
  setError,
  cancelProcessing,
  resetProcessing,
  retryProcessing,
} = pdfSlice.actions

export default pdfSlice.reducer
