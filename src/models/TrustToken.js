const fs = require('node:fs').promises;
const path = require('node:path');
const TrustTokenGenerator = require('../components/TrustTokenGenerator');

/**
 * TrustToken model manages persistence and caching of trust tokens
 */
class TrustToken {
  constructor(options = {}) {
    this.storagePath = options.storagePath || path.join(__dirname, '../../data/trust-tokens.json');
    this.cache = new Map(); // In-memory cache for fast access
    this.maxCacheSize = options.maxCacheSize || 1000;
    this.tokenGenerator =
      options.tokenGenerator || new TrustTokenGenerator({ secret: options.secret });
    this.initialized = false;
  }

  /**
   * Initialize the model by loading existing tokens from storage
   */
  async initialize() {
    if (this.initialized) return;

    try {
      await fs.mkdir(path.dirname(this.storagePath), { recursive: true });
      const data = await fs.readFile(this.storagePath, 'utf8');
      const tokens = JSON.parse(data);

      // Load tokens into cache, filtering out expired ones
      const now = new Date();
      for (const [id, token] of Object.entries(tokens)) {
        // Parse dates back from strings
        const parsedToken = {
          ...token,
          timestamp: new Date(token.timestamp),
          expiresAt: new Date(token.expiresAt),
        };
        if (parsedToken.expiresAt > now) {
          this.cache.set(id, parsedToken);
        }
      }

      this.initialized = true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, start with empty storage
      this.initialized = true;
    }
  }

  /**
   * Save a trust token to storage and cache
   * @param {Object} token - The trust token to save
   * @returns {string} Token ID for retrieval
   */
  async save(token) {
    await this.initialize();

    // Use contentHash as ID for deduplication, fallback to generated ID
    const id =
      token.contentHash || `token-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    // Add to cache (allow expired tokens to be saved, they'll be filtered on load)
    this.cache.set(id, token);

    // Enforce cache size limit (LRU eviction)
    if (this.cache.size > this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    // Persist to storage
    await this.persist();

    return id;
  }

  /**
   * Load a trust token by ID
   * @param {string} id - Token ID (contentHash)
   * @returns {Object|null} The token or null if not found/expired
   */
  async load(id) {
    await this.initialize();

    const token = this.cache.get(id);
    if (!token) return null;

    // Check if still valid
    const validation = this.tokenGenerator.validateToken(token);
    if (!validation.isValid) {
      // Remove invalid token from cache
      this.cache.delete(id);
      await this.persist();
      return null;
    }

    return token;
  }

  /**
   * Validate a token using the generator
   * @param {Object} token - Token to validate
   * @returns {Object} Validation result
   */
  validate(token) {
    return this.tokenGenerator.validateToken(token);
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    const now = new Date();
    let validTokens = 0;
    let expiredTokens = 0;

    for (const token of this.cache.values()) {
      if (new Date(token.expiresAt) > now) {
        validTokens++;
      } else {
        expiredTokens++;
      }
    }

    return {
      totalCached: this.cache.size,
      validTokens,
      expiredTokens,
      maxCacheSize: this.maxCacheSize,
    };
  }

  /**
   * Clean up expired tokens from cache and storage
   */
  async cleanup() {
    await this.initialize();

    const now = new Date();
    let cleaned = 0;

    for (const [id, token] of this.cache.entries()) {
      if (new Date(token.expiresAt) <= now) {
        this.cache.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await this.persist();
    }

    return cleaned;
  }

  /**
   * Persist current cache to storage
   */
  async persist() {
    const data = {};
    for (const [id, token] of this.cache.entries()) {
      // Serialize dates as ISO strings
      const serializedToken = {
        ...token,
        timestamp:
          token.timestamp instanceof Date ? token.timestamp.toISOString() : token.timestamp,
        expiresAt:
          token.expiresAt instanceof Date ? token.expiresAt.toISOString() : token.expiresAt,
      };
      data[id] = serializedToken;
    }

    await fs.writeFile(this.storagePath, JSON.stringify(data, null, 2));
  }

  /**
   * Clear all tokens (for testing)
   */
  async clear() {
    this.cache.clear();
    try {
      await fs.unlink(this.storagePath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }
}

module.exports = TrustToken;
