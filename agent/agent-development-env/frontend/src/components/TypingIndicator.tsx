import React from 'react'

export const TypingIndicator: React.FC = () => {
  return (
    <div
      className="flex justify-start"
      role="status"
      aria-label="Agent is typing"
    >
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 max-w-[80%]">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: '0s' }}
              aria-hidden="true"
            ></div>
            <div
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: '0.1s' }}
              aria-hidden="true"
            ></div>
            <div
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: '0.2s' }}
              aria-hidden="true"
            ></div>
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Agent is typing...
          </span>
        </div>
      </div>
    </div>
  )
}
