import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import Marketplace from './Marketplace'

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('Marketplace', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders loading state initially', () => {
    render(<Marketplace />)
    expect(screen.getByText('Loading MCP servers...')).toBeInTheDocument()
  })

  it('renders server list after loading', async () => {
    render(<Marketplace />)
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.getByText('OpenAI GPT-4')).toBeInTheDocument()
      expect(screen.getByText('Anthropic Claude')).toBeInTheDocument()
      expect(screen.getByText('Google Gemini')).toBeInTheDocument()
    })
  })

  it('filters servers based on search term', async () => {
    render(<Marketplace />)
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.getByText('OpenAI GPT-4')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(
      'Search servers by name or description...'
    )
    fireEvent.change(searchInput, { target: { value: 'OpenAI' } })

    await waitFor(() => {
      expect(screen.getByText('OpenAI GPT-4')).toBeInTheDocument()
      expect(screen.queryByText('Anthropic Claude')).not.toBeInTheDocument()
    })
  })

  it('opens connect modal when connect button is clicked', async () => {
    render(<Marketplace />)
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.getByText('OpenAI GPT-4')).toBeInTheDocument()
    })

    const connectButtons = screen.getAllByText('Connect')
    fireEvent.click(connectButtons[0])

    expect(screen.getByText('Connect to OpenAI GPT-4')).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('Enter your API key')
    ).toBeInTheDocument()
  })

  it('connects to server and sets as active', async () => {
    render(<Marketplace />)
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.getByText('OpenAI GPT-4')).toBeInTheDocument()
    })

    const connectButtons = screen.getAllByText('Connect')
    fireEvent.click(connectButtons[0])

    const apiKeyInput = screen.getByPlaceholderText('Enter your API key')
    fireEvent.change(apiKeyInput, { target: { value: 'test-api-key' } })

    const connectSubmitButton = screen.getByText('Connect')
    fireEvent.click(connectSubmitButton)

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'mcpConfig_1',
      JSON.stringify({
        serverId: '1',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'test-api-key',
      })
    )
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'activeMCPServer',
      '1'
    )
  })

  it('shows active server indicator', async () => {
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'activeMCPServer') return '1'
      return null
    })

    render(<Marketplace />)
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(
        screen.getByText('Active Server: OpenAI GPT-4')
      ).toBeInTheDocument()
    })
  })

  it('sets server as active', async () => {
    // First connect to a server
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'mcpConfig_1') return JSON.stringify({ serverId: '1' })
      return null
    })

    render(<Marketplace />)
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.getByText('OpenAI GPT-4')).toBeInTheDocument()
    })

    const setActiveButtons = screen.getAllByText('Set Active')
    fireEvent.click(setActiveButtons[0])

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'activeMCPServer',
      '1'
    )
  })
})
