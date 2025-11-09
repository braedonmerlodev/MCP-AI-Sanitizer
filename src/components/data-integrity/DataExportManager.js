const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const parquet = require('parquetjs-lite');
const winston = require('winston');

/**
 * DataExportManager handles secure export of AI training data in multiple formats.
 * Supports JSON, CSV, and Parquet formats with access controls and audit logging.
 */
class DataExportManager {
  constructor(options = {}) {
    this.auditLogger = options.auditLogger;
    this.accessControlEnforcer = options.accessControlEnforcer;
    this.exportDir = options.exportDir || path.join(process.cwd(), 'exports');
    this.maxExportSize = options.maxExportSize || 10000; // Max records per export
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [new winston.transports.Console()],
    });

    // Ensure export directory exists
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  /**
   * Exports AI training data in specified format
   * @param {string} format - Export format ('json', 'csv', 'parquet')
   * @param {Object} filters - Data filters (date range, risk levels, etc.)
   * @param {Object} context - Request context for access control
   * @returns {Promise<Object>} - Export result with file path and metadata
   */
  async exportTrainingData(format, filters = {}, context = {}) {
    // Access control check
    const accessResult = this.accessControlEnforcer.enforce(context.req || {}, 'strict');
    if (!accessResult.allowed) {
      throw new Error(`Access denied: ${accessResult.error}`);
    }

    // Audit the export request
    await this.auditLogger.logOperation(
      'data_export_request',
      {
        format,
        filters,
        userId: context.userId || 'system',
        ipAddress: context.ipAddress,
      },
      context,
    );

    // Get training data from audit trail
    const trainingData = this.getTrainingData(filters);

    if (trainingData.length === 0) {
      throw new Error('No training data available for export');
    }

    // Generate export file
    const exportResult = await this.generateExportFile(trainingData, format, context);

    // Audit successful export
    await this.auditLogger.logOperation(
      'data_export_completed',
      {
        format,
        recordCount: trainingData.length,
        filePath: exportResult.filePath,
        fileSize: exportResult.fileSize,
      },
      context,
    );

    return exportResult;
  }

  /**
   * Retrieves training data from audit trail
   * @param {Object} filters - Filter criteria
   * @returns {Array} - Filtered training data records
   */
  getTrainingData(filters = {}) {
    // Get risk assessment context entries
    const auditEntries = this.auditLogger.getAuditEntries({
      operation: 'risk_assessment_context',
      ...filters,
    });

    // Transform to training data format
    const trainingData = auditEntries.map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      inputData: entry.details.inputData,
      processingSteps: entry.details.processingSteps,
      decisionOutcome: entry.details.decisionOutcome,
      featureVector: entry.details.featureVector,
      trainingLabels: entry.details.trainingLabels,
      metadata: entry.details.metadata,
      // Flatten feature vector for CSV/Parquet compatibility
      ...this.flattenFeatureVector(entry.details.featureVector),
    }));

    // Apply additional filters
    let filteredData = trainingData;

    if (filters.startDate) {
      filteredData = filteredData.filter(
        (record) => new Date(record.timestamp) >= new Date(filters.startDate),
      );
    }

    if (filters.endDate) {
      filteredData = filteredData.filter(
        (record) => new Date(record.timestamp) <= new Date(filters.endDate),
      );
    }

    if (filters.riskLevel) {
      filteredData = filteredData.filter(
        (record) => record.decisionOutcome.riskLevel === filters.riskLevel,
      );
    }

    // Limit export size
    if (filteredData.length > this.maxExportSize) {
      filteredData = filteredData.slice(-this.maxExportSize);
    }

    return filteredData;
  }

  /**
   * Flattens feature vector for tabular formats
   * @param {Object} featureVector - Nested feature vector
   * @returns {Object} - Flattened features
   */
  flattenFeatureVector(featureVector) {
    if (!featureVector) return {};

    const flattened = {};

    const flatten = (obj, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}_${key}` : key;

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          flatten(value, newKey);
        } else if (Array.isArray(value)) {
          flattened[`${newKey}_count`] = value.length;
          flattened[`${newKey}_present`] = value.length > 0 ? 1 : 0;
        } else {
          flattened[newKey] = value;
        }
      }
    };

    flatten(featureVector);
    return flattened;
  }

  /**
   * Generates export file in specified format
   * @param {Array} data - Training data to export
   * @param {string} format - Export format
   * @param {Object} context - Request context
   * @returns {Promise<Object>} - Export result
   */
  async generateExportFile(data, format, context) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ai_training_data_${timestamp}.${format}`;
    const filePath = path.join(this.exportDir, filename);

    switch (format.toLowerCase()) {
      case 'json':
        return await this.exportToJson(data, filePath);
      case 'csv':
        return await this.exportToCsv(data, filePath);
      case 'parquet':
        return await this.exportToParquet(data, filePath);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Exports data to JSON format
   * @param {Array} data - Data to export
   * @param {string} filePath - Output file path
   * @returns {Promise<Object>} - Export result
   */
  async exportToJson(data, filePath) {
    const jsonData = {
      exportMetadata: {
        timestamp: new Date().toISOString(),
        recordCount: data.length,
        format: 'json',
        version: '1.0',
      },
      records: data,
    };

    const jsonString = JSON.stringify(jsonData, null, 2);
    fs.writeFileSync(filePath, jsonString);

    return {
      filePath,
      fileSize: jsonString.length,
      recordCount: data.length,
      format: 'json',
    };
  }

  /**
   * Exports data to CSV format
   * @param {Array} data - Data to export
   * @param {string} filePath - Output file path
   * @returns {Promise<Object>} - Export result
   */
  async exportToCsv(data, filePath) {
    if (data.length === 0) {
      throw new Error('No data to export');
    }

    // Get all unique keys from the data
    const allKeys = new Set();
    data.forEach((record) => {
      Object.keys(record).forEach((key) => allKeys.add(key));
    });

    const headers = Array.from(allKeys).map((key) => ({ id: key, title: key }));

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: headers,
    });

    await csvWriter.writeRecords(data);

    const stats = fs.statSync(filePath);

    return {
      filePath,
      fileSize: stats.size,
      recordCount: data.length,
      format: 'csv',
    };
  }

  /**
   * Exports data to Parquet format
   * @param {Array} data - Data to export
   * @param {string} filePath - Output file path
   * @returns {Promise<Object>} - Export result
   */
  async exportToParquet(data, filePath) {
    if (data.length === 0) {
      throw new Error('No data to export');
    }

    // Define Parquet schema based on data structure
    const schema = new parquet.ParquetSchema({
      id: { type: 'UTF8' },
      timestamp: { type: 'UTF8' },
      inputData_content: { type: 'UTF8', optional: true },
      decisionOutcome_riskLevel: { type: 'UTF8', optional: true },
      decisionOutcome_actionsTaken: { type: 'UTF8', optional: true },
      metadata_loggedAt: { type: 'UTF8', optional: true },
      metadata_provenance: { type: 'UTF8', optional: true },
      // Add more fields as needed - this is a simplified schema
      // In production, you'd dynamically generate based on all possible fields
    });

    // Create Parquet writer
    const writer = await parquet.ParquetWriter.openFile(schema, filePath);

    // Transform and write records
    for (const record of data) {
      const parquetRecord = {
        id: record.id,
        timestamp: record.timestamp,
        inputData_content: record.inputData?.content || '',
        decisionOutcome_riskLevel: record.decisionOutcome?.riskLevel || '',
        decisionOutcome_actionsTaken: JSON.stringify(record.decisionOutcome?.actionsTaken || []),
        metadata_loggedAt: record.metadata?.loggedAt || '',
        metadata_provenance: record.metadata?.provenance || '',
        // Add flattened features
        ...Object.fromEntries(
          Object.entries(record)
            .filter(
              ([key]) =>
                ![
                  'id',
                  'timestamp',
                  'inputData',
                  'processingSteps',
                  'decisionOutcome',
                  'featureVector',
                  'trainingLabels',
                  'metadata',
                ].includes(key),
            )
            .map(([key, value]) => [
              key,
              typeof value === 'object' ? JSON.stringify(value) : String(value),
            ]),
        ),
      };

      await writer.appendRow(parquetRecord);
    }

    await writer.close();

    const stats = fs.statSync(filePath);

    return {
      filePath,
      fileSize: stats.size,
      recordCount: data.length,
      format: 'parquet',
    };
  }

  /**
   * Gets export statistics
   * @returns {Object} - Export statistics
   */
  getExportStats() {
    const stats = {
      totalExports: 0,
      formatsUsed: {},
      lastExport: null,
      exportHistory: [],
    };

    // This would be populated from audit logs in a real implementation
    // For now, return basic stats

    return stats;
  }

  /**
   * Cleans up old export files
   * @param {number} maxAgeHours - Maximum age in hours
   */
  cleanupOldExports(maxAgeHours = 24) {
    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
    const now = Date.now();

    try {
      const files = fs.readdirSync(this.exportDir);

      for (const file of files) {
        const filePath = path.join(this.exportDir, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          this.logger.info('Cleaned up old export file', { filePath });
        }
      }
    } catch (error) {
      this.logger.error('Error during export cleanup', { error: error.message });
    }
  }
}

module.exports = DataExportManager;
