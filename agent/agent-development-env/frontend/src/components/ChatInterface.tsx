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
import { validateChatMessage } from '@/lib/validationUtils'
import { sanitizeForApi } from '@/lib/sanitizationUtils'

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
    isConnected,
    isReconnecting,
    sendMessage,
    retryMessage,
    dismissError,
  } = useChat(
    processingResult
      ? { processed_data: processingResult.structured_output }
      : {}
  )
  const [inputValue, setInputValue] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const prevMessagesLengthRef = useRef(0)
  const hasSentInitialMessageRef = useRef(false)

  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current
      container.scrollTop = container.scrollHeight
    }
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
    const hasNewMessage =
      Array.isArray(messages) && messages.length > prevMessagesLengthRef.current
    prevMessagesLengthRef.current = Array.isArray(messages)
      ? messages.length
      : 0

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

  // Send initial analysis message when processing result is available
  useEffect(() => {
    if (processingResult && !hasSentInitialMessageRef.current) {
      hasSentInitialMessageRef.current = true
      console.log(
        'Sending automatic analysis message for processing result:',
        processingResult
      )
      const analysisMessage =
        'Show me only the characters that were sanitized from the PDF document:'
      sendMessage(analysisMessage)
    }
  }, [processingResult, sendMessage])

  // Add initial message when processing is complete
  useEffect(() => {
    if (processingResult?.success && processingResult.structured_output) {
      dispatch(addInitialProcessingResult(processingResult))
    }
  }, [processingResult, dispatch])

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    // Validate input before sending
    const validation = validateChatMessage(inputValue)
    if (!validation.isValid) {
      setInputError(validation.error || 'Invalid input')
      return
    }

    // Sanitize input for API call
    const sanitizedMessage = sanitizeForApi(inputValue)

    await sendMessage(sanitizedMessage)
    setInputValue('')
    setInputError(null)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <Card className="h-[500px] sm:h-[600px] flex flex-col shadow-xl border-border/50 overflow-hidden">
      <CardHeader className="pb-4 px-6 bg-gradient-to-r from-primary/5 to-accent/5 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <svg
                className="w-4 h-4 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <CardTitle className="text-lg sm:text-xl font-semibold text-foreground">
              Security Analysis Chat
            </CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected
                  ? 'bg-green-500 shadow-green-500/50 shadow-lg'
                  : isReconnecting
                    ? 'bg-green-500 shadow-green-500/50 shadow-lg'
                    : 'bg-red-500 shadow-red-500/50 shadow-lg'
              }`}
              title={
                isConnected
                  ? 'Connected'
                  : isReconnecting
                    ? 'Connected'
                    : 'Disconnected'
              }
            />
            <span className="text-sm text-muted-foreground hidden sm:inline font-medium">
              {isConnected
                ? 'Connected'
                : isReconnecting
                  ? 'Connected'
                  : 'Disconnected'}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent
        className="flex flex-col p-0"
        style={{ height: 'calc(100% - 80px)' }}
      >
        {/* Messages Area */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 relative bg-gradient-to-b from-background/50 to-muted/10"
          style={{ height: 'calc(100% - 120px)' }}
          role="log"
          aria-live="polite"
          aria-label="Chat messages"
        >
          {Array.isArray(messages) &&
            messages.map((message) => (
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
              className="absolute bottom-4 sm:bottom-6 right-4 sm:right-6 shadow-xl min-h-[44px] rounded-xl bg-primary hover:bg-primary/90 border-0"
              aria-label="Scroll to latest message"
            >
              <ChevronDown className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline font-medium">New messages</span>
            </Button>
          )}
        </div>

        {/* Input Area */}
        <div
          className="border-t border-border/50 p-4 sm:p-6 bg-card/30 flex-shrink-0"
          style={{ height: '120px' }}
        >
          {error && (
            <div className="mb-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
          )}
          <div className="flex space-x-3">
            <Input
              value={inputValue}
              onChange={(e) => {
                const newValue = e.target.value
                setInputValue(newValue)

                // Real-time validation
                if (newValue.trim()) {
                  const validation = validateChatMessage(newValue)
                  setInputError(
                    validation.isValid ? null : validation.error || null
                  )
                } else {
                  setInputError(null)
                }

                if (error) dismissError() // Clear error when user starts typing
              }}
              onKeyDown={handleKeyPress}
              placeholder="Ask questions about the security analysis..."
              className={`flex-1 min-h-[48px] text-base rounded-xl border-border/50 focus:border-primary/50 focus:ring-primary/20 ${inputError ? 'border-destructive/50 focus:border-destructive/50' : ''}`}
              disabled={sendingMessage}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || sendingMessage || !!inputError}
              size="lg"
              className="min-h-[48px] px-6 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {sendingMessage ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  <span>Sending...</span>
                </div>
              ) : (
                'Send'
              )}
            </Button>
          </div>
          {inputError && (
            <p className="text-sm text-destructive mt-2 font-medium">
              {inputError}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
