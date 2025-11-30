import React from 'react'

export const About: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            About MCP Security Agent
          </h1>
          <p className="text-xl text-muted-foreground">
            Advanced AI-powered security analysis for PDF documents
          </p>
        </div>
        <p></p>
        <div className="max-w-4xl mx-auto">
          <div className="bg-card p-6 rounded-lg border">
            <h2 className="text-2xl font-semibold mb-4">How It Works</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-primary font-bold text-lg">1</span>
                </div>
                <h3 className="font-semibold mb-2">Upload</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your PDF document securely to our platform
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-primary font-bold text-lg">2</span>
                </div>
                <h3 className="font-semibold mb-2">Analyze</h3>
                <p className="text-sm text-muted-foreground">
                  Our AI analyzes the document for security threats
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-primary font-bold text-lg">3</span>
                </div>
                <h3 className="font-semibold mb-2">Interact</h3>
                <p className="text-sm text-muted-foreground">
                  Review results and chat with our AI for deeper insights
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-primary font-bold text-lg">4</span>
                </div>
                <h3 className="font-semibold mb-2">Enhance</h3>
                <p className="text-sm text-muted-foreground">
                  Connect to external MCP servers for advanced processing
                </p>
              </div>
            </div>
          </div>
          <br></br>
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-card p-6 rounded-lg border">
              <h2 className="text-2xl font-semibold mb-4">What We Do</h2>
              <p className="text-muted-foreground mb-4">
                MCP Security Agent provides comprehensive security analysis of
                PDF documents using advanced AI technology. Our tool helps
                identify potential security threats, vulnerabilities, and
                sensitive information within uploaded documents.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Automated threat detection</li>
                <li>Sensitive data identification</li>
                <li>Security vulnerability assessment</li>
                <li>Real-time analysis results</li>
                <li>Interactive AI chat interface</li>
                <li>External MCP server marketplace integration</li>
              </ul>
            </div>

            <div className="bg-card p-6 rounded-lg border">
              <h2 className="text-2xl font-semibold mb-4">Technology</h2>
              <p className="text-muted-foreground mb-4">
                Built with cutting-edge technologies to ensure fast, accurate,
                and secure document analysis.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>React & TypeScript frontend</li>
                <li>AI-powered analysis engine</li>
                <li>Secure file upload handling</li>
                <li>Real-time progress tracking</li>
                <li>MCP protocol support</li>
                <li>Modular marketplace architecture</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
