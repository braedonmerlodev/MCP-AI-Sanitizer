// Mock all dependencies before requiring the main module
jest.mock('../../components/data-integrity/SchemaValidator', () => {
  return jest.fn().mockImplementation(() => ({
    validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    addSchema: jest.fn(),
    schemas: {},
  }));
});

jest.mock('../../components/data-integrity/ReferentialChecker', () => {
  return jest.fn().mockImplementation(() => ({
    checkReferentialIntegrity: jest.fn().mockResolvedValue({ isValid: true, fieldResults: {} }),
    checkCriticalFields: jest.fn().mockReturnValue({ isValid: true, nullFields: [] }),
    addReferentialRule: jest.fn(),
    addCriticalFields: jest.fn(),
    referentialRules: {},
    criticalFields: [],
  }));
});

jest.mock('../../components/data-integrity/CryptographicHasher', () => {
  return jest.fn().mockImplementation(() => ({
    createHashReference: jest.fn().mockReturnValue({
      algorithm: 'sha256',
      dataHash: 'mockhash',
      metadata: { source: 'test' },
    }),
    generateHash: jest.fn().mockImplementation((data, salt) => {
      if (salt) {
        return `mockhash_${salt}`;
      }
      return 'mockhash';
    }),
    verifyHash: jest.fn().mockImplementation((data, hash) => {
      if (hash === 'incorrect_hash') {
        return false;
      }
      return true;
    }),
    verifyDataLineage: jest.fn().mockReturnValue({ isValid: true }),
    algorithm: 'sha256',
  }));
});

jest.mock('../../components/data-integrity/ErrorRouter', () => {
  return jest.fn().mockImplementation(() => ({
    routeError: jest
      .fn()
      .mockResolvedValue({ success: true, queueId: 'queue123', category: 'test' }),
    getErrorStats: jest.fn().mockReturnValue({ total: 0, resolved: 0 }),
  }));
});

jest.mock('../../components/data-integrity/AuditLogger', () => {
  return jest.fn().mockImplementation(() => ({
    logValidation: jest.fn(),
    logHashOperation: jest.fn(),
    logErrorRouting: jest.fn(),
    logRawDataAccess: jest.fn(),
    getAuditStats: jest.fn().mockReturnValue({ totalEntries: 0 }),
  }));
});

jest.mock('../../components/data-integrity/AtomicOperations', () => {
  return jest.fn().mockImplementation(() => ({
    atomicLoad: jest.fn().mockResolvedValue({ success: true, loadedCount: 1 }),
    temporaryTableSwap: jest.fn().mockResolvedValue({ success: true, tableName: 'test' }),
    getTransactionStatus: jest
      .fn()
      .mockReturnValue({ transactionId: 'txn123', status: 'completed' }),
    getActiveTransactions: jest.fn().mockReturnValue([]),
  }));
});

jest.mock('../../components/data-integrity/ReadOnlyAccessControl', () => {
  return jest.fn().mockImplementation(() => ({
    checkReadAccess: jest.fn().mockReturnValue({ allowed: true, reason: 'test' }),
    checkWriteAccess: jest.fn().mockReturnValue({ allowed: false, reason: 'write access denied' }),
    getAccessStats: jest
      .fn()
      .mockReturnValue({ totalRequests: 0, allowedRequests: 0, deniedRequests: 0 }),
  }));
});

const DataIntegrityValidator = require('../../components/DataIntegrityValidator');

