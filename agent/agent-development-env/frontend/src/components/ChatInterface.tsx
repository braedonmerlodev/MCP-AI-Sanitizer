import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppDispatch } from '@/store/hooks'
import { addInitialProcessingResult } from '@/store/slices/chatSlice'
import { useChat } from '@/hooks/useChat'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import { ChevronDown } from 'lucide-react'

interface ChatInterfaceProps {
  processingResult?: {
    success: boolean
    structured_output?: Record<string, unknown>
    enhanced_content?: string
    sanitized_content?: string
  }
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  processingResult,
}) => {
  const dispatch = useAppDispatch()
  const {
    messages,
    isTyping,
    sendingMessage,
    error,
    sendMessage,
    retryMessage,
    dismissError,
  } = useChat(
    processingResult
      ? { processed_data: processingResult.structured_output }
      : {}
  )
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const prevMessagesLengthRef = useRef(messages.length)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const atBottom = scrollTop + clientHeight >= scrollHeight - 10 // 10px tolerance
    setIsAtBottom(atBottom)

    if (atBottom && hasNewMessages) {
      setHasNewMessages(false)
    }
  }, [hasNewMessages])

  // Check for new messages and handle auto-scroll
  useEffect(() => {
    const hasNewMessage = messages.length > prevMessagesLengthRef.current
    prevMessagesLengthRef.current = messages.length

    if (hasNewMessage) {
      if (isAtBottom) {
        // Auto-scroll if user is at bottom
        setTimeout(scrollToBottom, 100) // Small delay to ensure DOM update
      } else {
        // Mark that there are new messages
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHasNewMessages(true)
      }
    }
  }, [messages.length, isAtBottom, scrollToBottom])

  // Attach scroll listener
  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true })
      return () => container.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  // Initial scroll to bottom
  useEffect(() => {
    scrollToBottom()
  }, [scrollToBottom])

  // Add initial message when processing is complete
  useEffect(() => {
    if (processingResult?.success && processingResult.structured_output) {
      dispatch(addInitialProcessingResult(processingResult))
    }
  }, [processingResult, dispatch])

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    await sendMessage(inputValue)
    setInputValue('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Chat with MCP Security Agent</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages Area */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 relative"
          role="log"
          aria-live="polite"
          aria-label="Chat messages"
        >
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onRetry={retryMessage}
            />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />

          {/* Scroll to bottom button */}
          {hasNewMessages && !isAtBottom && (
            <Button
              onClick={() => {
                scrollToBottom()
                setHasNewMessages(false)
              }}
              size="sm"
              className="absolute bottom-4 right-4 shadow-lg"
              aria-label="Scroll to latest message"
            >
              <ChevronDown className="h-4 w-4 mr-1" />
              New messages
            </Button>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t p-4">
          {error && (
            <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          <div className="flex space-x-2">
            <Input
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                if (error) dismissError() // Clear error when user starts typing
              }}
              onKeyDown={handleKeyPress}
              placeholder="Ask questions about the processed data..."
              className="flex-1"
              disabled={sendingMessage}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || sendingMessage}
              size="sm"
            >
              {sendingMessage ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
