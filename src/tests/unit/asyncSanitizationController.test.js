const sinon = require('sinon');
const AsyncSanitizationController = require('../../controllers/AsyncSanitizationController');

describe('AsyncSanitizationController', () => {
  let controller;
  let mockQueueManager;

  beforeEach(() => {
    // Mock queueManager
    mockQueueManager = {
      addJob: sinon.stub(),
    };

    // Create controller with mocked queueManager
    controller = new AsyncSanitizationController(mockQueueManager);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('submitSanitizationJob', () => {
    it('should submit sanitization job successfully', async () => {
      const content = 'test content';
      const options = { classification: 'test' };
      const expectedTaskId = 'task123';

      mockQueueManager.addJob.resolves(expectedTaskId);

      const result = await controller.submitSanitizationJob(content, options);

      expect(result).toBe(expectedTaskId);
      expect(mockQueueManager.addJob.calledOnce).toBe(true);
      expect(
        mockQueueManager.addJob.calledWith(content, {
          classification: 'test',
          generateTrustToken: true,
        }),
      ).toBe(true);
    });

    it('should handle job submission errors', async () => {
      const content = 'test content';
      const error = new Error('Queue error');

      mockQueueManager.addJob.rejects(error);

      await expect(controller.submitSanitizationJob(content)).rejects.toThrow('Queue error');
    });

    it('should use default options when none provided', async () => {
      const content = 'test content';
      const expectedTaskId = 'task123';

      mockQueueManager.addJob.resolves(expectedTaskId);

      await controller.submitSanitizationJob(content);

      expect(
        mockQueueManager.addJob.calledWith(content, {
          classification: 'llm',
          generateTrustToken: true,
        }),
      ).toBe(true);
    });
  });

  describe('submitPDFUploadJob', () => {
    it('should submit PDF upload job successfully', async () => {
      const fileBuffer = Buffer.from('pdf content');
      const fileName = 'test.pdf';
      const options = { classification: 'test' };
      const expectedTaskId = 'task456';

      mockQueueManager.addJob.resolves(expectedTaskId);

      const result = await controller.submitPDFUploadJob(fileBuffer, fileName, options);

      expect(result).toBe(expectedTaskId);
      expect(mockQueueManager.addJob.calledOnce).toBe(true);
      const [jobData, jobOptions] = mockQueueManager.addJob.firstCall.args;
      expect(jobData.type).toBe('upload-pdf');
      expect(jobData.fileBuffer).toBe(fileBuffer.toString('base64'));
      expect(jobData.fileName).toBe(fileName);
      expect(jobOptions.classification).toBe('test');
      expect(jobOptions.generateTrustToken).toBe(true);
    });

    it('should handle PDF upload job submission errors', async () => {
      const fileBuffer = Buffer.from('pdf content');
      const fileName = 'test.pdf';
      const error = new Error('Upload error');

      mockQueueManager.addJob.rejects(error);

      await expect(controller.submitPDFUploadJob(fileBuffer, fileName)).rejects.toThrow(
        'Upload error',
      );
    });
  });

  describe('shouldProcessAsync', () => {
    it('should return true when forceAsync is true', () => {
      const criteria = { forceAsync: true };
      expect(controller.shouldProcessAsync(criteria)).toBe(true);
    });

    it('should return true when fileSize exceeds 10MB', () => {
      const criteria = { fileSize: 10_485_761 }; // 10MB + 1
      expect(controller.shouldProcessAsync(criteria)).toBe(true);
    });

    it('should return true when processingTime exceeds 5 seconds', () => {
      const criteria = { processingTime: 5001 };
      expect(controller.shouldProcessAsync(criteria)).toBe(true);
    });

    it('should return false for small files and short processing time', () => {
      const criteria = { fileSize: 1_000_000, processingTime: 1000 };
      expect(controller.shouldProcessAsync(criteria)).toBe(false);
    });

    it('should return false when no criteria met', () => {
      const criteria = {};
      expect(controller.shouldProcessAsync(criteria)).toBe(false);
    });

    it('should return false when fileSize is exactly 10MB', () => {
      const criteria = { fileSize: 10_485_760 }; // Exactly 10MB
      expect(controller.shouldProcessAsync(criteria)).toBe(false);
    });

    it('should return false when processingTime is exactly 5 seconds', () => {
      const criteria = { processingTime: 5000 }; // Exactly 5 seconds
      expect(controller.shouldProcessAsync(criteria)).toBe(false);
    });

    it('should handle undefined criteria gracefully', () => {
      expect(controller.shouldProcessAsync()).toBe(false);
    });

    it('should handle null criteria gracefully', () => {
      expect(controller.shouldProcessAsync(null)).toBe(false);
    });
  });

  describe('constructor', () => {
    it('should use provided queueManager instance', () => {
      const mockQueueManager = { addJob: sinon.stub() };
      const controller = new AsyncSanitizationController(mockQueueManager);
      expect(controller.queueManager).toBe(mockQueueManager);
    });

    it('should use default queueManager when none provided', () => {
      const controller = new AsyncSanitizationController();
      expect(controller.queueManager).toBeDefined();
      // Should have loaded the actual queueManager module
      expect(typeof controller.queueManager.addJob).toBe('function');
    });
  });
});
