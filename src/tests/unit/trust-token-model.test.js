const TrustToken = require('../../models/TrustToken');
const TrustTokenGenerator = require('../../components/TrustTokenGenerator');
const fs = require('node:fs').promises;
const path = require('node:path');

describe('TrustToken Model', () => {
  let model;
  let generator;
  const testSecret = 'test-secret-for-model';
  const testStoragePath = path.join(__dirname, '../../data/test-trust-tokens.json');

  beforeEach(async () => {
    generator = new TrustTokenGenerator({ secret: testSecret });
    model = new TrustToken({
      storagePath: testStoragePath,
      tokenGenerator: generator,
      maxCacheSize: 10,
    });

    // Clean up any existing test file
    try {
      await fs.unlink(testStoragePath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up test file
    try {
      await fs.unlink(testStoragePath);
    } catch (error) {
      // Ignore
    }
  });

  describe('initialization', () => {
    it('should initialize with default options', () => {
      const defaultModel = new TrustToken({ secret: testSecret });
      expect(defaultModel.maxCacheSize).toBe(1000);
      expect(defaultModel.tokenGenerator).toBeInstanceOf(TrustTokenGenerator);
    });

    it('should accept custom options', () => {
      const customModel = new TrustToken({
        maxCacheSize: 50,
        tokenGenerator: generator,
      });
      expect(customModel.maxCacheSize).toBe(50);
      expect(customModel.tokenGenerator).toBe(generator);
    });
  });

  describe('save and load', () => {
    it('should save and load a valid token', async () => {
      const token = generator.generateToken('content', 'original', ['rule1']);

      const id = await model.save(token);
      expect(typeof id).toBe('string');

      const loaded = await model.load(id);
      expect(loaded.contentHash).toBe(token.contentHash);
      expect(loaded.originalHash).toBe(token.originalHash);
      expect(loaded.sanitizationVersion).toBe(token.sanitizationVersion);
      expect(loaded.rulesApplied).toEqual(token.rulesApplied);
      expect(loaded.timestamp.toISOString()).toBe(token.timestamp);
      expect(loaded.expiresAt.toISOString()).toBe(token.expiresAt);
      expect(loaded.signature).toBe(token.signature);
      expect(loaded.nonce).toBe(token.nonce);
    });

    it('should allow saving invalid token but filter on load', async () => {
      const invalidToken = { invalid: 'token' };

      // Should allow saving
      const id = await model.save(invalidToken);
      expect(typeof id).toBe('string');

      // But should return null on load due to invalidity
      const loaded = await model.load(id);
      expect(loaded).toBeNull();
    });

    it('should return null for non-existent token', async () => {
      const loaded = await model.load('non-existent-id');
      expect(loaded).toBeNull();
    });

    it('should handle expired tokens', async () => {
      const expiredToken = generator.generateToken('content', 'original', ['rule'], {
        expirationHours: -1, // Already expired
      });

      const id = await model.save(expiredToken);
      const loaded = await model.load(id);
      expect(loaded).toBeNull(); // Should be filtered out on load
    });
  });

  describe('cache management', () => {
    it('should enforce cache size limit', async () => {
      const smallModel = new TrustToken({
        storagePath: testStoragePath,
        tokenGenerator: generator,
        maxCacheSize: 2,
      });

      // Add 3 tokens
      const token1 = generator.generateToken('content1', 'original1', []);
      const token2 = generator.generateToken('content2', 'original2', []);
      const token3 = generator.generateToken('content3', 'original3', []);

      await smallModel.save(token1);
      await smallModel.save(token2);
      await smallModel.save(token3);

      // Cache should only have 2 items (LRU eviction)
      expect(smallModel.cache.size).toBe(2);
    });

    it('should provide cache statistics', async () => {
      const token = generator.generateToken('content', 'original', []);
      await model.save(token);

      const stats = model.getCacheStats();
      expect(stats).toHaveProperty('totalCached', 1);
      expect(stats).toHaveProperty('validTokens', 1);
      expect(stats).toHaveProperty('expiredTokens', 0);
      expect(stats).toHaveProperty('maxCacheSize', 10);
    });
  });

  describe('persistence', () => {
    it('should persist tokens to file', async () => {
      const token = generator.generateToken('content', 'original', ['rule']);
      await model.save(token);

      // Check file exists and contains data
      const data = await fs.readFile(testStoragePath, 'utf8');
      const parsed = JSON.parse(data);
      expect(Object.keys(parsed)).toHaveLength(1);
    });

    it('should load tokens from file on initialization', async () => {
      const token = generator.generateToken('content', 'original', ['rule']);
      const testData = { [token.contentHash]: token };

      await fs.writeFile(testStoragePath, JSON.stringify(testData));

      const newModel = new TrustToken({
        storagePath: testStoragePath,
        tokenGenerator: generator,
      });

      await newModel.initialize();
      expect(newModel.cache.size).toBe(1);

      const loaded = await newModel.load(token.contentHash);
      expect(loaded.contentHash).toBe(token.contentHash);
      expect(loaded.originalHash).toBe(token.originalHash);
      expect(loaded.sanitizationVersion).toBe(token.sanitizationVersion);
      expect(loaded.rulesApplied).toEqual(token.rulesApplied);
      expect(loaded.timestamp.toISOString()).toBe(token.timestamp);
      expect(loaded.expiresAt.toISOString()).toBe(token.expiresAt);
      expect(loaded.signature).toBe(token.signature);
      expect(loaded.nonce).toBe(token.nonce);
    });

    it('should handle missing storage file gracefully', async () => {
      const newModel = new TrustToken({
        storagePath: path.join(__dirname, '../../data/non-existent-dir/tokens.json'),
        tokenGenerator: generator,
      });

      await expect(newModel.initialize()).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should remove expired tokens', async () => {
      const validToken = generator.generateToken('valid', 'original', []);
      const expiredToken = generator.generateToken('expired', 'original', [], {
        expirationHours: -1,
      });

      await model.save(validToken);
      await model.save(expiredToken);

      expect(model.cache.size).toBe(2);

      const cleaned = await model.cleanup();
      expect(cleaned).toBeGreaterThanOrEqual(1);
      expect(model.cache.size).toBe(1);
    });
  });

  describe('validation', () => {
    it('should validate tokens using generator', () => {
      const token = generator.generateToken('content', 'original', []);

      const result = model.validate(token);
      expect(result.isValid).toBe(true);

      const invalidToken = { ...token, signature: 'invalid' };
      const invalidResult = model.validate(invalidToken);
      expect(invalidResult.isValid).toBe(false);
    });
  });
});
