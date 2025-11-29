import React, { useState } from 'react'
import { Button } from './ui/button'
import { ApiKeyInput } from './ApiKeyInput'
import { useAuth } from '../contexts/AuthContext'

interface HeaderProps {
  children?: React.ReactNode
}

export const Header: React.FC<HeaderProps> = ({ children }) => {
  const [showSettings, setShowSettings] = useState(false)
  const { isAuthenticated } = useAuth()

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
            MCP Security Agent
          </h1>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(true)}
              className="min-h-[44px] px-3"
            >
              {isAuthenticated ? '✓ API Key' : '⚠ API Key'}
            </Button>
            {children}
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-4 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <ApiKeyInput
              onSuccess={() => setShowSettings(false)}
              onCancel={() => setShowSettings(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
