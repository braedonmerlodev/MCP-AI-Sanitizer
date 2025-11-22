const HashReference = require('../../models/HashReference');

describe('HashReference', () => {
  let hashReference;
  let mockData;

  beforeEach(() => {
    mockData = {
      id: 'test-id',
      dataId: 'data-123',
      rawDataHash: 'abc123',
      sanitizedDataHash: 'def456',
      combinedHash: 'ghi789',
      algorithm: 'sha256',
      timestamp: '2023-01-01T00:00:00.000Z',
      metadata: { source: 'api' },
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
    };
    hashReference = new HashReference(mockData);
  });

  describe('constructor', () => {
    it('should initialize with provided data', () => {
      expect(hashReference.id).toBe('test-id');
      expect(hashReference.dataId).toBe('data-123');
      expect(hashReference.rawDataHash).toBe('abc123');
      expect(hashReference.algorithm).toBe('sha256');
    });

    it('should generate id if not provided', () => {
      const newHashReference = new HashReference();
      expect(newHashReference.id).toMatch(/^hr_\d+_[a-z0-9]+$/);
    });

    it('should set default values', () => {
      const newHashReference = new HashReference({ dataId: 'test' });
      expect(newHashReference.algorithm).toBe('sha256');
      expect(newHashReference.metadata).toEqual({});
      expect(newHashReference.createdAt).toBeDefined();
    });
  });

  describe('isValid', () => {
    it('should return true if all hashes are present', () => {
      expect(hashReference.isValid()).toBe(true);
    });

    it('should return false if rawDataHash is missing', () => {
      hashReference.rawDataHash = null;
      expect(hashReference.isValid()).toBe(false);
    });

    it('should return false if sanitizedDataHash is missing', () => {
      hashReference.sanitizedDataHash = null;
      expect(hashReference.isValid()).toBe(false);
    });

    it('should return false if combinedHash is missing', () => {
      hashReference.combinedHash = null;
      expect(hashReference.isValid()).toBe(false);
    });
  });

  describe('getLineageInfo', () => {
    it('should return lineage information', () => {
      const lineage = hashReference.getLineageInfo();
      expect(lineage.rawDataHash).toBe('abc123');
      expect(lineage.sanitizedDataHash).toBe('def456');
      expect(lineage.algorithm).toBe('sha256');
      expect(lineage.metadata).toEqual({ source: 'api' });
    });
  });

  describe('matches', () => {
    it('should return true if hashes and algorithm match', () => {
      const other = new HashReference({
        rawDataHash: 'abc123',
        sanitizedDataHash: 'def456',
        algorithm: 'sha256',
      });
      expect(hashReference.matches(other)).toBe(true);
    });

    it('should return false if rawDataHash does not match', () => {
      const other = new HashReference({
        rawDataHash: 'different',
        sanitizedDataHash: 'def456',
        algorithm: 'sha256',
      });
      expect(hashReference.matches(other)).toBe(false);
    });

    it('should return false if sanitizedDataHash does not match', () => {
      const other = new HashReference({
        rawDataHash: 'abc123',
        sanitizedDataHash: 'different',
        algorithm: 'sha256',
      });
      expect(hashReference.matches(other)).toBe(false);
    });

    it('should return false if algorithm does not match', () => {
      const other = new HashReference({
        rawDataHash: 'abc123',
        sanitizedDataHash: 'def456',
        algorithm: 'md5',
      });
      expect(hashReference.matches(other)).toBe(false);
    });
  });

  describe('toObject', () => {
    it('should return plain object representation', () => {
      const obj = hashReference.toObject();
      expect(obj).toEqual(mockData);
    });
  });

  describe('fromObject', () => {
    it('should create HashReference from plain object', () => {
      const obj = hashReference.toObject();
      const newHashReference = HashReference.fromObject(obj);
      expect(newHashReference.id).toBe(hashReference.id);
      expect(newHashReference.dataId).toBe(hashReference.dataId);
    });
  });
});
