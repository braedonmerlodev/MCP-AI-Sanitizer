const request = require('supertest');
const express = require('express');
const DataExportManager = require('../../components/data-integrity/DataExportManager');
const ProxySanitizer = require('../../components/proxy-sanitizer');
const AuditLog = require('../../models/AuditLog');

const mockAccessValidation = (req, res, next) => next();

describe('End-to-End Pipeline Testing', () => {
  let app;
  let mockAuditLogger;
  let mockAccessControlEnforcer;
  let dataExportManager;
  let proxySanitizer;

  beforeEach(() => {
    // Mock dependencies
    mockAuditLogger = {
      logOperation: jest.fn().mockResolvedValue({ id: 'audit-123' }),
      getAuditEntries: jest.fn().mockReturnValue([]),
    };

    mockAccessControlEnforcer = {
      enforce: jest.fn().mockReturnValue({ allowed: true }),
    };

    // Initialize real components with mocks
    proxySanitizer = new ProxySanitizer();
    dataExportManager = new DataExportManager({
      auditLogger: mockAuditLogger,
      accessControlEnforcer: mockAccessControlEnforcer,
      exportDir: './test-exports',
    });

    // Mock the export method to return metadata for testing
    dataExportManager.exportTrainingData = jest
      .fn()
      .mockImplementation((format, filters, context) => {
        // Check access control
        const accessResult = mockAccessControlEnforcer.enforce(context.req, 'strict');
        if (!accessResult.allowed) {
          throw new Error('Access denied');
        }
        return Promise.resolve({
          filePath: '/test/path/export.json',
          recordCount: 1,
          format: format,
          fileSize: 1024,
        });
      });

    // Create test app
    app = express();
    app.use(express.json());

    // Mock middleware
    app.use((req, res, next) => {
      req.user = { id: 'test-user' };
      req.ip = '127.0.0.1';
      next();
    });

    // Mock access validation middleware
    app.use('/api/export/training-data', mockAccessValidation);
    app.use('/api/sanitize/json', mockAccessValidation);

    // Sanitize endpoint
    app.post('/api/sanitize/json', mockAccessValidation, async (req, res) => {
      try {
        const options = {
          classification: req.body.classification || 'llm',
          generateTrustToken: true,
        };
        const result = await proxySanitizer.sanitize(req.body.content, options);

        // Create audit log entry like the real API
        const auditLog = new AuditLog({
          userId: req.user?.id || 'anonymous',
          action: 'content_sanitization_completed',
          resourceId: result.trustToken?.contentHash || 'unknown',
          details: {
            originalLength: req.body.content.length,
            sanitizedLength: result.sanitizedData.length,
            totalTimeMs: 100, // mock time
            classification: req.body.classification || 'llm',
            trustTokenGenerated: !!result.trustToken,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            sessionId: req.session?.id,
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          sessionId: req.session?.id,
        });

        // Add to mock audit data for export
        const auditEntry = {
          id: auditLog.id,
          timestamp: auditLog.timestamp,
          operation: 'high_fidelity_data_collection', // This is what DataExportManager looks for
          details: {
            inputDataHash: result.trustToken?.contentHash || 'hash123',
            processingSteps: [],
            decisionOutcome: { decision: 'sanitized', reasoning: 'test', riskScore: 0.1 },
            featureVector: {},
            contextMetadata: {
              originalLength: req.body.content.length,
              sanitizedLength: result.sanitizedData.length,
              processingTime: 1,
            },
          },
        };

        // Add to mock audit data
        const currentData = mockAuditLogger.getAuditEntries();
        currentData.push(auditEntry);
        mockAuditLogger.getAuditEntries.mockReturnValue(currentData);

        res.json({
          sanitizedContent: result.sanitizedData,
          trustToken: result.trustToken,
          metadata: {
            originalLength: req.body.content.length,
            sanitizedLength: result.sanitizedData.length,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        res.status(500).json({ error: 'Sanitization failed' });
      }
    });

    // Export endpoint
    app.post('/api/export/training-data', mockAccessValidation, async (req, res) => {
      // Check access control
      const accessResult = mockAccessControlEnforcer.enforce(req, 'strict');
      if (!accessResult.allowed) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { format = 'json', ...filters } = req.body;

      const validFormats = ['json', 'csv', 'parquet'];
      if (!validFormats.includes(format)) {
        return res.status(400).json({
          error: `Invalid format. Supported formats: ${validFormats.join(', ')}`,
        });
      }

      try {
        const exportResult = await dataExportManager.exportTrainingData(format, filters, {
          userId: req.user?.id || 'system',
          ipAddress: req.ip,
          req,
        });

        // For testing, return metadata as JSON
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Export-Format', format);
        res.setHeader('X-Export-Record-Count', exportResult.recordCount);
        res.setHeader('X-Export-File-Size', exportResult.fileSize);

        res.json({
          success: true,
          filePath: exportResult.filePath,
          recordCount: exportResult.recordCount,
          format: exportResult.format,
          fileSize: exportResult.fileSize,
        });
      } catch (error) {
        res.status(500).json({ error: 'Export failed' });
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Pipeline Flow', () => {
    it('should complete full pipeline: sanitize → collect → export', async () => {
      // Step 1: Submit data for sanitization
      const testContent = 'This is test content for sanitization.';

      const sanitizeResponse = await request(app)
        .post('/api/sanitize/json')
        .send({ content: testContent })
        .expect(200);

      expect(sanitizeResponse.body).toHaveProperty('sanitizedContent');
      expect(sanitizeResponse.body).toHaveProperty('trustToken');

      // Verify audit data was added
      const auditData = mockAuditLogger.getAuditEntries();
      expect(auditData).toHaveLength(1);
      expect(auditData[0]).toHaveProperty('operation', 'high_fidelity_data_collection');

      // Step 2: Export training data
      const exportResponse = await request(app)
        .post('/api/export/training-data')
        .send({ format: 'json' })
        .expect(200);

      expect(exportResponse.body).toHaveProperty('success', true);
      expect(exportResponse.body.format).toBe('json');
      expect(exportResponse.headers['x-export-format']).toBe('json');
    });

    it('should handle invalid data submission', async () => {
      const invalidResponse = await request(app)
        .post('/api/sanitize/json')
        .send({}) // Missing content
        .expect(500);

      expect(invalidResponse.body).toHaveProperty('error');
    });

    it('should handle unauthorized export access', async () => {
      // Mock access control to deny
      mockAccessControlEnforcer.enforce.mockReturnValue({ allowed: false, error: 'Access denied' });

      const exportResponse = await request(app)
        .post('/api/export/training-data')
        .send({ format: 'json' })
        .expect(403); // Access denied

      expect(exportResponse.body).toHaveProperty('error', 'Access denied');
    });

    it('should handle invalid export format', async () => {
      const exportResponse = await request(app)
        .post('/api/export/training-data')
        .send({ format: 'invalid' })
        .expect(400);

      expect(exportResponse.body).toHaveProperty('error');
      expect(exportResponse.body.error).toContain('Invalid format');
    });
  });
});
