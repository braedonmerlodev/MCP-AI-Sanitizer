const HashReference = require('../../models/HashReference');

describe('HashReference', () => {
  describe('constructor', () => {
    it('should create instance with default values', () => {
      const hashRef = new HashReference();

      expect(hashRef.id).toMatch(/^hr_\d+_[a-z0-9]+$/);
      expect(hashRef.algorithm).toBe('sha256');
      expect(hashRef.metadata).toEqual({});
      expect(hashRef.createdAt).toBeDefined();
      expect(hashRef.updatedAt).toBeDefined();
    });

    it('should create instance with provided data', () => {
      const data = {
        id: 'test-id',
        dataId: 'data-123',
        rawDataHash: 'raw-hash',
        sanitizedDataHash: 'sanitized-hash',
        combinedHash: 'combined-hash',
        algorithm: 'sha512',
        timestamp: '2023-01-01T00:00:00Z',
        metadata: { source: 'test' },
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const hashRef = new HashReference(data);

      expect(hashRef.id).toBe('test-id');
      expect(hashRef.dataId).toBe('data-123');
      expect(hashRef.rawDataHash).toBe('raw-hash');
      expect(hashRef.sanitizedDataHash).toBe('sanitized-hash');
      expect(hashRef.combinedHash).toBe('combined-hash');
      expect(hashRef.algorithm).toBe('sha512');
      expect(hashRef.timestamp).toBe('2023-01-01T00:00:00Z');
      expect(hashRef.metadata).toEqual({ source: 'test' });
      expect(hashRef.createdAt).toBe('2023-01-01T00:00:00Z');
      expect(hashRef.updatedAt).toBe('2023-01-01T00:00:00Z');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const hashRef1 = new HashReference();
      const hashRef2 = new HashReference();

      expect(hashRef1.id).not.toBe(hashRef2.id);
      expect(hashRef1.id).toMatch(/^hr_\d+_[a-z0-9]+$/);
      expect(hashRef2.id).toMatch(/^hr_\d+_[a-z0-9]+$/);
    });
  });

  describe('isValid', () => {
    it('should return false when required hashes are missing', () => {
      const hashRef = new HashReference();
      expect(hashRef.isValid()).toBe(false);
    });

    it('should return true when all required hashes are present', () => {
      const hashRef = new HashReference({
        rawDataHash: 'raw',
        sanitizedDataHash: 'sanitized',
        combinedHash: 'combined',
      });
      expect(hashRef.isValid()).toBe(true);
    });

    it('should return false when rawDataHash is missing', () => {
      const hashRef = new HashReference({
        sanitizedDataHash: 'sanitized',
        combinedHash: 'combined',
      });
      expect(hashRef.isValid()).toBe(false);
    });

    it('should return false when sanitizedDataHash is missing', () => {
      const hashRef = new HashReference({
        rawDataHash: 'raw',
        combinedHash: 'combined',
      });
      expect(hashRef.isValid()).toBe(false);
    });

    it('should return false when combinedHash is missing', () => {
      const hashRef = new HashReference({
        rawDataHash: 'raw',
        sanitizedDataHash: 'sanitized',
      });
      expect(hashRef.isValid()).toBe(false);
    });
  });

  describe('getLineageInfo', () => {
    it('should return lineage information', () => {
      const hashRef = new HashReference({
        rawDataHash: 'raw-hash',
        sanitizedDataHash: 'sanitized-hash',
        combinedHash: 'combined-hash',
        algorithm: 'sha256',
        timestamp: '2023-01-01T00:00:00Z',
        metadata: { source: 'test' },
      });

      const lineage = hashRef.getLineageInfo();

      expect(lineage).toEqual({
        rawDataHash: 'raw-hash',
        sanitizedDataHash: 'sanitized-hash',
        transformationHash: 'combined-hash',
        algorithm: 'sha256',
        timestamp: '2023-01-01T00:00:00Z',
        metadata: { source: 'test' },
      });
    });
  });

  describe('matches', () => {
    it('should return true when hash references match', () => {
      const hashRef1 = new HashReference({
        rawDataHash: 'raw',
        sanitizedDataHash: 'sanitized',
        algorithm: 'sha256',
      });

      const hashRef2 = new HashReference({
        rawDataHash: 'raw',
        sanitizedDataHash: 'sanitized',
        algorithm: 'sha256',
      });

      expect(hashRef1.matches(hashRef2)).toBe(true);
    });

    it('should return false when rawDataHash differs', () => {
      const hashRef1 = new HashReference({
        rawDataHash: 'raw1',
        sanitizedDataHash: 'sanitized',
        algorithm: 'sha256',
      });

      const hashRef2 = new HashReference({
        rawDataHash: 'raw2',
        sanitizedDataHash: 'sanitized',
        algorithm: 'sha256',
      });

      expect(hashRef1.matches(hashRef2)).toBe(false);
    });

    it('should return false when sanitizedDataHash differs', () => {
      const hashRef1 = new HashReference({
        rawDataHash: 'raw',
        sanitizedDataHash: 'sanitized1',
        algorithm: 'sha256',
      });

      const hashRef2 = new HashReference({
        rawDataHash: 'raw',
        sanitizedDataHash: 'sanitized2',
        algorithm: 'sha256',
      });

      expect(hashRef1.matches(hashRef2)).toBe(false);
    });

    it('should return false when algorithm differs', () => {
      const hashRef1 = new HashReference({
        rawDataHash: 'raw',
        sanitizedDataHash: 'sanitized',
        algorithm: 'sha256',
      });

      const hashRef2 = new HashReference({
        rawDataHash: 'raw',
        sanitizedDataHash: 'sanitized',
        algorithm: 'sha512',
      });

      expect(hashRef1.matches(hashRef2)).toBe(false);
    });
  });

  describe('toObject', () => {
    it('should convert to plain object', () => {
      const data = {
        id: 'test-id',
        dataId: 'data-123',
        rawDataHash: 'raw-hash',
        sanitizedDataHash: 'sanitized-hash',
        combinedHash: 'combined-hash',
        algorithm: 'sha256',
        timestamp: '2023-01-01T00:00:00Z',
        metadata: { source: 'test' },
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const hashRef = new HashReference(data);
      const obj = hashRef.toObject();

      expect(obj).toEqual(data);
    });
  });

  describe('fromObject', () => {
    it('should create instance from plain object', () => {
      const data = {
        id: 'test-id',
        dataId: 'data-123',
        rawDataHash: 'raw-hash',
        sanitizedDataHash: 'sanitized-hash',
        combinedHash: 'combined-hash',
        algorithm: 'sha256',
        timestamp: '2023-01-01T00:00:00Z',
        metadata: { source: 'test' },
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const hashRef = HashReference.fromObject(data);

      expect(hashRef).toBeInstanceOf(HashReference);
      expect(hashRef.id).toBe('test-id');
      expect(hashRef.dataId).toBe('data-123');
      expect(hashRef.rawDataHash).toBe('raw-hash');
      expect(hashRef.sanitizedDataHash).toBe('sanitized-hash');
      expect(hashRef.combinedHash).toBe('combined-hash');
      expect(hashRef.algorithm).toBe('sha256');
      expect(hashRef.timestamp).toBe('2023-01-01T00:00:00Z');
      expect(hashRef.metadata).toEqual({ source: 'test' });
      expect(hashRef.createdAt).toBe('2023-01-01T00:00:00Z');
      expect(hashRef.updatedAt).toBe('2023-01-01T00:00:00Z');
    });
  });
});
