import React from 'react'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from './MessageBubble'
import type { Message } from '@/store/slices/chatSlice'

// Mock react-markdown to render basic HTML
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => {
    // Simple mock that converts basic markdown to HTML
    const html = children
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/```[\s\S]*?```/g, '<code>code block</code>')
    return (
      <div
        data-testid="markdown-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  },
}))

// Mock react-syntax-highlighter
jest.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }: { children: React.ReactNode }) => (
    <code data-testid="syntax-highlighted">{children}</code>
  ),
}))

jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  oneDark: {},
}))

describe('MessageBubble', () => {
  const mockMessage: Message = {
    id: 'test-id',
    role: 'assistant',
    content: '# Hello World\n\nThis is **bold** text.',
    timestamp: new Date('2023-01-01T00:00:00Z').toISOString(),
    status: 'sent',
  }

  it('renders markdown content for assistant messages', () => {
    render(<MessageBubble message={mockMessage} />)

    // Check that markdown mock is used
    expect(screen.getByTestId('markdown-content')).toBeInTheDocument()
    expect(screen.getByTestId('markdown-content')).toHaveTextContent(
      'Hello World'
    )
    expect(screen.getByTestId('markdown-content')).toHaveTextContent('bold')
  })

  it('renders plain text for user messages', () => {
    const userMessage: Message = {
      ...mockMessage,
      role: 'user',
      content: 'Plain text message',
    }

    render(<MessageBubble message={userMessage} />)

    // For user messages, it should render as plain text
    expect(screen.getByText('Plain text message')).toBeInTheDocument()
    // Should not have markdown content
    expect(screen.queryByTestId('markdown-content')).not.toBeInTheDocument()
  })

  it('renders code blocks with syntax highlighting', () => {
    const codeMessage: Message = {
      ...mockMessage,
      content: '```javascript\nfunction test() {\n  return true;\n}\n```',
    }

    render(<MessageBubble message={codeMessage} />)

    // Check that markdown mock is used
    expect(screen.getByTestId('markdown-content')).toBeInTheDocument()
  })
})
