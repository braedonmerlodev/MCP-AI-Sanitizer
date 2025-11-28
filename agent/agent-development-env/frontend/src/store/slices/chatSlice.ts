import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  type?: 'text' | 'json'
  data?: Record<string, unknown>
  status?: 'sending' | 'sent' | 'delivered' | 'error' | 'queued'
}

export interface ChatState {
  messages: Message[]
  isTyping: boolean
  sendingMessage: boolean
  error: string | null
  lastActivity: Date | null
}

const initialState: ChatState = {
  messages: [],
  isTyping: false,
  sendingMessage: false,
  error: null,
  lastActivity: null,
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload)
      state.lastActivity = new Date()
    },
    setMessages: (state, action: PayloadAction<Message[]>) => {
      state.messages = action.payload
      state.lastActivity = new Date()
    },
    updateMessage: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<Message> }>
    ) => {
      const message = state.messages.find((msg) => msg.id === action.payload.id)
      if (message) {
        Object.assign(message, action.payload.updates)
        state.lastActivity = new Date()
      }
    },
    removeMessage: (state, action: PayloadAction<string>) => {
      state.messages = state.messages.filter((msg) => msg.id !== action.payload)
      state.lastActivity = new Date()
    },
    setTyping: (state, action: PayloadAction<boolean>) => {
      state.isTyping = action.payload
    },
    setSendingMessage: (state, action: PayloadAction<boolean>) => {
      state.sendingMessage = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    clearMessages: (state) => {
      state.messages = []
      state.lastActivity = new Date()
    },
    addIncomingMessage: (
      state,
      action: PayloadAction<Omit<Message, 'id' | 'timestamp'>>
    ) => {
      const message: Message = {
        ...action.payload,
        id: `incoming-${Date.now()}`,
        timestamp: new Date(),
        status: 'sent',
      }
      state.messages.push(message)
      state.lastActivity = new Date()
      state.isTyping = false // Stop typing indicator when message arrives
    },
    addInitialProcessingResult: (
      state,
      action: PayloadAction<{
        success: boolean
        structured_output?: Record<string, unknown>
        enhanced_content?: string
        sanitized_content?: string
      }>
    ) => {
      if (action.payload.success && action.payload.structured_output) {
        const initialMessage: Message = {
          id: 'initial-json',
          role: 'assistant',
          content:
            "I've successfully processed your PDF and extracted the structured data. Here's the result:",
          timestamp: new Date(),
          type: 'json',
          data: action.payload.structured_output,
          status: 'sent',
        }
        state.messages = [initialMessage]
        state.lastActivity = new Date()
      }
    },
  },
})

export const {
  addMessage,
  setMessages,
  updateMessage,
  removeMessage,
  setTyping,
  setSendingMessage,
  setError,
  clearMessages,
  addInitialProcessingResult,
  addIncomingMessage,
} = chatSlice.actions

export default chatSlice.reducer
