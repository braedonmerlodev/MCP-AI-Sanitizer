const request = require('supertest');
const express = require('express');
const Joi = require('joi');
const DataExportManager = require('../../components/data-integrity/DataExportManager');
const AuditLogger = require('../../components/data-integrity/AuditLogger');
const AccessControlEnforcer = require('../../components/AccessControlEnforcer');

describe('Data Export API Integration', () => {
  let app;
  let mockAuditLogger;
  let mockAccessControlEnforcer;
  let dataExportManager;

  const dataExportSchema = Joi.object({
    format: Joi.string().valid('json', 'csv', 'parquet').required(),
    startDate: Joi.string().isoDate().optional(),
    endDate: Joi.string().isoDate().optional(),
    riskScore: Joi.number().min(0).max(1).optional(),
    maxRecords: Joi.number().integer().min(1).max(50000).optional(),
  });

  beforeEach(() => {
    // Mock dependencies
    mockAuditLogger = {
      logOperation: jest.fn().mockResolvedValue({ id: 'audit-123' }),
      getAuditEntries: jest.fn((filters = {}) => {
        // Mock implementation that returns test data
        const result = [
          {
            id: 'record-1',
            timestamp: '2023-01-01T00:00:00.000Z',
            operation: 'high_fidelity_data_collection',
            details: {
              inputDataHash: 'hash123',
              processingSteps: [],
              decisionOutcome: { decision: 'sanitized', reasoning: 'test', riskScore: 0.1 },
              featureVector: {},
              contextMetadata: { inputLength: 4, outputLength: 4, processingTime: 1 },
            },
          },
        ];
        console.log('Mock returning:', result);
        return result;
      }),
    };

    mockAccessControlEnforcer = {
      enforce: jest.fn().mockReturnValue({ allowed: true }),
    };

    dataExportManager = new DataExportManager({
      auditLogger: mockAuditLogger,
      accessControlEnforcer: mockAccessControlEnforcer,
      exportDir: './test-exports',
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
    const mockAccessValidation = (req, res, next) => next();
    app.use('/api/export/training-data', mockAccessValidation);

    // Export endpoint
    app.post('/api/export/training-data', mockAccessValidation, async (req, res) => {
      const { error, value } = dataExportSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      try {
        const exportContext = {
          userId: req.user?.id || 'anonymous',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          sessionId: req.session?.id,
          req,
        };

        const exportResult = await dataExportManager.exportTrainingData(
          value.format,
          {
            startDate: value.startDate,
            endDate: value.endDate,
            riskScore: value.riskScore,
          },
          exportContext,
        );

        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${require('path').basename(exportResult.filePath)}"`,
        );
        res.setHeader('X-Export-Record-Count', exportResult.recordCount);
        res.setHeader('X-Export-Format', value.format);

        // For testing, return metadata instead of streaming file
        res.json({
          success: true,
          filePath: exportResult.filePath,
          recordCount: exportResult.recordCount,
          format: exportResult.format,
          fileSize: exportResult.fileSize,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/export/training-data', () => {
    it('should export JSON data successfully', async () => {
      const mockData = [
        {
          id: 'record-1',
          timestamp: '2023-01-01T00:00:00.000Z',
          operation: 'high_fidelity_data_collection',
          details: {
            inputDataHash: 'hash123',
            processingSteps: [],
            decisionOutcome: { decision: 'sanitized', reasoning: 'test', riskScore: 0.1 },
            featureVector: { contentLength: 12 },
            contextMetadata: {},
          },
        },
      ];

      mockAuditLogger.getAuditEntries.mockReturnValue(mockData);

      const response = await request(app)
        .post('/api/export/training-data')
        .send({ format: 'json' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.format).toBe('json');
      expect(response.body.recordCount).toBe(1);
      expect(response.headers['x-export-format']).toBe('json');
      expect(response.headers['x-export-record-count']).toBe('1');
    });

    it('should export CSV data successfully', async () => {
      const mockData = [
        {
          id: 'record-1',
          timestamp: '2023-01-01T00:00:00.000Z',
          operation: 'high_fidelity_data_collection',
          details: {
            inputDataHash: 'hash123',
            processingSteps: [],
            decisionOutcome: { decision: 'sanitized', reasoning: 'test', riskScore: 0.1 },
            featureVector: { contentLength: 12 },
            contextMetadata: {},
          },
        },
      ];

      mockAuditLogger.getAuditEntries.mockReturnValue(mockData);

      const response = await request(app)
        .post('/api/export/training-data')
        .send({ format: 'csv' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.format).toBe('csv');
      expect(response.body.recordCount).toBe(1);
    });

    it('should export Parquet data successfully', async () => {
      const mockData = [
        {
          id: 'record-1',
          timestamp: '2023-01-01T00:00:00.000Z',
          operation: 'high_fidelity_data_collection',
          details: {
            inputDataHash: 'hash123',
            processingSteps: [],
            decisionOutcome: { decision: 'sanitized', reasoning: 'test', riskScore: 0.1 },
            featureVector: { contentLength: 12 },
            contextMetadata: {},
          },
        },
      ];

      mockAuditLogger.getAuditEntries.mockReturnValue(mockData);

      const response = await request(app)
        .post('/api/export/training-data')
        .send({ format: 'parquet' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.format).toBe('parquet');
      expect(response.body.recordCount).toBe(1);
    });

    it('should filter data by date range', async () => {
      const mockData = [
        {
          operation: 'high_fidelity_data_collection',
          timestamp: '2023-01-01T00:00:00.000Z',
          details: {
            inputDataHash: 'hash1',
            processingSteps: [],
            decisionOutcome: { decision: 'sanitized', reasoning: 'test', riskScore: 0.1 },
            featureVector: {},
            contextMetadata: {},
          },
        },
        {
          operation: 'high_fidelity_data_collection',
          timestamp: '2023-01-15T00:00:00.000Z',
          details: {
            inputDataHash: 'hash2',
            processingSteps: [],
            decisionOutcome: { decision: 'sanitized', reasoning: 'test', riskScore: 0.8 },
            featureVector: {},
            contextMetadata: {},
          },
        },
      ];

      mockAuditLogger.getAuditEntries.mockReturnValue(mockData);

      const response = await request(app)
        .post('/api/export/training-data')
        .send({
          format: 'json',
          startDate: '2023-01-10T00:00:00.000Z',
        })
        .expect(200);

      expect(response.body.recordCount).toBe(1);
    });

    it('should filter data by risk score', async () => {
      const mockData = [
        {
          id: 'record-1',
          operation: 'high_fidelity_data_collection',
          timestamp: '2023-01-01T00:00:00.000Z',
          details: {
            inputDataHash: 'hash1',
            processingSteps: [],
            decisionOutcome: { decision: 'sanitized', reasoning: 'test', riskScore: 0.1 },
            featureVector: {},
            contextMetadata: {},
          },
        },
        {
          id: 'record-2',
          operation: 'high_fidelity_data_collection',
          timestamp: '2023-01-02T00:00:00.000Z',
          details: {
            inputDataHash: 'hash2',
            processingSteps: [],
            decisionOutcome: { decision: 'sanitized', reasoning: 'test', riskScore: 0.8 },
            featureVector: {},
            contextMetadata: {},
          },
        },
      ];

      mockAuditLogger.getAuditEntries.mockReturnValue(mockData);

      const response = await request(app)
        .post('/api/export/training-data')
        .send({
          format: 'json',
          riskScore: 0.8,
        })
        .expect(200);

      expect(response.body.recordCount).toBe(1);
    });

    it('should return 400 for invalid format', async () => {
      const response = await request(app)
        .post('/api/export/training-data')
        .send({ format: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 500 when no data available', async () => {
      mockAuditLogger.getAuditEntries.mockReturnValue([]);

      const response = await request(app)
        .post('/api/export/training-data')
        .send({ format: 'json' })
        .expect(500);

      expect(response.body.error).toBe('No training data available for export');
    });
  });
});
