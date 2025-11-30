import React from 'react'

interface MainProps {
  children: React.ReactNode
}

export const Main: React.FC<MainProps> = ({ children }) => {
  return (
    <main className="flex-1 bg-gradient-to-br from-background via-background to-muted/20 px-4 py-8 sm:py-12 lg:py-16">
      <div className="max-w-7xl mx-auto">{children}</div>
    </main>
  )
}
