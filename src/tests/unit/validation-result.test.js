const ValidationResult = require('../../models/ValidationResult');

describe('ValidationResult', () => {
  describe('constructor', () => {
    it('should create instance with default values', () => {
      const result = new ValidationResult();

      expect(result.id).toMatch(/^vr_\d+_[a-z0-9]+$/);
      expect(result.validationType).toBe('unknown');
      expect(result.status).toBe('unknown');
      expect(result.details).toEqual({});
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should create instance with provided data', () => {
      const data = {
        id: 'test-id',
        timestamp: '2023-01-01T00:00:00Z',
        dataId: 'data-123',
        validationType: 'schema',
        status: 'PASS',
        details: { errors: [], warnings: [] },
        hashReference: 'hash-ref-123',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const result = new ValidationResult(data);

      expect(result.id).toBe('test-id');
      expect(result.timestamp).toBe('2023-01-01T00:00:00Z');
      expect(result.dataId).toBe('data-123');
      expect(result.validationType).toBe('schema');
      expect(result.status).toBe('PASS');
      expect(result.details).toEqual({ errors: [], warnings: [] });
      expect(result.hashReference).toBe('hash-ref-123');
      expect(result.createdAt).toBe('2023-01-01T00:00:00Z');
      expect(result.updatedAt).toBe('2023-01-01T00:00:00Z');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const result1 = new ValidationResult();
      const result2 = new ValidationResult();

      expect(result1.id).not.toBe(result2.id);
      expect(result1.id).toMatch(/^vr_\d+_[a-z0-9]+$/);
      expect(result2.id).toMatch(/^vr_\d+_[a-z0-9]+$/);
    });
  });

  describe('isPassed', () => {
    it('should return true when status is PASS', () => {
      const result = new ValidationResult({ status: 'PASS' });
      expect(result.isPassed()).toBe(true);
    });

    it('should return false when status is not PASS', () => {
      const result1 = new ValidationResult({ status: 'FAIL' });
      const result2 = new ValidationResult({ status: 'WARNING' });
      const result3 = new ValidationResult({ status: 'unknown' });

      expect(result1.isPassed()).toBe(false);
      expect(result2.isPassed()).toBe(false);
      expect(result3.isPassed()).toBe(false);
    });
  });

  describe('isFailed', () => {
    it('should return true when status is FAIL', () => {
      const result = new ValidationResult({ status: 'FAIL' });
      expect(result.isFailed()).toBe(true);
    });

    it('should return false when status is not FAIL', () => {
      const result1 = new ValidationResult({ status: 'PASS' });
      const result2 = new ValidationResult({ status: 'WARNING' });
      const result3 = new ValidationResult({ status: 'unknown' });

      expect(result1.isFailed()).toBe(false);
      expect(result2.isFailed()).toBe(false);
      expect(result3.isFailed()).toBe(false);
    });
  });

  describe('getErrors', () => {
    it('should return errors from details', () => {
      const errors = ['error1', 'error2'];
      const result = new ValidationResult({
        details: { errors },
      });

      expect(result.getErrors()).toEqual(errors);
    });

    it('should return empty array when no errors in details', () => {
      const result = new ValidationResult({
        details: {},
      });

      expect(result.getErrors()).toEqual([]);
    });

    it('should return empty array when details is empty', () => {
      const result = new ValidationResult();

      expect(result.getErrors()).toEqual([]);
    });
  });

  describe('getWarnings', () => {
    it('should return warnings from details', () => {
      const warnings = ['warning1', 'warning2'];
      const result = new ValidationResult({
        details: { warnings },
      });

      expect(result.getWarnings()).toEqual(warnings);
    });

    it('should return empty array when no warnings in details', () => {
      const result = new ValidationResult({
        details: {},
      });

      expect(result.getWarnings()).toEqual([]);
    });

    it('should return empty array when details is empty', () => {
      const result = new ValidationResult();

      expect(result.getWarnings()).toEqual([]);
    });
  });

  describe('toObject', () => {
    it('should convert to plain object', () => {
      const data = {
        id: 'test-id',
        timestamp: '2023-01-01T00:00:00Z',
        dataId: 'data-123',
        validationType: 'schema',
        status: 'PASS',
        details: { errors: [], warnings: [] },
        hashReference: 'hash-ref-123',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const result = new ValidationResult(data);
      const obj = result.toObject();

      expect(obj).toEqual(data);
    });
  });

  describe('fromObject', () => {
    it('should create instance from plain object', () => {
      const data = {
        id: 'test-id',
        timestamp: '2023-01-01T00:00:00Z',
        dataId: 'data-123',
        validationType: 'schema',
        status: 'PASS',
        details: { errors: [], warnings: [] },
        hashReference: 'hash-ref-123',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const result = ValidationResult.fromObject(data);

      expect(result).toBeInstanceOf(ValidationResult);
      expect(result.id).toBe('test-id');
      expect(result.timestamp).toBe('2023-01-01T00:00:00Z');
      expect(result.dataId).toBe('data-123');
      expect(result.validationType).toBe('schema');
      expect(result.status).toBe('PASS');
      expect(result.details).toEqual({ errors: [], warnings: [] });
      expect(result.hashReference).toBe('hash-ref-123');
      expect(result.createdAt).toBe('2023-01-01T00:00:00Z');
      expect(result.updatedAt).toBe('2023-01-01T00:00:00Z');
    });
  });
});
