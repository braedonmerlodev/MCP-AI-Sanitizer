import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UploadZone } from './UploadZone'

// Mock pdfjs-dist
jest.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {
    workerSrc: '',
  },
  getDocument: jest.fn(),
  version: '3.11.174',
}))

const mockPdfjs = jest.requireMock('pdfjs-dist')

describe('UploadZone', () => {
  const defaultProps = {
    onFileSelect: jest.fn(),
    onFileValidated: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders upload zone correctly', () => {
    render(<UploadZone {...defaultProps} />)
    expect(screen.getByText(/drag & drop your pdf here/i)).toBeInTheDocument()
    expect(screen.getByText(/or click to browse files/i)).toBeInTheDocument()
  })

  it('validates file type', async () => {
    const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' })
    mockPdfjs.getDocument.mockResolvedValue({
      promise: Promise.resolve({ numPages: 1, getPage: jest.fn() }),
    })

    render(<UploadZone {...defaultProps} />)
    const input = screen.getByLabelText(/upload pdf file/i)

    fireEvent.change(input, { target: { files: [mockFile] } })

    await waitFor(() => {
      expect(defaultProps.onFileValidated).toHaveBeenCalledWith(
        mockFile,
        false,
        'Only PDF files are allowed'
      )
    })
  })

  it('validates file size', async () => {
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.pdf', {
      type: 'application/pdf',
    })
    mockPdfjs.getDocument.mockResolvedValue({
      promise: Promise.resolve({ numPages: 1, getPage: jest.fn() }),
    })

    render(<UploadZone {...defaultProps} maxFileSize={10 * 1024 * 1024} />)
    const input = screen.getByLabelText(/upload pdf file/i)

    fireEvent.change(input, { target: { files: [largeFile] } })

    await waitFor(() => {
      expect(defaultProps.onFileValidated).toHaveBeenCalledWith(
        largeFile,
        false,
        'File size must be less than 10MB'
      )
    })
  })

  it('validates PDF structure', async () => {
    const mockFile = new File(['invalid pdf'], 'test.pdf', {
      type: 'application/pdf',
    })
    mockPdfjs.getDocument.mockRejectedValue(new Error('Invalid PDF'))

    render(<UploadZone {...defaultProps} />)
    const input = screen.getByLabelText(/upload pdf file/i)

    fireEvent.change(input, { target: { files: [mockFile] } })

    await waitFor(() => {
      expect(defaultProps.onFileValidated).toHaveBeenCalledWith(
        mockFile,
        false,
        'Invalid PDF file structure'
      )
    })
  })

  it('accepts valid PDF file', async () => {
    const mockFile = new File(['valid pdf content'], 'test.pdf', {
      type: 'application/pdf',
    })
    mockPdfjs.getDocument.mockResolvedValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: jest.fn().mockResolvedValue({}),
      }),
    })

    render(<UploadZone {...defaultProps} />)
    const input = screen.getByLabelText(/upload pdf file/i)

    fireEvent.change(input, { target: { files: [mockFile] } })

    await waitFor(() => {
      expect(defaultProps.onFileSelect).toHaveBeenCalledWith(mockFile)
      expect(defaultProps.onFileValidated).toHaveBeenCalledWith(mockFile, true)
    })
  })

  it('handles drag and drop', async () => {
    const mockFile = new File(['valid pdf'], 'test.pdf', {
      type: 'application/pdf',
    })
    mockPdfjs.getDocument.mockResolvedValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: jest.fn().mockResolvedValue({}),
      }),
    })

    render(<UploadZone {...defaultProps} />)
    const dropzone = screen.getByText(
      /drag & drop your pdf here/i
    ).parentElement!

    fireEvent.dragOver(dropzone)
    expect(dropzone).toHaveClass('border-blue-300')

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [mockFile],
      },
    })

    await waitFor(() => {
      expect(defaultProps.onFileSelect).toHaveBeenCalledWith(mockFile)
    })
  })
})