describe('DataIntegrityValidator', () => {
  let validator;

  beforeEach(() => {
    // Create validator with auditing disabled for most tests
    validator = new DataIntegrityValidator({
      enableAuditing: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with default options', () => {
      const defaultValidator = new DataIntegrityValidator();
      expect(defaultValidator.enableAuditing).toBe(true);
      expect(defaultValidator.failOnFirstError).toBe(false);
      expect(defaultValidator.maxValidationTime).toBe(5000);
    });

    test('should initialize with custom options', () => {
      const customValidator = new DataIntegrityValidator({
        enableAuditing: false,
        failOnFirstError: true,
        maxValidationTime: 10_000,
      });
      expect(customValidator.enableAuditing).toBe(false);
      expect(customValidator.failOnFirstError).toBe(true);
      expect(customValidator.maxValidationTime).toBe(10_000);
    });
  });

  describe('validateData', () => {
    test('should validate valid string data successfully', async () => {
      const result = await validator.validateData('valid string');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.validationId).toMatch(/^val_\d+_/);
      expect(result.metadata).toHaveProperty('dataType', 'string');
      expect(result.metadata).toHaveProperty('dataSize');
      expect(result.metadata).toHaveProperty('duration');
      expect(result.metadata.withinTimeLimit).toBe(true);
    });

    test('should validate valid object data successfully', async () => {
      const testData = { id: '123', name: 'test', value: 42 };
      const result = await validator.validateData(testData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.details).toHaveProperty('schema');
      expect(result.details).toHaveProperty('hashReference');
      expect(result.metadata.dataType).toBe('object');
    });

    test('should handle schema validation failures', async () => {
      // Mock schema validation to fail
      validator.schemaValidator.validate.mockReturnValueOnce({
        isValid: false,
        errors: ['Schema validation failed'],
      });

      const result = await validator.validateData('test');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Schema validation failed');
      expect(result.details.schema.isValid).toBe(false);
    });

    test('should handle referential integrity failures', async () => {
      // Mock referential check to fail
      validator.referentialChecker.checkReferentialIntegrity.mockResolvedValueOnce({
        isValid: false,
        fieldResults: { testField: 'missing reference' },
      });

      const testData = { id: '123' };
      const result = await validator.validateData(testData, {
        referentialFields: ['testField'],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Referential integrity violations detected');
      expect(result.details).toHaveProperty('referentialErrors');
    });

    test('should handle critical field failures', async () => {
      validator.referentialChecker.checkCriticalFields.mockReturnValueOnce({
        isValid: false,
        nullFields: ['requiredField'],
      });

      const testData = { optionalField: 'value' };
      const result = await validator.validateData(testData, {
        additionalCriticalFields: ['requiredField'],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Critical fields are null/);
      expect(result.details.criticalFields.isValid).toBe(false);
    });

    test('should fail on first error when configured', async () => {
      const failFastValidator = new DataIntegrityValidator({
        enableAuditing: false,
        failOnFirstError: true,
      });

      // Mock schema to fail
      failFastValidator.schemaValidator.validate.mockReturnValueOnce({
        isValid: false,
        errors: ['First error'],
      });

      const result = await failFastValidator.validateData('test');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle hash generation errors gracefully', async () => {
      // Mock crypto hasher to throw error
      validator.cryptoHasher.createHashReference.mockImplementationOnce(() => {
        throw new Error('Hash generation failed');
      });

      const result = await validator.validateData('test data');

      expect(result.isValid).toBe(false); // Hash generation failure makes validation fail
      expect(result.errors).toContain('Hash generation failed: Hash generation failed');
      expect(result.warnings).toContain('Data lineage tracking unavailable');
      expect(result.details.hashReference).toHaveProperty('error');
    });

    test('should handle unexpected errors', async () => {
      // Mock schema validator to throw unexpected error
      validator.schemaValidator.validate.mockImplementationOnce(() => {
        throw new Error('Unexpected system error');
      });

      const result = await validator.validateData('test');

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toBe('Validation system error: Unexpected system error');
      expect(result.details).toHaveProperty('unexpectedError');
    });
  });

  describe('generateHash', () => {
    test('should generate hash for string data', () => {
      const hash = validator.generateHash('test data');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    test('should generate hash for object data', () => {
      const data = { key: 'value', number: 42 };
      const hash = validator.generateHash(data);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    test('should generate consistent hashes', () => {
      const hash1 = validator.generateHash('consistent data');
      const hash2 = validator.generateHash('consistent data');
      expect(hash1).toBe(hash2);
    });

    test('should use salt when provided', () => {
      const hash1 = validator.generateHash('data', { salt: 'salt1' });
      const hash2 = validator.generateHash('data', { salt: 'salt2' });
      expect(hash1).not.toBe(hash2);
    });

    test('should handle hash generation errors', () => {
      validator.cryptoHasher.generateHash.mockImplementationOnce(() => {
        throw new Error('Hash error');
      });

      expect(() => {
        validator.generateHash('test');
      }).toThrow('Hash error');
    });
  });

  describe('verifyHash', () => {
    test('should verify correct hash string', () => {
      const data = 'test data';
      const hash = validator.generateHash(data);
      const result = validator.verifyHash(data, hash);
      expect(result).toBe(true);
    });

    test('should verify correct hash reference object', () => {
      const data = 'test data';
      const hashRef = validator.cryptoHasher.createHashReference(data, data, { source: 'test' });
      const result = validator.verifyHash(data, hashRef);
      expect(result).toBe(true);
    });

    test('should reject incorrect hash', () => {
      const result = validator.verifyHash('test data', 'incorrect_hash');
      expect(result).toBe(false);
    });

    test('should handle verification errors gracefully', () => {
      validator.cryptoHasher.verifyHash.mockImplementationOnce(() => {
        throw new Error('Verification error');
      });

      const result = validator.verifyHash('test', 'hash');
      expect(result).toBe(false);
    });
  });

  describe('routeError', () => {
    test('should route error successfully', async () => {
      const errorRecord = {
        validationId: 'test-123',
        errors: ['Test error'],
        details: { test: true },
        timestamp: new Date().toISOString(),
      };

      const result = await validator.routeError(errorRecord);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('queueId');
      expect(result).toHaveProperty('category');
    });
  });

  describe('logRawDataAccess', () => {
    test('should log raw data access when auditing enabled', () => {
      const auditValidator = new DataIntegrityValidator({
        enableAuditing: true,
      });

      auditValidator.logRawDataAccess('resource-123', 'read', { userId: 'user1' });

      expect(auditValidator.auditLogger.logRawDataAccess).toHaveBeenCalledWith(
        'resource-123',
        'read',
        { userId: 'user1' },
      );
    });

    test('should not log when auditing disabled', () => {
      validator.logRawDataAccess('resource-123', 'read');

      expect(validator.auditLogger.logRawDataAccess).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    test('should return comprehensive statistics', () => {
      const stats = validator.getStats();

      expect(stats).toHaveProperty('errorStats');
      expect(stats).toHaveProperty('auditStats');
      expect(stats).toHaveProperty('schemaStats');
      expect(stats.schemaStats).toHaveProperty('customSchemas');
    });
  });

  describe('finalizeResult', () => {
    test('should finalize result with timing metadata', () => {
      const startTime = Date.now() - 100; // 100ms ago
      const partialResult = {
        isValid: true,
        errors: [],
        warnings: [],
        details: {},
        metadata: {
          dataType: 'string',
          dataSize: 10,
        },
      };

      const result = validator.finalizeResult(partialResult, startTime);

      expect(result.metadata).toHaveProperty('endTime');
      expect(result.metadata).toHaveProperty('duration');
      expect(result.metadata.duration).toBeGreaterThanOrEqual(100);
      expect(result.metadata.withinTimeLimit).toBe(true);
    });

    test('should mark result as exceeding time limit', () => {
      const slowValidator = new DataIntegrityValidator({
        maxValidationTime: 50,
      });

      const startTime = Date.now() - 100; // 100ms ago, exceeding 50ms limit
      const partialResult = {
        isValid: true,
        errors: [],
        warnings: [],
        details: {},
        metadata: {},
      };

      const result = slowValidator.finalizeResult(partialResult, startTime);

      expect(result.metadata.withinTimeLimit).toBe(false);
      expect(result.warnings[0]).toMatch(/exceeded time limit/);
    });
  });

  describe('addSchema', () => {
    test('should add custom schema', () => {
      const customSchema = { validate: () => ({ isValid: true }) };
      validator.addSchema('custom', customSchema);

      expect(validator.schemaValidator.addSchema).toHaveBeenCalledWith('custom', customSchema);
    });
  });

  describe('addReferentialRule', () => {
    test('should add referential rule', () => {
      const rule = { required: true, references: 'testTable' };
      validator.addReferentialRule('testField', rule);

      expect(validator.referentialChecker.addReferentialRule).toHaveBeenCalledWith(
        'testField',
        rule,
      );
    });
  });

  describe('addCriticalFields', () => {
    test('should add critical fields', () => {
      validator.addCriticalFields(['field1', 'field2']);

      expect(validator.referentialChecker.addCriticalFields).toHaveBeenCalledWith([
        'field1',
        'field2',
      ]);
    });
  });

  describe('atomicLoad', () => {
    test('should perform atomic load', async () => {
      const dataItems = [{ id: '1', data: 'test' }];
      const result = await validator.atomicLoad(dataItems);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('loadedCount');
    });
  });

  describe('temporaryTableSwap', () => {
    test('should perform table swap', async () => {
      const newData = [{ id: '1', data: 'test' }];
      const result = await validator.temporaryTableSwap('testTable', newData);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('tableName');
    });
  });

  describe('checkReadAccess', () => {
    test('should check read access', () => {
      const user = { id: 'user1', role: 'admin' };
      const result = validator.checkReadAccess(user);

      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('reason');
    });
  });

  describe('checkWriteAccess', () => {
    test('should deny write access', () => {
      const user = { id: 'user1', role: 'admin' };
      const result = validator.checkWriteAccess(user);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('denied');
    });
  });

  describe('getAccessStats', () => {
    test('should return access statistics', () => {
      const stats = validator.getAccessStats();

      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('allowedRequests');
      expect(stats).toHaveProperty('deniedRequests');
    });
  });

  describe('getTransactionStatus', () => {
    test('should get transaction status', () => {
      const status = validator.getTransactionStatus('txn-123');

      expect(status).toHaveProperty('transactionId');
      expect(status).toHaveProperty('status');
    });
  });

  describe('getActiveTransactions', () => {
    test('should return active transactions', () => {
      const transactions = validator.getActiveTransactions();

      expect(Array.isArray(transactions)).toBe(true);
    });
  });

  describe('calculateDataSize', () => {
    test('should calculate size for strings', () => {
      const size = validator.calculateDataSize('hello world');
      expect(size).toBe(Buffer.byteLength('hello world', 'utf8'));
    });

    test('should calculate size for objects', () => {
      const data = { key: 'value', array: [1, 2, 3] };
      const expectedSize = Buffer.byteLength(JSON.stringify(data), 'utf8');
      const size = validator.calculateDataSize(data);
      expect(size).toBe(expectedSize);
    });
  });

  describe('generateValidationId', () => {
    test('should generate unique validation IDs', () => {
      const id1 = validator.generateValidationId();
      const id2 = validator.generateValidationId();

      expect(id1).toMatch(/^val_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^val_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });
});
