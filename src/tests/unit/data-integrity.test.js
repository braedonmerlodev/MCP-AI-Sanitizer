const Joi = require('joi');
const DataIntegrityValidator = require('../../components/DataIntegrityValidator');
const SchemaValidator = require('../../components/data-integrity/SchemaValidator');
const ReferentialChecker = require('../../components/data-integrity/ReferentialChecker');
const CryptographicHasher = require('../../components/data-integrity/CryptographicHasher');
const ErrorRouter = require('../../components/data-integrity/ErrorRouter');
const AuditLogger = require('../../components/data-integrity/AuditLogger');

describe('DataIntegrityValidator', () => {
  let validator;

  beforeEach(() => {
    // Disable auditing for tests to avoid file I/O
    validator = new DataIntegrityValidator({
      enableAuditing: false,
    });

    test('should include resource info', async () => {
      await auditLogger.logRiskAssessmentDecision(
        'detection',
        'High',
        {},
        { resourceId: 'res123', resourceType: 'api_request' },
      );

      const entries = auditLogger.getAuditEntries({ operation: 'risk_assessment_decision' });
      expect(entries[0].details.resourceInfo.resourceId).toBe('res123');
      expect(entries[0].details.resourceInfo.type).toBe('api_request');
    });
  });

  describe('logHighRiskCase', () => {
    test('should log high-risk case with ML fields asynchronously', async () => {
      const metadata = {
        userId: 'user123',
        resourceId: 'res456',
        sessionId: 'sess789',
        stage: 'detection',
      };

      const mlFields = {
        threatPatternId: 'pattern123',
        confidenceScore: 0.95,
        mitigationActions: ['block', 'alert'],
        featureVector: { indicators: ['malicious'] },
        trainingLabels: { label: 'high_risk' },
        anomalyScore: 0.9,
        detectionTimestamp: new Date().toISOString(),
      };

      const auditId = await auditLogger.logHighRiskCase(metadata, mlFields);

      expect(auditId).toMatch(/^audit_/);

      const entries = auditLogger.getAuditEntries({ operation: 'high_risk_case' });
      expect(entries).toHaveLength(1);
      expect(entries[0].operation).toBe('high_risk_case');
      expect(entries[0].details).toEqual({
        ...metadata,
        mlFields: {
          ...mlFields,
          riskCategory: 'high',
        },
      });
      expect(entries[0].context.userId).toBe('user123');
      expect(entries[0].context.stage).toBe('high_risk_detection');
      expect(entries[0].context.severity).toBe('warning');
      expect(entries[0].context.logger).toBe('HighRiskLogger');
    });

    test('should redact PII in metadata', async () => {
      const metadata = {
        userId: 'test@example.com',
        resourceId: 'res456',
      };

      const mlFields = {
        threatPatternId: 'pattern123',
        confidenceScore: 0.95,
      };

      await auditLogger.logHighRiskCase(metadata, mlFields);

      const entries = auditLogger.getAuditEntries({ operation: 'high_risk_case' });
      expect(entries[0].context.userId).toBe('[EMAIL_REDACTED]');
    });
  });

  describe('logUnknownRiskCase', () => {
    test('should log unknown-risk case with ML fields asynchronously', async () => {
      const metadata = {
        userId: 'user123',
        resourceId: 'res456',
        sessionId: 'sess789',
        stage: 'detection',
      };

      const mlFields = {
        threatPatternId: 'unknown_pattern',
        confidenceScore: 0.2,
        mitigationActions: ['review'],
        featureVector: { indicators: ['unclear'] },
        trainingLabels: { label: 'unknown_risk' },
        anomalyScore: 0.1,
        detectionTimestamp: new Date().toISOString(),
      };

      const auditId = await auditLogger.logUnknownRiskCase(metadata, mlFields);

      expect(auditId).toMatch(/^audit_/);

      const entries = auditLogger.getAuditEntries({ operation: 'unknown_risk_case' });
      expect(entries).toHaveLength(1);
      expect(entries[0].operation).toBe('unknown_risk_case');
      expect(entries[0].details).toEqual({
        ...metadata,
        mlFields: {
          ...mlFields,
          riskCategory: 'unknown',
        },
      });
      expect(entries[0].context.userId).toBe('user123');
      expect(entries[0].context.stage).toBe('unknown_risk_detection');
      expect(entries[0].context.severity).toBe('info');
      expect(entries[0].context.logger).toBe('UnknownRiskLogger');
    });
  });

  describe('validateData', () => {
    test('should fail validation for invalid data', async () => {
      const result = await validator.validateData('not a number', { schema: 'number' });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.details.schema.isValid).toBe(false);
    });
  });
});

    test('should validate object with referential integrity', async () => {
      const testData = {
        id: 'test-123',
        userId: 'user-456',
        timestamp: new Date().toISOString(),
      };

      // Add a referential rule for testing
      validator.addReferentialRule('userId', {
        table: 'users',
        field: 'id',
        required: true,
      });

      const result = await validator.validateData(testData);

      expect(result.details.referential).toBeDefined();
      expect(result.details.criticalFields).toBeDefined();
    });

    test('should generate hash references for objects', async () => {
      const testData = 'test data string';

      const result = await validator.validateData(testData, { schema: 'string' });

      expect(result.details.hashReference).toBeDefined();
      expect(result.details.hashReference.algorithm).toBe('sha256');
      expect(result.details.hashReference.rawDataHash).toBeDefined();
      expect(result.details.hashReference.sanitizedDataHash).toBeDefined();
    });

    test('should route errors for invalid data', async () => {
      const invalidData = null;

      const result = await validator.validateData(invalidData, { schema: 'string' });

      expect(result.isValid).toBe(false);
      expect(result.details.errorRouting).toBeDefined();
    });
  });

  describe('generateHash', () => {
    test('should generate consistent hashes', () => {
      const data = 'test data';
      const hash1 = validator.generateHash(data);
      const hash2 = validator.generateHash(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });

    test('should generate different hashes for different data', () => {
      const hash1 = validator.generateHash('data1');
      const hash2 = validator.generateHash('data2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyHash', () => {
    test('should verify correct hash', () => {
      const data = 'test data';
      const hash = validator.generateHash(data);

      const isValid = validator.verifyHash(data, hash);
      expect(isValid).toBe(true);
    });

    test('should reject incorrect hash', () => {
      const data = 'test data';
      const wrongHash = 'invalidhash1234567890123456789012345678901234567890'; // Same length

      const isValid = validator.verifyHash(data, wrongHash);
      expect(isValid).toBe(false);
    });
  });

  describe('routeError', () => {
    test('should route error successfully', async () => {
      const errorRecord = {
        errorType: 'schema',
        details: { errors: ['Invalid format'] },
        timestamp: new Date().toISOString(),
      };

      const result = await validator.routeError(errorRecord);

      expect(result.success).toBe(true);
      expect(result.category).toBe('schema');
      expect(result.queueId).toBeDefined();
    });
  });

  describe('getStats', () => {
    test('should return statistics', () => {
      const stats = validator.getStats();

      expect(stats).toHaveProperty('errorStats');
      expect(stats).toHaveProperty('auditStats');
      expect(stats).toHaveProperty('schemaStats');
    });
  });
});

describe('SchemaValidator', () => {
  let schemaValidator;

  beforeEach(() => {
    schemaValidator = new SchemaValidator();
  });

  describe('validate', () => {
    test('should validate string against string schema', () => {
      const result = schemaValidator.validate('test', 'string');
      expect(result.isValid).toBe(true);
    });

    test('should validate number against number schema', () => {
      const result = schemaValidator.validate(42, 'number');
      expect(result.isValid).toBe(true);
    });

    test('should fail validation for wrong type', () => {
      const result = schemaValidator.validate('not a number', 'number');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate email', () => {
      const result = schemaValidator.validate('test@example.com', 'email');
      expect(result.isValid).toBe(true);
    });

    test('should fail invalid email', () => {
      const result = schemaValidator.validate('not-an-email', 'email');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateObject', () => {
    test('should validate multiple fields', () => {
      const data = {
        name: 'John',
        age: 30,
        email: 'john@example.com',
      };

      const fieldSchemas = {
        name: 'string',
        age: 'number',
        email: 'email',
      };

      const result = schemaValidator.validateObject(data, fieldSchemas);

      expect(result.isValid).toBe(true);
      expect(result.summary.validFields).toBe(3);
    });

    test('should handle validation failures', () => {
      const data = {
        name: 'John',
        age: 'not a number',
        email: 'invalid-email',
      };

      const fieldSchemas = {
        name: 'string',
        age: 'number',
        email: 'email',
      };

      const result = schemaValidator.validateObject(data, fieldSchemas);

      expect(result.isValid).toBe(false);
      expect(result.summary.invalidFields).toBe(2);
    });
  });

  describe('custom schemas', () => {
    test('should validate with custom schema', () => {
      const customSchema = Joi.object({
        name: Joi.string().required(),
        value: Joi.number().min(0),
      });

      const result = schemaValidator.validate({ name: 'test', value: 10 }, customSchema);
      console.log('Custom schema validation result:', result);
      expect(result.isValid).toBe(true);
    });

    test('should add and use custom schema', () => {
      const customSchema = Joi.object({
        name: Joi.string().required(),
        value: Joi.number().min(0),
      });

      schemaValidator.addSchema('customObject', customSchema);

      const result = schemaValidator.validate({ name: 'test', value: 10 }, 'customObject');
      expect(result.isValid).toBe(true);
    });
  });
});

describe('ReferentialChecker', () => {
  let refChecker;

  beforeEach(() => {
    refChecker = new ReferentialChecker();
  });

  describe('checkReferentialIntegrity', () => {
    test('should pass for valid references', async () => {
      // Add rules for testing
      refChecker.addReferentialRule('userId', {
        table: 'users',
        field: 'id',
        required: true,
      });
      refChecker.addReferentialRule('productId', {
        table: 'products',
        field: 'id',
        required: false,
      });

      const data = {
        userId: 'valid-user',
        productId: 123,
      };

      const result = await refChecker.checkReferentialIntegrity(data);

      expect(result.isValid).toBe(true);
      expect(result.summary.validFields).toBe(2);
    });

    test('should handle missing optional references', async () => {
      // Create a fresh instance for this test
      const freshChecker = new ReferentialChecker();
      // Clear default rules
      freshChecker.referentialRules = {};
      freshChecker.addReferentialRule('userId', {
        table: 'users',
        field: 'id',
        required: true,
      });

      const data = {
        userId: 'valid-user',
      };

      const result = await freshChecker.checkReferentialIntegrity(data);

      expect(result.isValid).toBe(true);
      expect(result.summary.validFields).toBe(1);
    });
  });

  describe('checkCriticalFields', () => {
    test('should pass when all critical fields present', () => {
      const data = {
        id: 'test-123',
        timestamp: new Date().toISOString(),
        dataHash: 'hash123',
        validationStatus: 'valid',
      };

      const result = refChecker.checkCriticalFields(data);

      expect(result.isValid).toBe(true);
      expect(result.nullFields).toHaveLength(0);
    });

    test('should fail when critical fields are null', () => {
      const data = {
        id: null,
        timestamp: new Date().toISOString(),
        dataHash: 'hash123',
      };

      const result = refChecker.checkCriticalFields(data);

      expect(result.isValid).toBe(false);
      expect(result.nullFields).toContain('id');
    });
  });

  describe('addReferentialRule', () => {
    test('should add custom referential rule', () => {
      refChecker.addReferentialRule('orderId', {
        table: 'orders',
        field: 'id',
        required: true,
      });

      // The rule should be added (internal test)
      expect(refChecker.referentialRules.orderId).toBeDefined();
    });
  });
});

describe('CryptographicHasher', () => {
  let hasher;

  beforeEach(() => {
    hasher = new CryptographicHasher();
  });

  describe('generateHash', () => {
    test('should generate SHA-256 hash', () => {
      const hash = hasher.generateHash('test data');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should generate consistent hashes', () => {
      const hash1 = hasher.generateHash('test');
      const hash2 = hasher.generateHash('test');
      expect(hash1).toBe(hash2);
    });

    test('should use salt when provided', () => {
      const hash1 = hasher.generateHash('test', 'salt1');
      const hash2 = hasher.generateHash('test', 'salt2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyHash', () => {
    test('should verify correct hash', () => {
      const data = 'test data';
      const hash = hasher.generateHash(data);
      const isValid = hasher.verifyHash(data, hash);
      expect(isValid).toBe(true);
    });

    test('should reject tampered data', () => {
      const originalHash = hasher.generateHash('original');
      const isValid = hasher.verifyHash('tampered', originalHash);
      expect(isValid).toBe(false);
    });
  });

  describe('createHashReference', () => {
    test('should create hash reference object', () => {
      const rawData = 'raw input';
      const sanitizedData = 'sanitized output';

      const hashRef = hasher.createHashReference(rawData, sanitizedData, {
        source: 'test',
      });

      expect(hashRef).toHaveProperty('id');
      expect(hashRef).toHaveProperty('rawDataHash');
      expect(hashRef).toHaveProperty('sanitizedDataHash');
      expect(hashRef).toHaveProperty('combinedHash');
      expect(hashRef).toHaveProperty('algorithm', 'sha256');
      expect(hashRef).toHaveProperty('timestamp');
      expect(hashRef.metadata).toHaveProperty('source', 'test');
    });
  });

  describe('verifyDataLineage', () => {
    test('should verify valid lineage', () => {
      const data = 'test data';
      const hashRef = hasher.createHashReference(data, data);

      const result = hasher.verifyDataLineage(data, hashRef);
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid lineage', () => {
      const hashRef = hasher.createHashReference('original', 'original');
      const result = hasher.verifyDataLineage('tampered', hashRef);
      expect(result.isValid).toBe(false);
    });
  });
});

describe('ErrorRouter', () => {
  let errorRouter;

  beforeEach(() => {
    errorRouter = new ErrorRouter();
  });

  describe('routeError', () => {
    test('should route schema error', async () => {
      const errorRecord = {
        errorType: 'schema',
        details: { errors: ['Invalid format'] },
        timestamp: new Date().toISOString(),
      };

      const result = await errorRouter.routeError(errorRecord);

      expect(result.success).toBe(true);
      expect(result.category).toBe('schema');
      expect(result.priority).toBe('high');
    });

    test('should route critical cryptographic error', async () => {
      const errorRecord = {
        errorType: 'cryptographic',
        details: { error: 'Hash verification failed' },
        timestamp: new Date().toISOString(),
      };

      const result = await errorRouter.routeError(errorRecord);

      expect(result.success).toBe(true);
      expect(result.category).toBe('cryptographic');
      expect(result.priority).toBe('critical');
    });
  });

  describe('getQueuedErrors', () => {
    test('should retrieve queued errors', () => {
      // First add an error
      errorRouter.routeError({
        errorType: 'schema',
        details: { errors: ['test'] },
        timestamp: new Date().toISOString(),
      });

      const errors = errorRouter.getQueuedErrors('schema-validation-errors');
      expect(errors).toHaveLength(1);
      expect(errors[0].status).toBe('queued');
    });
  });

  describe('resolveError', () => {
    test('should resolve error', async () => {
      const routeResult = await errorRouter.routeError({
        errorType: 'schema',
        details: { errors: ['test'] },
        timestamp: new Date().toISOString(),
      });

      const resolved = errorRouter.resolveError(routeResult.queueId, 'Fixed');
      expect(resolved).toBe(true);

      const errors = errorRouter.getQueuedErrors('schema-validation-errors', {
        status: 'resolved',
      });
      expect(errors).toHaveLength(1);
    });
  });

  describe('getErrorStats', () => {
    test('should return error statistics', () => {
      const stats = errorRouter.getErrorStats();
      expect(stats).toHaveProperty('totalQueued', 0);
      expect(stats).toHaveProperty('byCategory');
      expect(stats).toHaveProperty('byQueue');
    });
  });
});

describe('AuditLogger', () => {
  let auditLogger;

  beforeEach(() => {
    // Use memory-only logging for tests
    auditLogger = new AuditLogger({
      enableConsole: false,
      maxTrailSize: 100,
    });
  });

  describe('logOperation', () => {
    test('should log operation', () => {
      const auditId = auditLogger.logOperation(
        'validation',
        {
          isValid: true,
          dataType: 'string',
        },
        { userId: 'test-user' },
      );

      expect(auditId).toMatch(/^audit_/);

      const entries = auditLogger.getAuditEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].operation).toBe('validation');
      expect(entries[0].context.userId).toBe('test-user');
    });
  });

  describe('logValidation', () => {
    test('should log validation result', () => {
      const validationResult = {
        isValid: false,
        errors: ['Invalid format'],
        type: 'schema',
      };

      const auditId = auditLogger.logValidation(validationResult, { source: 'test' });
      expect(auditId).toBeDefined();

      const entries = auditLogger.getAuditEntries();
      expect(entries[0].operation).toBe('validation');
      expect(entries[0].details.isValid).toBe(false);
    });
  });

  describe('logRawDataAccess', () => {
    test('should log raw data access', () => {
      const auditId = auditLogger.logRawDataAccess('resource-123', 'read', {
        userId: 'admin',
        reason: 'investigation',
      });
      expect(auditId).toBeDefined();

      const entries = auditLogger.getAuditEntries();
      expect(entries[0].operation).toBe('raw_data_access');
      expect(entries[0].context.severity).toBe('warning');
    });
  });

  describe('getAuditEntries', () => {
    test('should filter entries by operation', () => {
      auditLogger.logOperation('validation', {});
      auditLogger.logOperation('hash_operation', {});
      auditLogger.logOperation('validation', {});

      const validationEntries = auditLogger.getAuditEntries({ operation: 'validation' });
      expect(validationEntries).toHaveLength(2);
    });

    test('should filter entries by date range', () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      auditLogger.logOperation('test', {}, {}, pastDate.toISOString());

      // Create start date before logging the recent entry
      const startDate = new Date();
      auditLogger.logOperation('test', {}, {}, startDate.toISOString());

      const recentEntries = auditLogger.getAuditEntries({
        startDate: startDate.toISOString(),
      });
      expect(recentEntries).toHaveLength(1);
    });
  });

  describe('getAuditStats', () => {
    test('should return audit statistics', () => {
      auditLogger.logOperation('validation', {});
      auditLogger.logOperation('hash_operation', {});
      auditLogger.logOperation('error_routing', {});

      const stats = auditLogger.getAuditStats();
      expect(stats.totalEntries).toBe(3);
      expect(stats.operations).toHaveProperty('validation', 1);
      expect(stats.operations).toHaveProperty('hash_operation', 1);
      expect(stats.operations).toHaveProperty('error_routing', 1);
    });
  });

  describe('logRiskAssessmentDecision', () => {
    test('should log risk assessment decision asynchronously', async () => {
      const auditId = await auditLogger.logRiskAssessmentDecision(
        'detection',
        'High',
        { riskScore: 0.95, triggers: ['malicious_pattern'] },
        { userId: 'user123', resourceId: 'req456', stage: 'sanitization' },
      );

      expect(auditId).toMatch(/^audit_/);

      const entries = auditLogger.getAuditEntries({ operation: 'risk_assessment_decision' });
      expect(entries).toHaveLength(1);
      expect(entries[0].operation).toBe('risk_assessment_decision');
      expect(entries[0].details.decisionType).toBe('detection');
      expect(entries[0].details.riskLevel).toBe('High');
      expect(entries[0].details.assessmentParameters.riskScore).toBe(0.95);
      expect(entries[0].context.userId).toBe('user123');
      expect(entries[0].context.stage).toBe('sanitization');
      expect(entries[0].context.logger).toBe('RiskAssessmentLogger');
    });

    test('should redact PII in assessment parameters', async () => {
      const auditId = await auditLogger.logRiskAssessmentDecision(
        'warning',
        'Unknown',
        { triggers: ['email@example.com', '123-456-7890'] },
        { userId: 'test@example.com' },
      );

      expect(auditId).toBeDefined();

      const entries = auditLogger.getAuditEntries({ operation: 'risk_assessment_decision' });
      expect(entries[0].details.assessmentParameters.triggers).toEqual([
        '[EMAIL_REDACTED]',
        '[PHONE_REDACTED]',
      ]);
      expect(entries[0].context.userId).toBe('[EMAIL_REDACTED]');
    });

    test('should handle different decision types', async () => {
      const auditId1 = await auditLogger.logRiskAssessmentDecision('escalation', 'High', {}, {});
      const auditId2 = await auditLogger.logRiskAssessmentDecision('classification', 'Low', {}, {});
      const auditId3 = await auditLogger.logRiskAssessmentDecision('detection', 'Unknown', {}, {});

      expect(auditId1).toBeDefined();
      expect(auditId2).toBeDefined();
      expect(auditId3).toBeDefined();

      const entries = auditLogger.getAuditEntries({ operation: 'risk_assessment_decision' });
      expect(entries).toHaveLength(3);
      const decisionTypes = entries.map((e) => e.details.decisionType);
      expect(decisionTypes).toContain('escalation');
      expect(decisionTypes).toContain('classification');
      expect(decisionTypes).toContain('detection');
    });

    test('should set severity based on risk level', async () => {
      const auditId1 = await auditLogger.logRiskAssessmentDecision('detection', 'High', {}, {});
      const auditId2 = await auditLogger.logRiskAssessmentDecision('detection', 'Low', {}, {});

      expect(auditId1).toBeDefined();
      expect(auditId2).toBeDefined();

      const entries = auditLogger.getAuditEntries({ operation: 'risk_assessment_decision' });
      expect(entries.find((e) => e.details.riskLevel === 'High').context.severity).toBe('warning');
      expect(entries.find((e) => e.details.riskLevel === 'Low').context.severity).toBe('info');
    });

    test('should include resource info', async () => {
      const auditId = await auditLogger.logRiskAssessmentDecision(
        'detection',
        'High',
        {},
        { resourceId: 'res123', resourceType: 'api_request' },
      );

      expect(auditId).toBeDefined();

      const entries = auditLogger.getAuditEntries({ operation: 'risk_assessment_decision' });
      expect(entries[0].details.resourceInfo.resourceId).toBe('res123');
      expect(entries[0].details.resourceInfo.type).toBe('api_request');
    });
  });

  describe('logHighRiskCase', () => {
    test('should log high-risk case with ML fields asynchronously', async () => {
      const metadata = {
        userId: 'user123',
        resourceId: 'res456',
        sessionId: 'sess789',
        stage: 'detection',
      };

      const mlFields = {
        threatPatternId: 'pattern123',
        confidenceScore: 0.95,
        mitigationActions: ['block', 'alert'],
        featureVector: { indicators: ['malicious'] },
        trainingLabels: { label: 'high_risk' },
        anomalyScore: 0.9,
        detectionTimestamp: new Date().toISOString(),
      };

      const auditId = await auditLogger.logHighRiskCase(metadata, mlFields);

      expect(auditId).toMatch(/^audit_/);

      const entries = auditLogger.getAuditEntries({ operation: 'high_risk_case' });
      expect(entries).toHaveLength(1);
      expect(entries[0].operation).toBe('high_risk_case');
      expect(entries[0].details).toEqual({
        ...metadata,
        mlFields: {
          ...mlFields,
          riskCategory: 'high',
        },
      });
      expect(entries[0].context.userId).toBe('user123');
      expect(entries[0].context.stage).toBe('high_risk_detection');
      expect(entries[0].context.severity).toBe('warning');
      expect(entries[0].context.logger).toBe('HighRiskLogger');
    });

    test('should redact PII in metadata', async () => {
      const metadata = {
        userId: 'test@example.com',
        resourceId: 'res456',
      };

      const mlFields = {
        threatPatternId: 'pattern123',
        confidenceScore: 0.95,
      };

      await auditLogger.logHighRiskCase(metadata, mlFields);

      const entries = auditLogger.getAuditEntries({ operation: 'high_risk_case' });
      expect(entries[0].context.userId).toBe('[EMAIL_REDACTED]');
    });
  });

  describe('logUnknownRiskCase', () => {
    test('should log unknown-risk case with ML fields asynchronously', async () => {
      const metadata = {
        userId: 'user123',
        resourceId: 'res456',
        sessionId: 'sess789',
        stage: 'detection',
      };

      const mlFields = {
        threatPatternId: 'unknown_pattern',
        confidenceScore: 0.2,
        mitigationActions: ['review'],
        featureVector: { indicators: ['unclear'] },
        trainingLabels: { label: 'unknown_risk' },
        anomalyScore: 0.1,
        detectionTimestamp: new Date().toISOString(),
      };

      const auditId = await auditLogger.logUnknownRiskCase(metadata, mlFields);

      expect(auditId).toMatch(/^audit_/);

      const entries = auditLogger.getAuditEntries({ operation: 'unknown_risk_case' });
      expect(entries).toHaveLength(1);
      expect(entries[0].operation).toBe('unknown_risk_case');
      expect(entries[0].details).toEqual({
        ...metadata,
        mlFields: {
          ...mlFields,
          riskCategory: 'unknown',
        },
      });
      expect(entries[0].context.userId).toBe('user123');
      expect(entries[0].context.stage).toBe('unknown_risk_detection');
      expect(entries[0].context.severity).toBe('info');
      expect(entries[0].context.logger).toBe('UnknownRiskLogger');
    });
  });
});
