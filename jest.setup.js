// Jest setup file to provide browser APIs needed by pdf-parse

// Set up environment variables for tests
process.env.TRUST_TOKEN_SECRET = 'test-secret-key-for-jest-tests';

// Mock langchain modules globally to avoid ES module issues
jest.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({
      content: 'Mocked AI response for testing',
    }),
  })),
}));

jest.mock('@langchain/core/prompts', () => ({
  PromptTemplate: {
    fromTemplate: jest.fn().mockReturnValue({
      format: jest.fn().mockReturnValue('Mocked prompt'),
    }),
  },
}));

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({
      content: 'Mocked OpenAI response for testing',
    }),
  })),
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => 'Mocked Gemini response',
        },
      }),
    }),
  })),
}));

// Provide DOMMatrix polyfill if not available
if (typeof global.DOMMatrix === 'undefined') {
  // Simple DOMMatrix polyfill for pdf-parse
  global.DOMMatrix = class DOMMatrix {
    constructor(init) {
      this.m11 = 1;
      this.m12 = 0;
      this.m13 = 0;
      this.m14 = 0;
      this.m21 = 0;
      this.m22 = 1;
      this.m23 = 0;
      this.m24 = 0;
      this.m31 = 0;
      this.m32 = 0;
      this.m33 = 1;
      this.m34 = 0;
      this.m41 = 0;
      this.m42 = 0;
      this.m43 = 0;
      this.m44 = 1;

      if (init) {
        if (Array.isArray(init)) {
          [
            this.m11,
            this.m12,
            this.m13,
            this.m14,
            this.m21,
            this.m22,
            this.m23,
            this.m24,
            this.m31,
            this.m32,
            this.m33,
            this.m34,
            this.m41,
            this.m42,
            this.m43,
            this.m44,
          ] = init;
        } else if (typeof init === 'string') {
          // Parse transform string (simplified)
          const values = init
            .split(/[(),\s]+/)
            .filter((v) => v && !isNaN(v))
            .map(Number);
          if (values.length >= 6) {
            this.m11 = values[0];
            this.m12 = values[1];
            this.m41 = values[4];
            this.m21 = values[2];
            this.m22 = values[3];
            this.m42 = values[5];
          }
        }
      }
    }

    multiply(other) {
      const result = new DOMMatrix();
      // Simplified matrix multiplication for basic transforms
      result.m11 = this.m11 * other.m11 + this.m12 * other.m21;
      result.m12 = this.m11 * other.m12 + this.m12 * other.m22;
      result.m21 = this.m21 * other.m11 + this.m22 * other.m21;
      result.m22 = this.m21 * other.m12 + this.m22 * other.m22;
      result.m41 = this.m41 * other.m11 + this.m42 * other.m21 + other.m41;
      result.m42 = this.m41 * other.m12 + this.m42 * other.m22 + other.m42;
      return result;
    }

    translate(x, y) {
      const result = new DOMMatrix();
      Object.assign(result, this);
      result.m41 += x;
      result.m42 += y;
      return result;
    }

    scale(x, y = x) {
      const result = new DOMMatrix();
      Object.assign(result, this);
      result.m11 *= x;
      result.m22 *= y;
      return result;
    }

    toString() {
      return `matrix(${this.m11}, ${this.m12}, ${this.m21}, ${this.m22}, ${this.m41}, ${this.m42})`;
    }
  };
}

// Provide other browser APIs that might be needed
global.HTMLCanvasElement = class HTMLCanvasElement {
  getContext() {
    return {
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      transform: () => {},
      setTransform: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      clearRect: () => {},
      fillText: () => {},
      strokeText: () => {},
      measureText: () => ({ width: 0 }),
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      bezierCurveTo: () => {},
      arc: () => {},
      rect: () => {},
      fill: () => {},
      stroke: () => {},
      clip: () => {},
    };
  }
};

global.ImageData = class ImageData {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
};

// Mock window and document for basic compatibility
global.window = global.window || {};
global.document = global.document || {
  createElement: () => ({}),
};
global.navigator = global.navigator || { userAgent: 'Jest' };

// Provide other browser APIs that might be needed
global.HTMLCanvasElement = class HTMLCanvasElement {
  getContext() {
    return {
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      transform: () => {},
      setTransform: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      clearRect: () => {},
      fillText: () => {},
      strokeText: () => {},
      measureText: () => ({ width: 0 }),
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      bezierCurveTo: () => {},
      arc: () => {},
      rect: () => {},
      fill: () => {},
      stroke: () => {},
      clip: () => {},
    };
  }
};

global.ImageData = class ImageData {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
};

// Defensive PDFJS / pdf-parse test shims to avoid worker errors in Node test env
global.PDFJS = global.PDFJS || { workerSrc: '' };
global.pdfjsLib = global.pdfjsLib || { GlobalWorkerOptions: { workerSrc: '' } };

// Provide a simple global mock for `pdf-parse` so integration tests are deterministic.
// Jest's setup file runs before tests, so calling jest.mock here ensures modules that
// require `pdf-parse` get our controlled implementation.
try {
  // jest may not be defined if this file is executed outside jest; guard it
  if (typeof jest !== 'undefined' && typeof jest.mock === 'function') {
    jest.mock('pdf-parse', () => {
      return async function mockPdfParse(buffer) {
        // Return a stable, small text payload suitable for both AI and non-AI flows
        return { text: 'mocked pdf text', numpages: 1, info: {} };
      };
    });
  }
} catch (err) {
  // ignore if mocking is not available in this environment
}
