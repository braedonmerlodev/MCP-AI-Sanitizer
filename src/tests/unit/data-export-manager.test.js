const DataExportManager = require('../../components/data-integrity/DataExportManager');
const AuditLogger = require('../../components/data-integrity/AuditLogger');
const AccessControlEnforcer = require('../../components/AccessControlEnforcer');

describe('DataExportManager', () => {
  let dataExportManager;
  let mockAuditLogger;
  let mockAccessControlEnforcer;

  beforeEach(() => {
    // Mock audit logger
    mockAuditLogger = {
      logOperation: jest.fn().mockResolvedValue({ id: 'audit-123' }),
      getAuditEntries: jest.fn((filters = {}) => {
        // Simple mock implementation that filters by operation
        const allEntries = [
          {
            operation: 'high_fidelity_data_collection',
            timestamp: '2023-01-01T00:00:00.000Z',
            id: 'record-1',
            details: {
              inputDataHash: 'hash123',
              processingSteps: [],
              decisionOutcome: { decision: 'sanitized', reasoning: 'test', riskScore: 0.1 },
              featureVector: {},
              contextMetadata: { inputLength: 4, outputLength: 4, processingTime: 1 },
            },
          },
          {
            operation: 'other_operation',
            timestamp: '2023-01-01T00:00:00.000Z',
            id: 'record-2',
            details: {},
          },
        ];

        let filtered = allEntries;
        if (filters.operation) {
          filtered = filtered.filter((entry) => entry.operation === filters.operation);
        }
        if (filters.startDate) {
          filtered = filtered.filter(
            (entry) => new Date(entry.timestamp) >= new Date(filters.startDate),
          );
        }
        return filtered;
      }),
    };

    // Mock access control enforcer
    mockAccessControlEnforcer = {
      enforce: jest.fn().mockReturnValue({ allowed: true }),
    };

    dataExportManager = new DataExportManager({
      auditLogger: mockAuditLogger,
      accessControlEnforcer: mockAccessControlEnforcer,
      exportDir: './test-exports',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('exportTrainingData', () => {
    it('should export data successfully with valid access', async () => {
      const mockData = [
        {
          id: 'record-1',
          timestamp: '2023-01-01T00:00:00.000Z',
          operation: 'high_fidelity_data_collection',
          details: {
            inputDataHash: 'abc123',
            processingSteps: [],
            decisionOutcome: { decision: 'sanitized', reasoning: 'test', riskScore: 0.1 },
            featureVector: { contentLength: 12 },
            contextMetadata: { inputLength: 10, outputLength: 10, processingTime: 5 },
          },
        },
      ];

      mockAuditLogger.getAuditEntries.mockReturnValue(mockData);

      const result = await dataExportManager.exportTrainingData(
        'json',
        {},
        {
          userId: 'test-user',
          req: {},
        },
      );

      expect(result).toHaveProperty('filePath');
      expect(result.format).toBe('json');
      expect(result.recordCount).toBe(1);
      expect(mockAuditLogger.logOperation).toHaveBeenCalledWith(
        'data_export_request',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should deny access when access control fails', async () => {
      mockAccessControlEnforcer.enforce.mockReturnValue({
        allowed: false,
        error: 'Access denied',
      });

      await expect(dataExportManager.exportTrainingData('json', {}, { req: {} })).rejects.toThrow(
        'Access denied',
      );
    });

    it('should throw error when no data available', async () => {
      mockAuditLogger.getAuditEntries.mockReturnValue([]);

      await expect(dataExportManager.exportTrainingData('json', {}, { req: {} })).rejects.toThrow(
        'No training data available for export',
      );
    });
  });

  describe('getTrainingData', () => {
    it('should filter data by operation type', () => {
      const result = dataExportManager.getTrainingData();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('inputDataHash');
    });

    it('should apply date filters', () => {
      const mockEntries = [
        {
          operation: 'risk_assessment_context',
          timestamp: '2023-01-01T00:00:00.000Z',
          details: {
            inputData: {},
            decisionOutcome: {},
            featureVector: {},
            trainingLabels: {},
            metadata: {},
          },
        },
        {
          operation: 'risk_assessment_context',
          timestamp: '2023-01-03T00:00:00.000Z',
          details: {
            inputData: {},
            decisionOutcome: {},
            featureVector: {},
            trainingLabels: {},
            metadata: {},
          },
        },
      ];

      mockAuditLogger.getAuditEntries.mockReturnValue(mockEntries);

      const result = dataExportManager.getTrainingData({
        startDate: '2023-01-02T00:00:00.000Z',
      });

      expect(result).toHaveLength(1);
      expect(result[0].timestamp).toBe('2023-01-03T00:00:00.000Z');
    });

    it('should limit export size', () => {
      const mockEntries = Array.from({ length: 15000 }, (_, i) => ({
        operation: 'risk_assessment_context',
        timestamp: `2023-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
        details: {
          inputData: {},
          decisionOutcome: {},
          featureVector: {},
          trainingLabels: {},
          metadata: {},
        },
      }));

      mockAuditLogger.getAuditEntries.mockReturnValue(mockEntries);

      const result = dataExportManager.getTrainingData();

      expect(result).toHaveLength(10000); // maxExportSize
    });
  });

  describe('flattenFeatureVector', () => {
    it('should flatten nested objects', () => {
      const featureVector = {
        contentLength: 100,
        languageFeatures: {
          wordCount: 20,
          uppercaseRatio: 0.1,
        },
        structuralFeatures: {
          hasHtml: true,
          tagCount: 5,
        },
      };

      const result = dataExportManager.flattenFeatureVector(featureVector);

      expect(result).toEqual({
        contentLength: 100,
        languageFeatures_wordCount: 20,
        languageFeatures_uppercaseRatio: 0.1,
        structuralFeatures_hasHtml: true,
        structuralFeatures_tagCount: 5,
      });
    });

    it('should handle arrays', () => {
      const featureVector = {
        anomalyIndicators: ['script_injection', 'xss_attempt'],
        complianceFlags: [],
      };

      const result = dataExportManager.flattenFeatureVector(featureVector);

      expect(result).toEqual({
        anomalyIndicators_count: 2,
        anomalyIndicators_present: 1,
        complianceFlags_count: 0,
        complianceFlags_present: 0,
      });
    });
  });
});
