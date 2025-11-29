// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../store'
import {
  loadStoredApiKey,
  setApiKey,
  logout,
  clearError,
} from '../store/slices/authSlice'
import { getEnvironmentConfig } from '../lib/apiKeyManager'

interface AuthContextType {
  apiKey: string | null
  isAuthenticated: boolean
  isValidating: boolean
  error: string | null
  setApiKey: (key: string) => Promise<void>
  logout: () => void
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>()
  const { apiKey, isAuthenticated, isValidating, error } = useSelector(
    (state: RootState) => state.auth
  )

  useEffect(() => {
    // Load stored API key on mount
    dispatch(loadStoredApiKey())

    // Validate environment configuration
    const envConfig = getEnvironmentConfig()
    console.log('Environment configuration:', envConfig)
  }, [dispatch])

  const handleSetApiKey = async (key: string) => {
    await dispatch(setApiKey(key))
  }

  const handleLogout = () => {
    dispatch(logout())
  }

  const handleClearError = () => {
    dispatch(clearError())
  }

  const value: AuthContextType = {
    apiKey,
    isAuthenticated,
    isValidating,
    error,
    setApiKey: handleSetApiKey,
    logout: handleLogout,
    clearError: handleClearError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
