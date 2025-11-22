const ValidationResult = require('../../models/ValidationResult');

describe('ValidationResult', () => {
  let validationResult;
  let mockData;

  beforeEach(() => {
    mockData = {
      id: 'test-id',
      timestamp: '2023-01-01T00:00:00.000Z',
      dataId: 'data-123',
      validationType: 'schema',
      status: 'PASS',
      details: { errors: [], warnings: ['Minor issue'] },
      hashReference: 'hash-123',
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
    };
    validationResult = new ValidationResult(mockData);
  });

  describe('constructor', () => {
    it('should initialize with provided data', () => {
      expect(validationResult.id).toBe('test-id');
      expect(validationResult.dataId).toBe('data-123');
      expect(validationResult.validationType).toBe('schema');
      expect(validationResult.status).toBe('PASS');
    });

    it('should generate id if not provided', () => {
      const newValidationResult = new ValidationResult();
      expect(newValidationResult.id).toMatch(/^vr_\d+_[a-z0-9]+$/);
    });

    it('should set default values', () => {
      const newValidationResult = new ValidationResult({ dataId: 'test' });
      expect(newValidationResult.validationType).toBe('unknown');
      expect(newValidationResult.status).toBe('unknown');
      expect(newValidationResult.details).toEqual({});
      expect(newValidationResult.createdAt).toBeDefined();
    });
  });

  describe('isPassed', () => {
    it('should return true if status is PASS', () => {
      expect(validationResult.isPassed()).toBe(true);
    });

    it('should return false if status is not PASS', () => {
      validationResult.status = 'FAIL';
      expect(validationResult.isPassed()).toBe(false);
    });
  });

  describe('isFailed', () => {
    it('should return true if status is FAIL', () => {
      validationResult.status = 'FAIL';
      expect(validationResult.isFailed()).toBe(true);
    });

    it('should return false if status is not FAIL', () => {
      expect(validationResult.isFailed()).toBe(false);
    });
  });

  describe('getErrors', () => {
    it('should return errors from details', () => {
      validationResult.details.errors = ['Error 1', 'Error 2'];
      expect(validationResult.getErrors()).toEqual(['Error 1', 'Error 2']);
    });

    it('should return empty array if no errors', () => {
      validationResult.details = {};
      expect(validationResult.getErrors()).toEqual([]);
    });
  });

  describe('getWarnings', () => {
    it('should return warnings from details', () => {
      expect(validationResult.getWarnings()).toEqual(['Minor issue']);
    });

    it('should return empty array if no warnings', () => {
      validationResult.details = {};
      expect(validationResult.getWarnings()).toEqual([]);
    });
  });

  describe('toObject', () => {
    it('should return plain object representation', () => {
      const obj = validationResult.toObject();
      expect(obj).toEqual(mockData);
    });
  });

  describe('fromObject', () => {
    it('should create ValidationResult from plain object', () => {
      const obj = validationResult.toObject();
      const newValidationResult = ValidationResult.fromObject(obj);
      expect(newValidationResult.id).toBe(validationResult.id);
      expect(newValidationResult.dataId).toBe(validationResult.dataId);
    });
  });
});
