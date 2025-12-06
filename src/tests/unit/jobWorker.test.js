// Mock external dependencies
jest.mock('../../models/JobStatus');
jest.mock('../../models/JobResult');
jest.mock('../../components/proxy-sanitizer');
jest.mock('../../components/MarkdownConverter');
jest.mock('pdf-parse');

const JobStatus = require('../../models/JobStatus');
const JobResult = require('../../models/JobResult');
const ProxySanitizer = require('../../components/proxy-sanitizer');
const MarkdownConverter = require('../../components/MarkdownConverter');
const pdfParse = require('pdf-parse');

describe('jobWorker', () => {
  let mockJobStatus;
  let mockJobResult;
  let mockSanitizer;
  let mockMarkdownConverter;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock instances
    mockJobStatus = {
      updateStatus: jest.fn().mockResolvedValue(),
      updateProgress: jest.fn().mockResolvedValue(),
    };

    mockJobResult = {
      save: jest.fn().mockResolvedValue(),
    };

    mockSanitizer = {
      sanitize: jest.fn().mockResolvedValue('sanitized data'),
    };

    mockMarkdownConverter = {
      convert: jest.fn().mockReturnValue('markdown text'),
    };

    // Setup module mocks
    JobStatus.load = jest.fn().mockResolvedValue(mockJobStatus);
    JobResult.mockImplementation(() => mockJobResult);
    ProxySanitizer.mockImplementation(() => mockSanitizer);
    MarkdownConverter.mockImplementation(() => mockMarkdownConverter);

    pdfParse.mockResolvedValue({
      text: 'extracted text',
      numpages: 2,
      info: { Title: 'Test PDF', Author: 'Test Author' },
    });
  });

  afterEach(() => {
    // Clean up mocks to prevent async operation leaks
    jest.clearAllMocks();
    sinon.restore();
  });

  it('should process job successfully', async () => {
    // Import the function directly since we're using Jest mocks
    const { processJob } = require('../../workers/jobWorker');

    const job = { id: '123', data: 'test', options: {} };

    const result = await processJob(job);

    expect(result).toBeDefined();
    expect(result.sanitizedContent).toBe('sanitized data');
    expect(mockJobStatus.updateStatus).toHaveBeenCalledWith('processing');
    expect(mockJobStatus.updateStatus).toHaveBeenCalledWith('completed');
  });

  it('should handle job processing error', async () => {
    const MockProxySanitizer = class {
      constructor() {
        this.sanitize = sinon.stub().rejects(new Error('processing error'));
      }
    };
    jobWorker.__set__('ProxySanitizer', MockProxySanitizer);

    const processJob = jobWorker.__get__('processJob');

    const job = { id: '123', data: 'test', options: {} };

    await expect(processJob(job)).rejects.toThrow('processing error');
    expect(mockJobStatus.updateStatus.calledWith('processing')).toBe(true);
    expect(mockJobStatus.updateStatus.calledWith('failed', 'processing error')).toBe(true);
  });

  it('should process PDF upload job', async () => {
    const MockProxySanitizer = class {
      constructor() {
        this.sanitize = sinon.stub().resolves({ sanitizedData: 'sanitized markdown' });
      }
    };
    jobWorker.__set__('ProxySanitizer', MockProxySanitizer);

    const processJob = jobWorker.__get__('processJob');

    const job = {
      id: '123',
      data: {
        type: 'pdf_processing',
        fileBuffer: Buffer.from('pdf data').toString('base64'),
        fileName: 'test.pdf',
      },
      options: {},
    };

    const result = await processJob(job);
    expect(result.status).toBe('processed');
    expect(result.fileName).toBe('test.pdf');
    expect(result.metadata.pages).toBe(2);
  });

  it('should process PDF upload job with AI transformation', async () => {
    const MockProxySanitizer = class {
      constructor() {
        this.sanitize = sinon.stub().resolves({ sanitizedData: 'sanitized ai transformed text' });
      }
    };

    const MockAITextTransformer = class {
      constructor() {
        this.transform = sinon.stub().resolves('ai transformed text');
      }
    };

    jobWorker.__set__('ProxySanitizer', MockProxySanitizer);
    jobWorker.__set__('AITextTransformer', MockAITextTransformer);

    const processJob = jobWorker.__get__('processJob');

    const job = {
      id: '123',
      data: {
        type: 'pdf_processing',
        fileBuffer: Buffer.from('pdf data').toString('base64'),
        fileName: 'test.pdf',
      },
      options: { aiTransformType: 'structure' },
    };

    const result = await processJob(job);
    expect(result.status).toBe('processed');
    expect(result.fileName).toBe('test.pdf');
    expect(result.metadata.pages).toBe(2);
    expect(
      mockJobStatus.updateProgress.calledWith(70, 'Applying AI structure transformation'),
    ).toBe(true);
  });

  it('should process default sanitization path with structured response', async () => {
    const MockProxySanitizer = class {
      constructor() {
        this.sanitize = sinon.stub().resolves({
          content: 'safe content',
          sanitizationTests: { patterns: ['<script>alert(1)</script>'] },
        });
      }
    };

    jobWorker.__set__('ProxySanitizer', MockProxySanitizer);

    const processJob = jobWorker.__get__('processJob');

    const job = {
      id: '123',
      data: {
        type: 'default',
        content: 'test content with threats',
      },
      options: {},
    };

    const result = await processJob(job);
    expect(result.sanitizedContent).toBeDefined();
    expect(result.metadata).toBeDefined();
    expect(result.metadata.originalLength).toBeDefined();
    expect(result.metadata.sanitizedLength).toBeDefined();
  });

  it('should handle PDF parsing errors', async () => {
    const mockPdfParseError = sinon.stub().rejects(new Error('Invalid PDF format'));
    jobWorker.__set__('pdfParse', mockPdfParseError);

    const processJob = jobWorker.__get__('processJob');

    const job = {
      id: '123',
      data: {
        type: 'pdf_processing',
        fileBuffer: Buffer.from('invalid pdf').toString('base64'),
        fileName: 'invalid.pdf',
      },
      options: {},
    };

    await expect(processJob(job)).rejects.toThrow('Failed to extract text from PDF');
    expect(
      mockJobStatus.updateStatus.calledWith(
        'failed',
        'Failed to extract text from PDF: Invalid PDF format',
      ),
    ).toBe(true);
  });

  it('should handle AI transformation failures gracefully', async () => {
    const MockProxySanitizer = class {
      constructor() {
        this.sanitize = sinon.stub().resolves({ sanitizedData: 'sanitized text' });
      }
    };

    const MockAITextTransformer = class {
      constructor() {
        this.transform = sinon.stub().rejects(new Error('AI service unavailable'));
      }
    };

    jobWorker.__set__('ProxySanitizer', MockProxySanitizer);
    jobWorker.__set__('AITextTransformer', MockAITextTransformer);

    const processJob = jobWorker.__get__('processJob');

    const job = {
      id: '123',
      data: {
        type: 'pdf_processing',
        fileBuffer: Buffer.from('pdf data').toString('base64'),
        fileName: 'test.pdf',
      },
      options: { aiTransformType: 'summary' },
    };

    const result = await processJob(job);
    expect(result.status).toBe('processed');
    expect(result.fileName).toBe('test.pdf');
    // Should continue with markdown text despite AI failure
  });

  it('should process PDF with AI structure transformation and threat extraction', async () => {
    const MockProxySanitizer = class {
      constructor() {
        this.sanitize = sinon.stub().resolves({
          sanitizedData: '{"content": "safe", "sanitizationTests": {"patterns": ["<script>"]}}',
        });
      }
    };

    const MockAITextTransformer = class {
      constructor() {
        this.transform = sinon.stub().resolves({
          text: '{"content": "transformed", "sanitizationTests": {"patterns": ["malicious"]}}',
        });
      }
    };

    const MockJSONRepair = class {
      constructor() {
        this.repair = sinon.stub().returns({
          success: true,
          data: { content: 'transformed', sanitizationTests: { patterns: ['malicious'] } },
        });
      }
    };

    jobWorker.__set__('ProxySanitizer', MockProxySanitizer);
    jobWorker.__set__('AITextTransformer', MockAITextTransformer);
    jobWorker.__set__('JSONRepair', MockJSONRepair);

    const processJob = jobWorker.__get__('processJob');

    const job = {
      id: '123',
      data: {
        type: 'pdf_processing',
        fileBuffer: Buffer.from('pdf data').toString('base64'),
        fileName: 'test.pdf',
      },
      options: { aiTransformType: 'structure' },
    };

    const result = await processJob(job);
    expect(result.status).toBe('processed');
    expect(result.securityReport).toBeDefined();
    expect(result.sanitizedData).toBeDefined();
    // Threats should be extracted and not in sanitizedData
    expect(result.sanitizedData.sanitizationTests).toBeUndefined();
  });

  it('should handle empty PDF gracefully', async () => {
    const mockPdfParseEmpty = sinon.stub().resolves({
      text: '',
      numpages: 0,
      info: {},
    });

    jobWorker.__set__('pdfParse', mockPdfParseEmpty);

    const processJob = jobWorker.__get__('processJob');

    const job = {
      id: '123',
      data: {
        type: 'pdf_processing',
        fileBuffer: Buffer.from('empty pdf').toString('base64'),
        fileName: 'empty.pdf',
      },
      options: {},
    };

    const result = await processJob(job);
    expect(result.status).toBe('processed');
    expect(result.fileName).toBe('empty.pdf');
    expect(result.metadata.pages).toBe(0);
  });
});
