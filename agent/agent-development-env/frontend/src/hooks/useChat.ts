import { useCallback, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  addMessage,
  updateMessage,
  setTyping,
  setSendingMessage,
  setError,
  clearMessages,
  addIncomingMessage,
  type Message,
} from '@/store/slices/chatSlice'
import { useWebSocket, type WebSocketMessage } from './useWebSocket'

export const useChat = (context?: Record<string, any>) => {
  const dispatch = useAppDispatch()
  const chatState = useAppSelector((state) => state.chat)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null
  )
  const [currentUserMessageId, setCurrentUserMessageId] = useState<
    string | null
  >(null)
  const [useWebSocketEnabled, setUseWebSocketEnabled] = useState(true)

  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case 'typing':
          dispatch(setTyping(message.status || false))
          break
        case 'chunk':
          if (streamingMessageId && message.content) {
            // Turn off typing indicator when first chunk is received
            dispatch(setTyping(false))

            // Update user message to delivered when response starts
            if (currentUserMessageId) {
              dispatch(
                updateMessage({
                  id: currentUserMessageId,
                  updates: { status: 'delivered' },
                })
              )
              setCurrentUserMessageId(null)
            }

            // Update existing streaming message
            const existingMessage = chatState.messages.find(
              (msg) => msg.id === streamingMessageId
            )
            if (existingMessage) {
              const updatedContent = existingMessage.content + message.content
              dispatch(
                updateMessage({
                  id: streamingMessageId,
                  updates: { content: updatedContent },
                })
              )
            }
          }
          break
        case 'complete':
          setStreamingMessageId(null)
          dispatch(setSendingMessage(false))
          break
        case 'error':
          dispatch(setError(message.error || 'WebSocket error'))
          setStreamingMessageId(null)
          dispatch(setTyping(false))
          dispatch(setSendingMessage(false))
          setCurrentUserMessageId(null)
          break
      }
    },
    [dispatch, streamingMessageId, chatState.messages, currentUserMessageId]
  )

  // WebSocket connection
  const { isConnected, sendMessage: wsSendMessage } = useWebSocket({
    url: `/ws/chat`,
    onMessage: useCallback(
      (message: WebSocketMessage) => {
        handleWebSocketMessage(message)
      },
      [handleWebSocketMessage]
    ),
    onError: useCallback(() => {
      // Fallback to HTTP polling on WebSocket error
      setUseWebSocketEnabled(false)
    }, []),
    reconnectAttempts: 3,
    reconnectInterval: 2000,
  })

  const sendMessageViaWebSocket = useCallback(
    async (content: string) => {
      const assistantMessageId = `assistant-${Date.now()}`
      setStreamingMessageId(assistantMessageId)

      // Add initial assistant message
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        status: 'sending',
      }
      dispatch(addMessage(assistantMessage))

      // Send message via WebSocket
      const success = wsSendMessage({
        message: content,
        context: context || {},
      })

      if (!success) {
        throw new Error('Failed to send message via WebSocket')
      }
    },
    [wsSendMessage, context, dispatch]
  )

  const sendMessageViaHTTP = useCallback(
    async (content: string) => {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          context: context || {},
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          status: 'sent',
        }
        dispatch(addMessage(assistantMessage))

        // Update user message to delivered
        if (currentUserMessageId) {
          dispatch(
            updateMessage({
              id: currentUserMessageId,
              updates: { status: 'delivered' },
            })
          )
          setCurrentUserMessageId(null)
        }
      } else {
        throw new Error(data.error || 'Failed to get response')
      }
    },
    [context, dispatch, currentUserMessageId]
  )

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || chatState.sendingMessage) return

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
        status: 'sending',
      }

      dispatch(addMessage(userMessage))
      setCurrentUserMessageId(userMessage.id)
      dispatch(setSendingMessage(true))
      dispatch(setError(null))

      try {
        // Try WebSocket first, fallback to HTTP
        if (useWebSocketEnabled && isConnected) {
          dispatch(setTyping(true))
          await sendMessageViaWebSocket(content)
        } else {
          dispatch(setTyping(true))
          await sendMessageViaHTTP(content)
          dispatch(setTyping(false))
        }

        // Update user message status to sent
        dispatch(
          updateMessage({ id: userMessage.id, updates: { status: 'sent' } })
        )

        dispatch(setSendingMessage(false))
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to send message'
        dispatch(setError(errorMessage))
        dispatch(
          updateMessage({ id: userMessage.id, updates: { status: 'error' } })
        )
        dispatch(setTyping(false))
        dispatch(setSendingMessage(false))
        setStreamingMessageId(null)
        setCurrentUserMessageId(null)
      }
    },
    [
      dispatch,
      chatState.sendingMessage,
      useWebSocketEnabled,
      isConnected,
      sendMessageViaWebSocket,
      sendMessageViaHTTP,
    ]
  )

  const clearChat = useCallback(() => {
    dispatch(clearMessages())
    dispatch(setError(null))
  }, [dispatch])

  const dismissError = useCallback(() => {
    dispatch(setError(null))
  }, [dispatch])

  const retryMessage = useCallback(
    async (messageId: string) => {
      const message = chatState.messages.find((msg) => msg.id === messageId)
      if (message && message.role === 'user') {
        dispatch(
          updateMessage({ id: messageId, updates: { status: 'sending' } })
        )
        await sendMessage(message.content)
      }
    },
    [chatState.messages, dispatch, sendMessage]
  )

  const handleIncomingMessage = useCallback(
    (message: Omit<Message, 'id' | 'timestamp'>) => {
      dispatch(addIncomingMessage(message))
    },
    [dispatch]
  )

  return {
    ...chatState,
    sendMessage,
    clearChat,
    retryMessage,
    handleIncomingMessage,
    dismissError,
  }
}
