const rewire = require('rewire');
const sinon = require('sinon');

describe('jobWorker', () => {
  let jobWorker;
  let mockJobStatus;

  beforeEach(() => {
    jobWorker = rewire('../../workers/jobWorker');

    mockJobStatus = {
      updateStatus: sinon.stub().resolves(),
      updateProgress: sinon.stub().resolves(),
    };

    const mockProxySanitizerInstance = {
      sanitize: sinon.stub().resolves({ sanitizedData: 'sanitized data' }),
    };
    const MockProxySanitizer = sinon.stub().returns(mockProxySanitizerInstance);

    const MockMarkdownConverter = class {
      constructor() {
        this.convert = sinon.stub().returns('markdown text');
      }
    };

    const mockJobStatusModule = {
      load: sinon.stub().resolves(mockJobStatus),
    };

    const mockPdfParse = sinon.stub().resolves({
      text: 'extracted text',
      numpages: 2,
      info: { Title: 'Test PDF', Author: 'Test Author' },
    });

    const mockJobResult = {
      save: sinon.stub().resolves(),
    };

    const MockJobResult = sinon.stub().returns(mockJobResult);

    jobWorker.__set__('ProxySanitizer', MockProxySanitizer);
    jobWorker.__set__('JobStatus', mockJobStatusModule);
    jobWorker.__set__('MarkdownConverter', MockMarkdownConverter);
    jobWorker.__set__('pdfParse', mockPdfParse);
    jobWorker.__set__('JobResult', MockJobResult);
  });

  it('should process job successfully', async () => {
    const processJob = jobWorker.__get__('processJob');

    const job = { id: '123', data: 'test', options: {} };

    const result = await processJob(job);
    expect(result.sanitizedContent).toBe('sanitized data');
    expect(mockJobStatus.updateStatus.calledWith('processing')).toBe(true);
    expect(mockJobStatus.updateStatus.calledWith('completed')).toBe(true);
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
        type: 'upload-pdf',
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
        type: 'upload-pdf',
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
      mockJobStatus.updateProgress.calledWith(55, 'Applying AI structure transformation'),
    ).toBe(true);
  });
});
