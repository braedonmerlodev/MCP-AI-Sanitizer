// frontend/src/lib/apiKeyManager.test.ts
import {
  storeApiKey,
  getApiKey,
  removeApiKey,
  hasApiKey,
} from './apiKeyManager'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock crypto
Object.defineProperty(window, 'crypto', {
  value: {
    subtle: {
      importKey: jest.fn(),
      deriveKey: jest.fn(),
      encrypt: jest.fn(),
      decrypt: jest.fn(),
    },
    getRandomValues: jest.fn(),
  },
})

describe('API Key Manager', () => {
  beforeEach(() => {
    localStorageMock.clear()
    jest.clearAllMocks()
  })

  describe('storeApiKey', () => {
    it('should store encrypted API key', async () => {
      const mockKey = {} as CryptoKey
      const mockEncrypted = new Uint8Array([1, 2, 3])
      const mockIv = new Uint8Array(12)

      ;(crypto.getRandomValues as jest.Mock).mockReturnValue(mockIv)
      ;(crypto.subtle.deriveKey as jest.Mock).mockResolvedValue(mockKey)
      ;(crypto.subtle.encrypt as jest.Mock).mockResolvedValue(mockEncrypted)

      await storeApiKey('test-api-key')

      expect(localStorageMock.getItem('mcp_api_key')).toBeDefined()
      expect(crypto.subtle.deriveKey).toHaveBeenCalled()
      expect(crypto.subtle.encrypt).toHaveBeenCalled()
    })

    it('should throw error on encryption failure', async () => {
      ;(crypto.subtle.deriveKey as jest.Mock).mockRejectedValue(
        new Error('Encryption failed')
      )

      await expect(storeApiKey('test-api-key')).rejects.toThrow(
        'Failed to store API key securely'
      )
    })
  })

  describe('getApiKey', () => {
    it('should retrieve and decrypt API key', async () => {
      const mockKey = {} as CryptoKey
      const mockDecrypted = new TextEncoder().encode('test-api-key')

      localStorageMock.setItem('mcp_api_key', 'encrypted-data')
      ;(crypto.subtle.deriveKey as jest.Mock).mockResolvedValue(mockKey)
      ;(crypto.subtle.decrypt as jest.Mock).mockResolvedValue(mockDecrypted)

      const result = await getApiKey()

      expect(result).toBe('test-api-key')
      expect(crypto.subtle.deriveKey).toHaveBeenCalled()
      expect(crypto.subtle.decrypt).toHaveBeenCalled()
    })

    it('should return null if no key stored', async () => {
      const result = await getApiKey()
      expect(result).toBeNull()
    })

    it('should return null on decryption failure', async () => {
      localStorageMock.setItem('mcp_api_key', 'invalid-data')
      ;(crypto.subtle.deriveKey as jest.Mock).mockResolvedValue({} as CryptoKey)
      ;(crypto.subtle.decrypt as jest.Mock).mockRejectedValue(
        new Error('Decryption failed')
      )

      const result = await getApiKey()
      expect(result).toBeNull()
    })
  })

  describe('removeApiKey', () => {
    it('should remove API key from storage', () => {
      localStorageMock.setItem('mcp_api_key', 'encrypted-data')
      removeApiKey()
      expect(localStorageMock.getItem('mcp_api_key')).toBeNull()
    })
  })

  describe('hasApiKey', () => {
    it('should return true if key exists', () => {
      localStorageMock.setItem('mcp_api_key', 'encrypted-data')
      expect(hasApiKey()).toBe(true)
    })

    it('should return false if no key exists', () => {
      expect(hasApiKey()).toBe(false)
    })
  })
})
