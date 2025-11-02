const AuditLog = require('../../models/AuditLog');

// Mock winston at the top level
jest.mock('winston', () => ({
  createLogger: jest.fn(),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
  },
  transports: {
    File: jest.fn(),
    Console: jest.fn(),
  },
}));

const AuditLoggerAccess = require('../../components/AuditLoggerAccess');

describe('AuditLoggerAccess', () => {
  let auditLogger;
  let mockLogger;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock logger instance
    mockLogger = {
      log: jest.fn(),
      add: jest.fn(),
      level: 'info',
    };

    // Set up winston.createLogger to return mockLogger
    require('winston').createLogger.mockReturnValue(mockLogger);

    auditLogger = new AuditLoggerAccess({
      logLevel: 'info',
      enableConsole: false,
      maxTrailSize: 100,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with default options', () => {
      const logger = new AuditLoggerAccess();
      expect(logger.logLevel).toBe('info');
      expect(logger.loggingLevels.success).toBe('info');
      expect(logger.loggingLevels.failure).toBe('warn');
      expect(logger.loggingLevels.error).toBe('error');
      expect(logger.auditTrail).toEqual([]);
    });

    test('should initialize with custom options', () => {
      const logger = new AuditLoggerAccess({
        logLevel: 'debug',
        successLevel: 'debug',
        failureLevel: 'error',
        maxTrailSize: 50,
      });
      expect(logger.logLevel).toBe('debug');
      expect(logger.loggingLevels.success).toBe('debug');
      expect(logger.loggingLevels.failure).toBe('error');
      expect(logger.maxTrailSize).toBe(50);
    });
  });

  describe('logValidationAttempt', () => {
    test('should log successful validation attempt', () => {
      const trustToken = {
        contentHash: 'hash123',
        timestamp: '2023-01-01T00:00:00Z',
        algorithm: 'sha256',
      };
      const validationResult = {
        isValid: true,
        validationTime: 0.5,
      };
      const requestContext = {
        method: 'POST',
        path: '/api/documents/generate-pdf',
        ip: '192.168.1.1',
        userAgent: 'TestAgent/1.0',
      };

      const auditId = auditLogger.logValidationAttempt(
        trustToken,
        validationResult,
        requestContext,
      );

      expect(auditId).toBeDefined();
      expect(auditLogger.auditTrail).toHaveLength(1);

      const entry = auditLogger.auditTrail[0];
      expect(entry).toBeInstanceOf(AuditLog);
      expect(entry.action).toBe('trust_token_validated');
      expect(entry.resourceId).toBe('hash123');
      expect(entry.details.trustToken.contentHash).toBe('hash123');
      expect(entry.details.validationResult.isValid).toBe(true);
      expect(entry.details.validationResult.validationTime).toBe(0.5);

      expect(mockLogger.log).toHaveBeenCalledWith(
        'info',
        'Access Validation Event',
        entry.toObject(),
      );
    });

    test('should log failed validation attempt', () => {
      const trustToken = { contentHash: 'hash123' };
      const validationResult = {
        isValid: false,
        error: 'Invalid signature',
        validationTime: 0.3,
      };
      const requestContext = {
        method: 'POST',
        path: '/api/test',
        ip: '192.168.1.1',
      };

      auditLogger.logValidationAttempt(trustToken, validationResult, requestContext);

      const entry = auditLogger.auditTrail[0];
      expect(entry.action).toBe('trust_token_validation_failed');
      expect(entry.details.validationResult.isValid).toBe(false);
      expect(entry.details.validationResult.error).toBe('Invalid signature');

      expect(mockLogger.log).toHaveBeenCalledWith(
        'warn',
        'Access Validation Event',
        entry.toObject(),
      );
    });
  });

  describe('logAccessEnforcement', () => {
    test('should log access granted', () => {
      const resourceId = 'doc123';
      const accessGranted = true;
      const enforcementLevel = 'strict';
      const requestContext = {
        method: 'GET',
        path: '/api/documents/doc123',
        ip: '192.168.1.1',
      };

      auditLogger.logAccessEnforcement(resourceId, accessGranted, enforcementLevel, requestContext);

      const entry = auditLogger.auditTrail[0];
      expect(entry.action).toBe('access_granted');
      expect(entry.resourceId).toBe('doc123');
      expect(entry.details.accessGranted).toBe(true);
      expect(entry.details.enforcementLevel).toBe('strict');

      expect(mockLogger.log).toHaveBeenCalledWith(
        'info',
        'Access Enforcement Event',
        entry.toObject(),
      );
    });

    test('should log access denied', () => {
      const resourceId = 'doc456';
      const accessGranted = false;
      const enforcementLevel = 'moderate';
      const requestContext = { method: 'GET', path: '/api/test' };

      auditLogger.logAccessEnforcement(resourceId, accessGranted, enforcementLevel, requestContext);

      const entry = auditLogger.auditTrail[0];
      expect(entry.action).toBe('access_denied');
      expect(entry.details.accessGranted).toBe(false);

      expect(mockLogger.log).toHaveBeenCalledWith(
        'warn',
        'Access Enforcement Event',
        entry.toObject(),
      );
    });
  });

  describe('logValidationError', () => {
    test('should log validation error', () => {
      const error = new Error('Validation service unavailable');
      const requestContext = {
        method: 'POST',
        path: '/api/test',
        ip: '192.168.1.1',
      };

      auditLogger.logValidationError(error, requestContext);

      const entry = auditLogger.auditTrail[0];
      expect(entry.action).toBe('validation_error');
      expect(entry.details.error.message).toBe('Validation service unavailable');
      expect(entry.details.error.name).toBe('Error');

      expect(mockLogger.log).toHaveBeenCalledWith(
        'error',
        'Access Validation Error',
        entry.toObject(),
      );
    });
  });

  describe('getAuditEntries', () => {
    beforeEach(() => {
      // Add some test entries
      auditLogger.logValidationAttempt(
        { contentHash: 'hash1' },
        { isValid: true },
        { method: 'POST', path: '/api/1' },
      );
      auditLogger.logValidationAttempt(
        { contentHash: 'hash2' },
        { isValid: false },
        { method: 'GET', path: '/api/2' },
      );
      auditLogger.logAccessEnforcement('doc1', true, 'strict', { method: 'GET' });
    });

    test('should return all entries without filters', () => {
      const entries = auditLogger.getAuditEntries();
      expect(entries).toHaveLength(3);
    });

    test('should filter by action', () => {
      const entries = auditLogger.getAuditEntries({ action: 'trust_token_validated' });
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('trust_token_validated');
    });

    test('should filter by validation outcome', () => {
      const entries = auditLogger.getAuditEntries({ isValid: false });
      expect(entries).toHaveLength(1);
      expect(entries[0].details.validationResult.isValid).toBe(false);
    });
  });

  describe('getAuditStats', () => {
    beforeEach(() => {
      auditLogger.logValidationAttempt(
        { contentHash: 'hash1' },
        { isValid: true },
        { method: 'POST' },
      );
      auditLogger.logValidationAttempt(
        { contentHash: 'hash2' },
        { isValid: false },
        { method: 'GET' },
      );
      auditLogger.logAccessEnforcement('doc1', true, 'strict', {});
    });

    test('should return correct statistics', () => {
      const stats = auditLogger.getAuditStats();
      expect(stats.totalEntries).toBe(3);
      expect(stats.actions.trust_token_validated).toBe(1);
      expect(stats.actions.trust_token_validation_failed).toBe(1);
      expect(stats.actions.access_granted).toBe(1);
      expect(stats.validationOutcomes.valid).toBe(1);
      expect(stats.validationOutcomes.invalid).toBe(1);
    });
  });

  describe('configurable logging levels', () => {
    test('should allow setting logging levels', () => {
      auditLogger.setLoggingLevel('success', 'debug');
      auditLogger.setLoggingLevel('failure', 'error');

      expect(auditLogger.loggingLevels.success).toBe('debug');
      expect(auditLogger.loggingLevels.failure).toBe('error');
    });

    test('should set overall log level', () => {
      auditLogger.setLogLevel('debug');
      expect(auditLogger.logLevel).toBe('debug');
      expect(mockLogger.level).toBe('debug');
    });
  });

  describe('audit trail management', () => {
    test('should maintain max trail size', () => {
      const smallLogger = new AuditLoggerAccess({ maxTrailSize: 2 });

      smallLogger.logValidationAttempt({}, { isValid: true }, {});
      smallLogger.logValidationAttempt({}, { isValid: true }, {});
      smallLogger.logValidationAttempt({}, { isValid: true }, {});

      expect(smallLogger.auditTrail).toHaveLength(2);
    });
  });

  describe('tamper-proofing', () => {
    test('should create AuditLog instances with proper structure', () => {
      auditLogger.logValidationAttempt(
        { contentHash: 'test' },
        { isValid: true },
        { method: 'POST', path: '/test' },
      );

      const entry = auditLogger.auditTrail[0];
      expect(entry).toBeInstanceOf(AuditLog);
      expect(entry.userId).toBe('ai-agent');
      expect(entry.action).toBe('trust_token_validated');
      expect(entry.isSecurityCritical()).toBe(false); // Successful validation is not security critical
    });

    test('should include all required fields for tamper-proofing', () => {
      auditLogger.logValidationAttempt(
        { contentHash: 'test' },
        { isValid: true },
        { method: 'POST', path: '/test', ip: '1.2.3.4', userAgent: 'Agent' },
      );

      const entry = auditLogger.auditTrail[0];
      const obj = entry.toObject();

      expect(obj.id).toBeDefined();
      expect(obj.timestamp).toBeDefined();
      expect(obj.userId).toBe('ai-agent');
      expect(obj.action).toBe('trust_token_validated');
      expect(obj.resourceId).toBe('test');
      expect(obj.details).toBeDefined();
      expect(obj.ipAddress).toBe('1.2.3.4');
      expect(obj.userAgent).toBe('Agent');
      expect(obj.signature).toBeDefined();
      expect(typeof obj.signature).toBe('string');
      expect(obj.signature.length).toBe(64); // SHA256 hex is 64 chars
    });

    test('should generate valid HMAC signatures', () => {
      auditLogger.logValidationAttempt(
        { contentHash: 'test' },
        { isValid: true },
        { method: 'POST', path: '/test' },
      );

      const entry = auditLogger.auditTrail[0];
      expect(entry.verifySignature()).toBe(true);
    });

    test('should detect tampering - modified field', () => {
      auditLogger.logValidationAttempt(
        { contentHash: 'test' },
        { isValid: true },
        { method: 'POST', path: '/test' },
      );

      const entry = auditLogger.auditTrail[0];
      const obj = entry.toObject();

      // Modify a field
      obj.userId = 'modified-user';

      // Create new instance from modified object
      const modifiedEntry = AuditLog.fromObject(obj, { secret: auditLogger.secret });

      expect(modifiedEntry.verifySignature()).toBe(false);
    });

    test('should detect tampering - modified signature', () => {
      auditLogger.logValidationAttempt(
        { contentHash: 'test' },
        { isValid: true },
        { method: 'POST', path: '/test' },
      );

      const entry = auditLogger.auditTrail[0];
      entry.signature = 'a'.repeat(64); // Valid length but wrong signature

      expect(entry.verifySignature()).toBe(false);
    });

    test('should maintain signature integrity across serialization', () => {
      auditLogger.logValidationAttempt(
        { contentHash: 'test' },
        { isValid: true },
        { method: 'POST', path: '/test' },
      );

      const entry = auditLogger.auditTrail[0];
      const obj = entry.toObject();

      // Simulate deserialization
      const deserializedEntry = AuditLog.fromObject(obj, { secret: auditLogger.secret });

      expect(deserializedEntry.verifySignature()).toBe(true);
      expect(deserializedEntry.id).toBe(entry.id);
      expect(deserializedEntry.action).toBe(entry.action);
    });
  });
});
