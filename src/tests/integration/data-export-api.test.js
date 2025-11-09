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
    riskLevel: Joi.string().valid('Low', 'Unknown', 'High').optional(),
    maxRecords: Joi.number().integer().min(1).max(50000).optional(),
  });

  beforeEach(() => {
    // Mock dependencies
    mockAuditLogger = {
      logOperation: (operation, details, context) => Promise.resolve({ id: 'audit-123' }),
      getAuditEntries: (filters) => {
        console.log('Mock getAuditEntries called with filters:', filters);
        const result = [
          {
            operation: 'risk_assessment_context',
            timestamp: '2023-01-01T00:00:00.000Z',
            id: 'record-1',
            details: {
              inputData: { content: 'test content' },
              processingSteps: [],
              decisionOutcome: { riskLevel: 'Low' },
              featureVector: { contentLength: 12 },
              trainingLabels: {},
              metadata: {},
            },
          },
        ];
        console.log('Mock returning:', result);
        return result;
      },
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
            riskLevel: value.riskLevel,
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
          inputData: { content: 'test content' },
          decisionOutcome: { riskLevel: 'Low' },
          featureVector: { contentLength: 12 },
          trainingLabels: {},
          metadata: {},
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
          inputData: { content: 'test content' },
          decisionOutcome: { riskLevel: 'Low' },
          featureVector: { contentLength: 12 },
          trainingLabels: {},
          metadata: {},
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

    it('should filter data by date range', async () => {
      const mockData = [
        {
          operation: 'risk_assessment_context',
          timestamp: '2023-01-01T00:00:00.000Z',
          details: {
            inputData: { content: 'old content' },
            decisionOutcome: { riskLevel: 'Low' },
            featureVector: {},
            trainingLabels: {},
            metadata: {},
          },
        },
        {
          operation: 'risk_assessment_context',
          timestamp: '2023-01-15T00:00:00.000Z',
          details: {
            inputData: { content: 'new content' },
            decisionOutcome: { riskLevel: 'High' },
            featureVector: {},
            trainingLabels: {},
            metadata: {},
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

    it('should filter data by risk level', async () => {
      const mockData = [
        {
          operation: 'risk_assessment_context',
          timestamp: '2023-01-01T00:00:00.000Z',
          details: {
            inputData: { content: 'low risk' },
            decisionOutcome: { riskLevel: 'Low' },
            featureVector: {},
            trainingLabels: {},
            metadata: {},
          },
        },
        {
          operation: 'risk_assessment_context',
          timestamp: '2023-01-02T00:00:00.000Z',
          details: {
            inputData: { content: 'high risk' },
            decisionOutcome: { riskLevel: 'High' },
            featureVector: {},
            trainingLabels: {},
            metadata: {},
          },
        },
      ];

      mockAuditLogger.getAuditEntries.mockReturnValue(mockData);

      const response = await request(app)
        .post('/api/export/training-data')
        .send({
          format: 'json',
          riskLevel: 'High',
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
