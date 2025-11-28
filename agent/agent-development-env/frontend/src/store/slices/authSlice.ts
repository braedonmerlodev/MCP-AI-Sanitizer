// frontend/src/store/slices/authSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { storeApiKey, getApiKey, removeApiKey } from '../../lib/apiKeyManager'

interface AuthState {
  apiKey: string | null
  isValidating: boolean
  isAuthenticated: boolean
  error: string | null
  lastValidated: number | null
}

const initialState: AuthState = {
  apiKey: null,
  isValidating: false,
  isAuthenticated: false,
  error: null,
  lastValidated: null,
}

// Async thunk for validating API key
export const validateApiKey = createAsyncThunk(
  'auth/validateApiKey',
  async (apiKey: string, { rejectWithValue }) => {
    try {
      const { validateApiKeyWithBackend, getEnvironmentConfig } = await import(
        '../../lib/apiKeyManager'
      )
      const envConfig = getEnvironmentConfig()

      // Skip validation in development if not required
      if (!envConfig.requireApiKey) {
        return { apiKey, valid: true }
      }

      const valid = await validateApiKeyWithBackend(apiKey)
      return { apiKey, valid }
    } catch (error) {
      return rejectWithValue('Network error during validation')
    }
  }
)

// Async thunk for setting API key
export const setApiKey = createAsyncThunk(
  'auth/setApiKey',
  async (apiKey: string, { dispatch, rejectWithValue }) => {
    try {
      await storeApiKey(apiKey)
      // Validate immediately
      const result = await dispatch(validateApiKey(apiKey)).unwrap()
      return result
    } catch (error) {
      return rejectWithValue('Failed to store API key')
    }
  }
)

// Async thunk for loading stored API key
export const loadStoredApiKey = createAsyncThunk(
  'auth/loadStoredApiKey',
  async (_, { dispatch }) => {
    const storedKey = await getApiKey()
    if (storedKey) {
      const result = await dispatch(validateApiKey(storedKey)).unwrap()
      return result
    }
    return null
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    logout: (state) => {
      removeApiKey()
      state.apiKey = null
      state.isAuthenticated = false
      state.error = null
      state.lastValidated = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(validateApiKey.pending, (state) => {
        state.isValidating = true
        state.error = null
      })
      .addCase(
        validateApiKey.fulfilled,
        (state, action: PayloadAction<{ apiKey: string; valid: boolean }>) => {
          state.isValidating = false
          state.lastValidated = Date.now()
          if (action.payload.valid) {
            state.apiKey = action.payload.apiKey
            state.isAuthenticated = true
            state.error = null
          } else {
            state.isAuthenticated = false
            state.error = 'Invalid API key'
          }
        }
      )
      .addCase(validateApiKey.rejected, (state, action) => {
        state.isValidating = false
        state.isAuthenticated = false
        state.error = (action.payload as string) || 'Validation failed'
      })
      .addCase(setApiKey.pending, (state) => {
        state.isValidating = true
        state.error = null
      })
      .addCase(
        setApiKey.fulfilled,
        (state, action: PayloadAction<{ apiKey: string; valid: boolean }>) => {
          state.isValidating = false
          if (action.payload.valid) {
            state.apiKey = action.payload.apiKey
            state.isAuthenticated = true
            state.error = null
            state.lastValidated = Date.now()
          } else {
            state.isAuthenticated = false
            state.error = 'Invalid API key'
          }
        }
      )
      .addCase(setApiKey.rejected, (state, action) => {
        state.isValidating = false
        state.isAuthenticated = false
        state.error = (action.payload as string) || 'Failed to set API key'
      })
      .addCase(loadStoredApiKey.fulfilled, (state, action) => {
        if (action.payload) {
          state.apiKey = action.payload.apiKey
          state.isAuthenticated = action.payload.valid
          state.lastValidated = Date.now()
        }
      })
  },
})

export const { clearError, logout } = authSlice.actions
export default authSlice.reducer
