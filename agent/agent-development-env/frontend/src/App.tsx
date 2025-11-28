import { Header, Main, Footer } from '@/components'

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Main>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Welcome to MCP Security Agent
          </h2>
          <p className="text-gray-600 mb-6">
            Upload PDF documents and interact with our AI-powered security
            analysis tool.
          </p>
          <div className="bg-white rounded-lg shadow p-6 max-w-md mx-auto">
            <p className="text-sm text-gray-500">
              PDF upload and chat interface coming soon...
            </p>
          </div>
        </div>
      </Main>
      <Footer />
    </div>
  )
}

export default App
