import React from 'react'

interface MainProps {
  children: React.ReactNode
}

export const Main: React.FC<MainProps> = ({ children }) => {
  return (
    <main className="flex-1 bg-gray-50 px-4 py-6">
      <div className="max-w-7xl mx-auto">{children}</div>
    </main>
  )
}
