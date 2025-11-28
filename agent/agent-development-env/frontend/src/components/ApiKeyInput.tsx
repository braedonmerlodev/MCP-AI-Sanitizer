// frontend/src/components/ApiKeyInput.tsx
import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card'
import { Badge } from './ui/badge'
import { validateApiKey } from '../lib/validationUtils'

interface ApiKeyInputProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export const ApiKeyInput: React.FC<ApiKeyInputProps> = ({
  onSuccess,
  onCancel,
}) => {
  const {
    apiKey,
    isAuthenticated,
    isValidating,
    error,
    setApiKey,
    logout,
    clearError,
  } = useAuth()
  const [inputKey, setInputKey] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputKey.trim()) return

    // Validate API key
    const validation = validateApiKey(inputKey.trim())
    if (!validation.isValid) {
      setInputError(validation.error || 'Invalid API key')
      return
    }

    try {
      await setApiKey(validation.sanitizedValue || inputKey.trim())
      setInputKey('')
      setInputError(null)
      onSuccess?.()
    } catch (err) {
      // Error handled by auth context
    }
  }

  const handleCancel = () => {
    setInputKey('')
    clearError()
    onCancel?.()
  }

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return key
    return `${key.slice(0, 4)}...${key.slice(-4)}`
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Gemini API Key Management</CardTitle>
        <CardDescription>
          Enter your Gemini API key to access MCP Security services (we only
          support Gemini API keys today)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAuthenticated && apiKey ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Current Gemini API Key:
              </span>
              <Badge variant="secondary">Authenticated</Badge>
            </div>
            <div className="flex items-center space-x-2">
              <code className="flex-1 p-2 bg-gray-100 rounded text-sm font-mono">
                {showKey ? apiKey : maskApiKey(apiKey)}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? 'Hide' : 'Show'}
              </Button>
            </div>
            <Button variant="destructive" onClick={logout} className="w-full">
              Remove Gemini API Key
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="apiKey"
                className="block text-sm font-medium mb-1"
              >
                Gemini API Key
              </label>
              <Input
                id="apiKey"
                type="password"
                value={inputKey}
                onChange={(e) => {
                  const newValue = e.target.value
                  setInputKey(newValue)

                  // Real-time validation
                  if (newValue.trim()) {
                    const validation = validateApiKey(newValue)
                    setInputError(
                      validation.isValid ? null : validation.error || null
                    )
                  } else {
                    setInputError(null)
                  }

                  if (error) clearError()
                }}
                placeholder="Enter your Gemini API key"
                disabled={isValidating}
                className={error || inputError ? 'border-red-500' : ''}
              />
            </div>

            {(error || inputError) && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {error || inputError}
              </div>
            )}

            <div className="flex space-x-2">
              <Button
                type="submit"
                disabled={!inputKey.trim() || isValidating || !!inputError}
                className="flex-1"
              >
                {isValidating ? 'Validating...' : 'Save Gemini API Key'}
              </Button>
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isValidating}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
