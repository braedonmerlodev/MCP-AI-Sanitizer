import React from 'react'
import { Button } from '@/components/ui/button'
import { JsonViewer } from './JsonViewer'
import { formatTimestamp } from '@/lib/utils'
import { Check, CheckCheck, Clock, AlertCircle, RotateCcw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { Message } from '@/store/slices/chatSlice'

interface MessageBubbleProps {
  message: Message
  onRetry?: (messageId: string) => void
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onRetry,
}) => {
  const isUser = message.role === 'user'
  const isError = message.status === 'error'
  const isSending = message.status === 'sending'
  const isSent = message.status === 'sent'
  const isDelivered = message.status === 'delivered'
  const isQueued = message.status === 'queued'

  const markdownComponents = {
    code: ({
      inline,
      className,
      children,
      ...props
    }: {
      inline?: boolean
      className?: string
      children?: React.ReactNode
      [key: string]: any
    }) => {
      const match = /language-(\w+)/.exec(className || '')
      return !inline && match ? (
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      )
    },
  }

  const bubbleClasses = `max-w-[80%] sm:max-w-[70%] md:max-w-[60%] max-h-96 overflow-y-auto rounded-lg p-3 relative ${
    isUser
      ? isError
        ? 'bg-red-500 text-white'
        : 'bg-blue-500 text-white'
      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
  } ${isSending ? 'opacity-70' : ''}`

  const containerClasses = `flex ${isUser ? 'justify-end' : 'justify-start'}`

  const getStatusIcon = () => {
    if (isSending) return <Clock className="h-3 w-3" />
    if (isQueued) return <Clock className="h-3 w-3" />
    if (isSent) return <Check className="h-3 w-3" />
    if (isDelivered) return <CheckCheck className="h-3 w-3" />
    if (isError) return <AlertCircle className="h-3 w-3" />
    return null
  }

  const getStatusColor = () => {
    if (isError) return 'text-red-500'
    if (isUser) return 'text-blue-200'
    return 'text-gray-500'
  }

  const messageDate = new Date(message.timestamp)

  return (
    <div
      className={containerClasses}
      role="article"
      aria-label={`${message.role} message`}
    >
      <div className={bubbleClasses}>
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        ) : (
          <div className="text-sm prose prose-sm max-w-none dark:prose-invert break-words">
            <ReactMarkdown components={markdownComponents}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {message.type === 'json' && message.data && (
          <div className="mt-3">
            <JsonViewer data={message.data} />
          </div>
        )}
        <div className="flex items-center justify-between mt-2 gap-2">
          <time
            className="text-xs opacity-70"
            dateTime={messageDate.toISOString()}
            aria-label={`Message sent at ${messageDate.toLocaleString()}`}
            title={messageDate.toLocaleString()}
          >
            {formatTimestamp(messageDate)}
          </time>
          <div className="flex items-center gap-1">
            {message.status && getStatusIcon() && (
              <div
                className={`${getStatusColor()} opacity-70`}
                aria-label={`Message status: ${message.status}`}
                title={message.status}
              >
                {getStatusIcon()}
              </div>
            )}
            {isError && onRetry && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 hover:bg-red-600 hover:text-white"
                onClick={() => onRetry(message.id)}
                aria-label="Retry sending message"
                title="Retry"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
