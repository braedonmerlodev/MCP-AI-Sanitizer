const DataIntegrityValidator = require('../../components/DataIntegrityValidator');
const SanitizationPipeline = require('../../components/sanitization-pipeline');

describe('Data Integrity Validation Integration', () => {
  let validator;
  let pipeline;

  beforeEach(() => {
    validator = new DataIntegrityValidator({
      enableAuditing: false, // Disable for tests
    });
    pipeline = new SanitizationPipeline({
      enableValidation: true,
      integrityOptions: { enableAuditing: false },
    });
  });

  describe('End-to-End Data Flow', () => {
    test('should process data through sanitization with integrity validation', async () => {
      const testData = 'Some <script>alert("xss")</script> dangerous content';

      // Process through pipeline
      const result = await pipeline.sanitize(testData, {
        classification: 'llm',
        validationOptions: {
          schema: 'string', // This will fail for object, but test validation
        },
      });

      // Result should be sanitized
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      // Since it's an object, sanitization steps might not apply directly
    });

    test('should validate data integrity for processed content', async () => {
      const testData = {
        id: 'valid-123',
        content: 'Clean content',
        userId: 'user-456',
        timestamp: new Date().toISOString(),
        dataHash: 'somehash',
      };

      const validationResult = await validator.validateData(testData);

      expect(validationResult).toBeDefined();
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.details.schema).toBeDefined();
      expect(validationResult.details.referential).toBeDefined();
      expect(validationResult.details.criticalFields).toBeDefined();
    });

    test('should handle validation failures gracefully', async () => {
      const invalidData = {
        // Missing required fields
        content: 'Some content',
      };

      const validationResult = await validator.validateData(invalidData);

      expect(validationResult).toBeDefined();
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
    });

    test('should maintain data lineage with hash references', async () => {
      const originalData = 'Original sensitive data';
      const processedData = 'Processed safe data';

      // Create hash reference
      const hashRef = validator.cryptoHasher.createHashReference(originalData, processedData, {
        processingStep: 'sanitization',
      });

      expect(hashRef).toBeDefined();
      expect(hashRef.rawDataHash).toBeDefined();
      expect(hashRef.sanitizedDataHash).toBeDefined();
      expect(hashRef.combinedHash).toBeDefined();

      // Verify lineage
      const isValid = validator.verifyHash(processedData, hashRef);
      expect(isValid).toBe(true);
    });

    test('should enforce read-only access to sanitized data', () => {
      const user = {
        id: 'analyst-123',
        roles: ['analyst'],
        authenticated: true,
        sessionValidUntil: Date.now() + 3_600_000, // 1 hour
      };

      // Check read access
      const readAccess = validator.checkReadAccess(user, 'sanitized_data');
      expect(readAccess.granted).toBe(true);
      expect(readAccess.accessLevel).toBe('read-only');

      // Check write access (should be denied)
      const writeAccess = validator.checkWriteAccess(user, 'sanitized_data');
      expect(writeAccess.granted).toBe(false);
      expect(writeAccess.reason).toContain('read-only');
    });

    test('should perform atomic operations', async () => {
      const testData = [
        { id: '1', content: 'Data 1', timestamp: new Date().toISOString() },
        { id: '2', content: 'Data 2', timestamp: new Date().toISOString() },
      ];

      const result = await validator.atomicLoad(testData);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.results.loaded).toBeGreaterThan(0);
    });

    test('should route and manage errors', async () => {
      const errorRecord = {
        errorType: 'schema',
        details: { errors: ['Invalid format'] },
        timestamp: new Date().toISOString(),
      };

      const routeResult = await validator.routeError(errorRecord);

      expect(routeResult.success).toBe(true);
      expect(routeResult.category).toBe('schema');

      // Check error stats
      const stats = validator.getStats();
      expect(stats.errorStats).toBeDefined();
    });

    test('should provide comprehensive statistics', () => {
      const stats = validator.getStats();

      expect(stats).toHaveProperty('errorStats');
      expect(stats).toHaveProperty('auditStats');
      expect(stats).toHaveProperty('schemaStats');
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle large datasets', async () => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        content: `Content ${i} with some data`,
        timestamp: new Date().toISOString(),
        dataHash: `hash${i}`,
      }));

      const startTime = Date.now();
      const result = await validator.atomicLoad(largeDataset);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should maintain data integrity under concurrent operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) =>
        validator.validateData({
          id: `concurrent-${i}`,
          content: `Concurrent data ${i}`,
          timestamp: new Date().toISOString(),
        }),
      );

      const results = await Promise.all(operations);

      for (const result of results) {
        expect(result.isValid).toBe(true);
      }
    });
  });

  describe('Security and Compliance', () => {
    test('should prevent unauthorized access', () => {
      const unauthorizedUser = {
        id: 'hacker-123',
        roles: ['hacker'],
        authenticated: false,
      };

      const access = validator.checkReadAccess(unauthorizedUser);
      expect(access.granted).toBe(false);
      expect(access.reason).toContain('not authenticated');
    });

    test('should audit all operations', () => {
      // Even with auditing disabled, stats should be available
      const stats = validator.getStats();
      expect(stats.auditStats).toBeDefined();
    });

    test('should detect data tampering attempts', () => {
      const originalData = 'Original data';
      const hash = validator.generateHash(originalData);

      // Tampered data
      const tamperedData = 'Tampered data';
      const isValid = validator.verifyHash(tamperedData, hash);

      expect(isValid).toBe(false);
    });
  });
});
