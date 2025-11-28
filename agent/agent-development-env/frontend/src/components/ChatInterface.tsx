import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  type?: 'text' | 'json'
  data?: Record<string, unknown>
}

interface ChatInterfaceProps {
  processingResult?: {
    success: boolean
    structured_output?: Record<string, unknown>
    enhanced_content?: string
    sanitized_content?: string
  }
  onSendMessage?: (message: string) => Promise<void>
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  processingResult,
  onSendMessage,
}) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Add initial message when processing is complete
  useEffect(() => {
    if (processingResult?.success && processingResult.structured_output) {
      const initialMessage: Message = {
        id: 'initial-json',
        role: 'assistant',
        content:
          "I've successfully processed your PDF and extracted the structured data. Here's the result:",
        timestamp: new Date(),
        type: 'json',
        data: processingResult.structured_output,
      }
      setMessages([initialMessage])
    }
  }, [processingResult])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !onSendMessage) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsTyping(true)

    try {
      await onSendMessage(inputValue)
      // For now, just simulate a response
      setTimeout(() => {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: "I'm processing your question about the processed data...",
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMessage])
        setIsTyping(false)
      }, 1000)
    } catch (error) {
      setIsTyping(false)
      console.error('Error sending message:', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const JsonViewer: React.FC<{ data: Record<string, unknown> }> = ({
    data,
  }) => {
    const [isExpanded, setIsExpanded] = useState(false)

    const formatJson = (obj: unknown, indent = 0): React.ReactElement => {
      const indentStr = '  '.repeat(indent)

      if (obj === null) {
        return <span className="text-gray-500">null</span>
      }

      if (typeof obj === 'boolean') {
        return <span className="text-purple-600">{obj.toString()}</span>
      }

      if (typeof obj === 'number') {
        return <span className="text-blue-600">{obj}</span>
      }

      if (typeof obj === 'string') {
        return <span className="text-green-600">"{obj}"</span>
      }

      if (Array.isArray(obj)) {
        if (obj.length === 0) return <span className="text-gray-600">[]</span>

        return (
          <span>
            [
            <div className="ml-4">
              {obj.map((item, index) => (
                <div key={index}>
                  {formatJson(item, indent + 1)}
                  {index < obj.length - 1 && ','}
                </div>
              ))}
            </div>
            {indentStr}]
          </span>
        )
      }

      if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
        const objRecord = obj as Record<string, unknown>
        const keys = Object.keys(objRecord)
        if (keys.length === 0)
          return <span className="text-gray-600">{'{}'}</span>

        return (
          <span>
            {'{'}
            <div className="ml-4">
              {keys.map((key, index) => (
                <div key={key}>
                  <span className="text-red-600">"{key}"</span>
                  <span className="text-gray-600">: </span>
                  {formatJson(objRecord[key], indent + 1)}
                  {index < keys.length - 1 && ','}
                </div>
              ))}
            </div>
            {indentStr}
            {'}'}
          </span>
        )
      }

      return <span>{String(obj)}</span>
    }

    return (
      <div className="border rounded-lg bg-gray-50 dark:bg-gray-900">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-left p-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 rounded-t-lg transition-colors"
        >
          <span className="font-medium text-sm flex items-center gap-2">
            <span>📄</span>
            Structured Output (JSON)
          </span>
          <span className="text-xs text-gray-500">
            {isExpanded ? '▼' : '▶'} Click to{' '}
            {isExpanded ? 'collapse' : 'expand'}
          </span>
        </button>
        {isExpanded && (
          <div className="p-3 border-t bg-white dark:bg-gray-800 rounded-b-lg">
            <div className="text-xs overflow-x-auto max-h-96 overflow-y-auto font-mono leading-relaxed">
              {formatJson(data)}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Chat with MCP Security Agent</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                {message.type === 'json' && message.data && (
                  <div className="mt-3">
                    <JsonViewer data={message.data} />
                  </div>
                )}
                <span className="text-xs opacity-70 mt-2 block">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 max-w-[80%]">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.1s' }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Agent is typing...
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex space-x-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask questions about the processed data..."
              className="flex-1"
              disabled={isTyping}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping}
              size="sm"
            >
              Send
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
