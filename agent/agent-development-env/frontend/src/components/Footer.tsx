import React from 'react'

interface FooterProps {
  children?: React.ReactNode
}

export const Footer: React.FC<FooterProps> = ({ children }) => {
  return (
    <footer className="bg-card/50 backdrop-blur-sm border-t border-border px-4 py-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
        <p>&copy; 2025 MCP Security Agent. All rights reserved.</p>
        {children}
      </div>
    </footer>
  )
}
