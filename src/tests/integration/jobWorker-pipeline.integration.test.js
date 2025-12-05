const rewire = require('rewire');
const sinon = require('sinon');

describe('jobWorker Integration Tests - Reordered Pipeline', () => {
  let jobWorker;

  beforeEach(() => {
    jobWorker = rewire('../../workers/jobWorker');

    // Mock core dependencies for integration testing
    jobWorker.__set__('JobStatus', {
      load: sinon.stub().resolves({
        updateStatus: sinon.stub().resolves(),
        updateProgress: sinon.stub().resolves(),
      }),
    });
    jobWorker.__set__(
      'JobResult',
      sinon.stub().returns({
        save: sinon.stub().resolves(),
      }),
    );
    jobWorker.__set__(
      'ProxySanitizer',
      sinon.stub().returns({
        sanitize: sinon.stub().resolves('sanitized content'),
      }),
    );
  });

  test('should process basic sanitization job with reordered pipeline', async () => {
    const processJob = jobWorker.__get__('processJob');

    const job = {
      id: 'test-basic-123',
      data: 'test content',
      options: {},
    };

    const result = await processJob(job);

    // Verify result structure from reordered pipeline
    expect(result).toBeDefined();
    expect(result.sanitizedContent).toBe('sanitized content');
    expect(result.metadata).toBeDefined();
  });

  test('should verify pipeline ordering - sanitization before AI', async () => {
    // Mock AI transformer to verify it receives sanitized input
    const mockAITransformer = {
      transform: sinon.stub().resolves({ text: 'AI processed content' }),
    };
    jobWorker.__set__('AITextTransformer', sinon.stub().returns(mockAITransformer));

    const processJob = jobWorker.__get__('processJob');

    const job = {
      id: 'test-order-123',
      data: {
        type: 'pdf_processing',
        fileBuffer: Buffer.from('test').toString('base64'),
        fileName: 'test.pdf',
      },
      options: { aiTransformType: 'summary' },
    };

    const result = await processJob(job);

    // Verify AI was called with sanitized content (proving pipeline order)
    expect(mockAITransformer.transform.calledOnce).toBe(true);
    expect(mockAITransformer.transform.firstCall.args[0]).toBe('sanitized content');
    expect(result).toBeDefined();
    expect(result.status).toBe('processed');
  });
});
