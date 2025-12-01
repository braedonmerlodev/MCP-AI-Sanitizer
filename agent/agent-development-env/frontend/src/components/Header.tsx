import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiKeyInput } from './ApiKeyInput'
import { useAuth } from '../contexts/AuthContext'

interface HeaderProps {
  children?: React.ReactNode
}

export const Header: React.FC<HeaderProps> = ({ children }) => {
  const [showDropdown, setShowDropdown] = useState(false)
  const { isAuthenticated } = useAuth()

  return (
    <>
      <header className="bg-card/50 backdrop-blur-sm border-b border-border px-4 py-4 sm:py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              MCP Security Agent
            </h1>
          </Link>
          <div className="flex items-center space-x-3">
            <Link
              to="/about"
              className="text-foreground hover:text-primary transition-colors font-medium"
            >
              About
            </Link>
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className={`font-medium transition-colors ${
                  isAuthenticated
                    ? 'text-green-600 hover:text-green-700'
                    : 'text-foreground hover:text-primary'
                }`}
              >
                {!isAuthenticated && <span className="mr-2">⚠</span>}
                API Key
              </button>
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-96 bg-card border border-border rounded-md shadow-lg z-50">
                  <div className="p-4">
                    <ApiKeyInput
                      onSuccess={() => setShowDropdown(false)}
                      onCancel={() => setShowDropdown(false)}
                    />
                  </div>
                </div>
              )}
            </div>
            {children}
            <div
              className={`w-2 h-2 rounded-full ml-2 ${
                isAuthenticated ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
              }`}
              title={
                isAuthenticated ? 'Authenticated' : 'Authentication required'
              }
            />
          </div>
        </div>
      </header>
    </>
  )
}
