import { configureStore } from '@reduxjs/toolkit'
import { persistStore, persistReducer } from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import chatReducer from './slices/chatSlice'
import notificationReducer from './slices/notificationSlice'
import pdfReducer from './slices/pdfSlice'
import authReducer from './slices/authSlice'
import { apiSlice } from './slices/apiSlice'

const chatPersistConfig = {
  key: 'chat',
  storage,
  whitelist: ['messages'], // Only persist messages, not temporary states like typing
}

const pdfPersistConfig = {
  key: 'pdf',
  storage,
  whitelist: [
    'jobId',
    'status',
    'processingProgress',
    'stages',
    'estimatedTimeRemaining',
    'error',
    'filename',
    'fileSize',
    'createdAt',
  ], // Persist processing state
}

const persistedChatReducer = persistReducer(chatPersistConfig, chatReducer)
const persistedPdfReducer = persistReducer(pdfPersistConfig, pdfReducer)

export const store = configureStore({
  reducer: {
    chat: persistedChatReducer,
    pdf: persistedPdfReducer,
    notification: notificationReducer,
    auth: authReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }).concat(apiSlice.middleware),
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
