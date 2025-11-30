import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface MCPServer {
  id: string
  name: string
  description: string
  url: string
  // Add other fields as needed
}

const Marketplace = () => {
  const [servers, setServers] = useState<MCPServer[]>([])
  const [filteredServers, setFilteredServers] = useState<MCPServer[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [activeServer, setActiveServer] = useState<string | null>(null)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(true)

  // Mock data for now - replace with API call when backend ready
  const mockServers: MCPServer[] = [
    {
      id: '1',
      name: 'OpenAI GPT-4',
      description: 'Advanced language model for text processing',
      url: 'https://api.openai.com/v1/chat/completions',
    },
    {
      id: '2',
      name: 'Anthropic Claude',
      description: 'Safe and helpful AI assistant',
      url: 'https://api.anthropic.com/v1/messages',
    },
    {
      id: '3',
      name: 'Google Gemini',
      description: 'Multimodal AI model',
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    },
  ]

  useEffect(() => {
    // Load active server from localStorage
    const saved = localStorage.getItem('activeMCPServer')
    if (saved) {
      setActiveServer(saved)
    }

    // Mock API call - replace with actual fetch when backend ready
    setTimeout(() => {
      setServers(mockServers)
      setFilteredServers(mockServers)
      setLoading(false)
    }, 1000)
  }, [])

  useEffect(() => {
    // Filter servers based on search term
    const filtered = servers.filter(
      (server) =>
        server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        server.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredServers(filtered)
  }, [searchTerm, servers])

  const handleConnect = (server: MCPServer) => {
    setSelectedServer(server)
    setShowConnectModal(true)
  }

  const handleConnectSubmit = () => {
    if (selectedServer && apiKey) {
      // In real implementation, validate and save to backend
      // For now, save to localStorage (not secure - replace with backend call)
      const config = {
        serverId: selectedServer.id,
        url: selectedServer.url,
        apiKey: apiKey, // In production, encrypt this
      }
      localStorage.setItem(
        `mcpConfig_${selectedServer.id}`,
        JSON.stringify(config)
      )
      setActiveServer(selectedServer.id)
      localStorage.setItem('activeMCPServer', selectedServer.id)
      setShowConnectModal(false)
      setApiKey('')
      setSelectedServer(null)
    }
  }

  const handleSetActive = (serverId: string) => {
    setActiveServer(serverId)
    localStorage.setItem('activeMCPServer', serverId)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading MCP servers...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">MCP Marketplace</h1>

        {/* Search Bar */}
        <div className="mb-6">
          <Input
            type="text"
            placeholder="Search servers by name or description..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchTerm(e.target.value)
            }
            className="max-w-md"
          />
        </div>

        {/* Active Server Indicator */}
        {activeServer && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800">
              <strong>Active Server:</strong>{' '}
              {servers.find((s) => s.id === activeServer)?.name}
            </p>
          </div>
        )}

        {/* Server List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServers.map((server) => (
            <Card key={server.id} className="p-6">
              <h3 className="text-xl font-semibold mb-2">{server.name}</h3>
              <p className="text-muted-foreground mb-4">{server.description}</p>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleConnect(server)}
                  variant="outline"
                  size="sm"
                >
                  Connect
                </Button>
                <Button
                  onClick={() => handleSetActive(server.id)}
                  variant={activeServer === server.id ? 'default' : 'outline'}
                  size="sm"
                  disabled={!localStorage.getItem(`mcpConfig_${server.id}`)}
                >
                  {activeServer === server.id ? 'Active' : 'Set Active'}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Connect Modal */}
        {showConnectModal && selectedServer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
              <h2 className="text-xl font-semibold mb-4">
                Connect to {selectedServer.name}
              </h2>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  API Key
                </label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setApiKey(e.target.value)
                  }
                  placeholder="Enter your API key"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleConnectSubmit} disabled={!apiKey}>
                  Connect
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowConnectModal(false)
                    setApiKey('')
                    setSelectedServer(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Marketplace
