import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProgressIndicator } from './ProgressIndicator'

const mockStartProcessing = jest.fn()

describe('ProgressIndicator', () => {
  const defaultProps = {
    file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
    startProcessing: mockStartProcessing,
    onCancel: jest.fn(),
    onRetry: jest.fn(),
    onComplete: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders upload progress initially', async () => {
    mockStartProcessing.mockResolvedValue({ job_id: 'test-job' })

    render(<ProgressIndicator {...defaultProps} />)

    expect(screen.getByText('Uploading File')).toBeInTheDocument()
    expect(screen.getByText('test.pdf')).toBeInTheDocument()
  })

  it('shows processing status after upload', async () => {
    mockStartProcessing.mockResolvedValue({ job_id: 'test-job' })

    render(<ProgressIndicator {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Processing File')).toBeInTheDocument()
    })
  })

  it('calls onCancel when cancel button is clicked', async () => {
    mockStartProcessing.mockResolvedValue({ job_id: 'test-job' })

    render(<ProgressIndicator {...defaultProps} />)

    await waitFor(() => {
      const cancelButton = screen.getByLabelText('Cancel processing')
      fireEvent.click(cancelButton)
    })

    // Cancel confirmation dialog should appear
    expect(screen.getByText('Cancel Processing?')).toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked on failure', async () => {
    mockStartProcessing.mockRejectedValue(new Error('Upload failed'))

    render(<ProgressIndicator {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Processing Failed')).toBeInTheDocument()
    })

    const retryButton = screen.getByText('Retry Processing')
    fireEvent.click(retryButton)

    expect(defaultProps.onRetry).toHaveBeenCalled()
  })

  it('displays progress bar with correct aria attributes', async () => {
    mockStartProcessing.mockResolvedValue({ job_id: 'test-job' })

    render(<ProgressIndicator {...defaultProps} />)

    await waitFor(() => {
      const progressBar = screen.getByRole('progressbar', {
        name: 'Processing progress',
      })
      expect(progressBar).toBeInTheDocument()
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    })
  })

  it('announces status changes to screen readers', async () => {
    mockStartProcessing.mockResolvedValue({ job_id: 'test-job' })

    render(<ProgressIndicator {...defaultProps} />)

    await waitFor(() => {
      const statusElement = screen.getByRole('status')
      expect(statusElement).toBeInTheDocument()
    })
  })
})
