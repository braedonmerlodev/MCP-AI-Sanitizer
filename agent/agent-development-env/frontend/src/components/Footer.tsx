import React from 'react'

interface FooterProps {
  children?: React.ReactNode
}

export const Footer: React.FC<FooterProps> = ({ children }) => {
  return (
    <footer className="bg-white border-t border-gray-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-gray-600">
        <p>&copy; 2025 MCP Security Agent. All rights reserved.</p>
        {children}
      </div>
    </footer>
  )
}
