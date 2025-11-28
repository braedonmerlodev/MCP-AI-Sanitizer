import { useState } from 'react'
import { Header, Main, Footer, UploadZone } from '@/components'

function App() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  const handleFileSelect = (file: File) => {
    setUploadedFile(file)
    console.log(
      'File selected:',
      file.name,
      'Size:',
      (file.size / (1024 * 1024)).toFixed(2),
      'MB'
    )
  }

  const handleFileValidated = (
    file: File,
    isValid: boolean,
    error?: string
  ) => {
    if (isValid) {
      console.log('File validated successfully:', file.name)
    } else {
      console.error('File validation failed:', error)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Main>
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Welcome to MCP Security Agent
            </h2>
            <p className="text-gray-600">
              Upload PDF documents and interact with our AI-powered security
              analysis tool.
            </p>
          </div>

          <div className="mb-8">
            <UploadZone
              onFileSelect={handleFileSelect}
              onFileValidated={handleFileValidated}
              className="max-w-md mx-auto"
            />
          </div>

          {uploadedFile && (
            <div className="bg-white rounded-lg shadow p-6 max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                File Ready for Processing
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="font-medium">{uploadedFile.name}</span>
                <span>•</span>
                <span>{(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Chat interface and AI processing coming in the next update...
              </p>
            </div>
          )}
        </div>
      </Main>
      <Footer />
    </div>
  )
}

export default App
