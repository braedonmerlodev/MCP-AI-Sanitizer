// frontend/src/lib/apiKeyManager.ts
// Secure API key storage and encryption utilities

const SALT = 'mcp-security-salt' // In production, use a more secure salt
const KEY_LENGTH = 256
const ITERATIONS = 100000

// Derive encryption key from a fixed passphrase
async function getEncryptionKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode('mcp-security-fixed-key'), // Fixed key for demo; in production use user-derived
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(SALT),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

// Encrypt API key
async function encryptApiKey(apiKey: string): Promise<string> {
  const key = await getEncryptionKey()
  const encoder = new TextEncoder()
  const data = encoder.encode(apiKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)

  // Convert to base64 for storage
  return btoa(String.fromCharCode(...combined))
}

// Decrypt API key
async function decryptApiKey(encryptedData: string): Promise<string> {
  try {
    const key = await getEncryptionKey()
    const combined = Uint8Array.from(atob(encryptedData), (c) =>
      c.charCodeAt(0)
    )
    const iv = combined.slice(0, 12)
    const encrypted = combined.slice(12)

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    )

    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  } catch (error) {
    console.error('Failed to decrypt API key:', error)
    return ''
  }
}

// Get current environment
function getEnvironment(): string {
  return import.meta.env.MODE || 'development'
}

// Get storage key for environment
function getStorageKey(): string {
  const env = getEnvironment()
  return `mcp_api_key_${env}`
}

// Validate API key format (basic validation)
export function validateApiKeyFormat(apiKey: string): boolean {
  // Basic validation: non-empty, reasonable length, alphanumeric with some special chars
  return apiKey.length >= 10 && /^[a-zA-Z0-9\-_\.]+$/.test(apiKey)
}

// Store API key securely with environment-specific storage
export async function storeApiKey(apiKey: string): Promise<void> {
  try {
    if (!validateApiKeyFormat(apiKey)) {
      throw new Error('Invalid API key format')
    }

    const encrypted = await encryptApiKey(apiKey)
    const storageKey = getStorageKey()
    localStorage.setItem(storageKey, encrypted)
  } catch (error) {
    console.error('Failed to store API key:', error)
    throw new Error('Failed to store API key securely')
  }
}

// Retrieve API key for current environment
export async function getApiKey(): Promise<string | null> {
  try {
    const storageKey = getStorageKey()
    const encrypted = localStorage.getItem(storageKey)
    if (!encrypted) return null

    const decrypted = await decryptApiKey(encrypted)
    return decrypted || null
  } catch (error) {
    console.error('Failed to retrieve API key:', error)
    return null
  }
}

// Remove API key for current environment
export function removeApiKey(): void {
  const storageKey = getStorageKey()
  localStorage.removeItem(storageKey)
}

// Check if API key exists for current environment
export function hasApiKey(): boolean {
  const storageKey = getStorageKey()
  return localStorage.getItem(storageKey) !== null
}

// Validate API key against backend for current environment
export async function validateApiKeyWithBackend(
  apiKey: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/validate-key', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    return response.ok
  } catch (error) {
    console.error('Backend validation failed:', error)
    return false
  }
}

// Get environment-specific configuration
export function getEnvironmentConfig() {
  const env = getEnvironment()
  const configs = {
    development: {
      backendUrl: 'http://localhost:3000',
      requireApiKey: false,
    },
    staging: {
      backendUrl:
        import.meta.env.VITE_STAGING_BACKEND_URL ||
        'https://staging-api.mcp-security.com',
      requireApiKey: true,
    },
    production: {
      backendUrl:
        import.meta.env.VITE_PROD_BACKEND_URL || 'https://api.mcp-security.com',
      requireApiKey: true,
    },
  }
  return configs[env as keyof typeof configs] || configs.development
}
