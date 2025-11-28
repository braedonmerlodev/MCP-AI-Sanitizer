import { configureStore } from '@reduxjs/toolkit'
import { persistStore, persistReducer, createTransform } from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import chatReducer from './slices/chatSlice'

// Transform to handle Date objects in messages and lastActivity
const dateTransform = createTransform(
  // Transform state on its way to being serialized and persisted
  (inboundState: any) => {
    return inboundState
  },
  // Transform state being rehydrated
  (outboundState: any) => {
    const transformed = { ...outboundState }
    if (transformed.messages) {
      transformed.messages = transformed.messages.map((message: any) => ({
        ...message,
        timestamp:
          typeof message.timestamp === 'string'
            ? new Date(message.timestamp)
            : message.timestamp,
      }))
    }
    if (
      transformed.lastActivity &&
      typeof transformed.lastActivity === 'string'
    ) {
      transformed.lastActivity = new Date(transformed.lastActivity)
    }
    return transformed
  }
)

const persistConfig = {
  key: 'chat',
  storage,
  whitelist: ['messages'], // Only persist messages, not temporary states like typing
  transforms: [dateTransform],
}

const persistedChatReducer = persistReducer(persistConfig, chatReducer)

export const store = configureStore({
  reducer: {
    chat: persistedChatReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
