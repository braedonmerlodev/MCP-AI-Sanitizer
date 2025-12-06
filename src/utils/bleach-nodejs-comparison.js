// Bleach-Node.js Sanitization Library Comparison Utility
const DOMPurify = require('dompurify');
const sanitizeHtml = require('sanitize-html');
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * BleachNodeComparison provides comprehensive comparison between
 * Python bleach and Node.js sanitization libraries (DOMPurify, sanitize-html)
 */
class BleachNodeComparison {
  constructor() {
    // Initialize DOMPurify (server-side)
    const { JSDOM } = require('jsdom');
    const window = new JSDOM('').window;
    this.DOMPurify = DOMPurify(window);

    // Test data sets for comparison
    this.testCases = this.generateTestCases();

    // Bleach feature mapping (based on Python bleach documentation)
    this.bleachFeatures = {
      tags: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'ol', 'ul', 'li', 'a'],
      attributes: {
        a: ['href', 'title'],
        img: ['src', 'alt', 'title'],
      },
      protocols: ['http', 'https', 'mailto'],
      strip: false,
      clean: true,
    };
  }

  /**
   * Generates comprehensive test cases for sanitization comparison
   */
  generateTestCases() {
    return {
      basicHtml: {
        input: '<p>Hello <strong>world</strong>!</p>',
        expected: '<p>Hello <strong>world</strong>!</p>',
        description: 'Basic HTML with allowed tags',
      },
      scriptInjection: {
        input: '<p>Hello <script>alert("xss")</script> world!</p>',
        expected: '<p>Hello  world!</p>',
        description: 'Script tag removal',
      },
      eventHandlers: {
        input: '<a href="#" onclick="alert(\'xss\')">Click me</a>',
        expected: '<a href="#">Click me</a>',
        description: 'Event handler removal',
      },
      maliciousAttributes: {
        input: '<img src="x" onerror="alert(\'xss\')" onload="evil()" />',
        expected: '<img src="x" />',
        description: 'Malicious attribute removal',
      },
      nestedTags: {
        input: '<div><script><iframe src="evil.com"></iframe></script></div>',
        expected: '<div></div>',
        description: 'Nested malicious content removal',
      },
      allowedAttributes: {
        input: '<a href="https://example.com" title="Safe link">Link</a>',
        expected: '<a href="https://example.com" title="Safe link">Link</a>',
        description: 'Allowed attributes preservation',
      },
      disallowedProtocols: {
        input: '<a href="javascript:alert(\'xss\')">Bad link</a>',
        expected: '<a>Bad link</a>',
        description: 'Disallowed protocol removal',
      },
      complexHtml: {
        input: `
          <div class="content">
            <h1>Title</h1>
            <p>Paragraph with <em>emphasis</em> and <strong>bold</strong> text.</p>
            <ul>
              <li>Item 1</li>
              <li>Item 2 <script>evil()</script></li>
            </ul>
            <a href="https://safe.com" onclick="bad()">Safe Link</a>
            <img src="image.jpg" alt="Image" onerror="hack()" />
          </div>
        `,
        expected: `
          <div class="content">
            <h1>Title</h1>
            <p>Paragraph with <em>emphasis</em> and <strong>bold</strong> text.</p>
            <ul>
              <li>Item 1</li>
              <li>Item 2 </li>
            </ul>
            <a href="https://safe.com">Safe Link</a>
            <img src="image.jpg" alt="Image" />
          </div>
        `,
        description: 'Complex HTML with mixed safe and malicious content',
      },
      unicodeAttacks: {
        input: '<p>Hello\u200E<script>alert(1)</script>\u200Eworld</p>',
        expected: '<p>Hello\u200Eworld</p>',
        description: 'Unicode directionality attacks',
      },
      cssInjection: {
        input: '<p style="background-image: url(javascript:alert(1))">Styled text</p>',
        expected: '<p>Styled text</p>',
        description: 'CSS injection attacks',
      },
    };
  }

  /**
   * Tests DOMPurify sanitization
   */
  testDOMPurify(input, options = {}) {
    try {
      const config = {
        ALLOWED_TAGS: this.bleachFeatures.tags,
        ALLOWED_ATTR: [],
        ALLOW_DATA_ATTR: false,
        ...options,
      };

      // Configure allowed attributes
      for (const [tag, attrs] of Object.entries(this.bleachFeatures.attributes)) {
        if (config.ALLOWED_TAGS.includes(tag)) {
          config.ALLOWED_ATTR.push(...attrs);
        }
      }

      const result = this.DOMPurify.sanitize(input, config);
      return {
        success: true,
        output: result,
        config: config,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: input,
      };
    }
  }

  /**
   * Tests sanitize-html library
   */
  testSanitizeHtml(input, options = {}) {
    try {
      const config = {
        allowedTags: this.bleachFeatures.tags,
        allowedAttributes: this.bleachFeatures.attributes,
        allowedSchemes: this.bleachFeatures.protocols,
        ...options,
      };

      const result = sanitizeHtml(input, config);
      return {
        success: true,
        output: result,
        config: config,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: input,
      };
    }
  }

  /**
   * Simulates Python bleach behavior (for comparison)
   * Note: This is a conceptual implementation based on bleach documentation
   */
  simulateBleach(input, options = {}) {
    try {
      // Conceptual bleach implementation
      // In reality, this would use the actual Python bleach library
      const config = {
        tags: this.bleachFeatures.tags,
        attributes: this.bleachFeatures.attributes,
        protocols: this.bleachFeatures.protocols,
        strip: this.bleachFeatures.strip,
        ...options,
      };

      // Simple regex-based simulation (not production-ready)
      let result = input;

      // Remove script tags
      result = result.replaceAll(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

      // Remove event handlers
      result = result.replaceAll(/on\w+="[^"]*"/gi, '');
      result = result.replaceAll(/on\w+='[^']*'/gi, '');

      // Remove javascript: protocols
      result = result.replaceAll(/href="javascript:[^"]*"/gi, '');
      result = result.replaceAll(/href='javascript:[^']*'/gi, '');

      // Remove style attributes with dangerous content
      result = result.replaceAll(/style="[^"]*javascript:[^"]*"/gi, '');
      result = result.replaceAll(/style='[^']*javascript:[^']*'/gi, '');

      return {
        success: true,
        output: result.trim(),
        config: config,
        note: 'This is a conceptual simulation. Real bleach would be more comprehensive.',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: input,
      };
    }
  }

  /**
   * Runs comprehensive comparison test
   */
  runComparisonTest(testName, testCase) {
    const results = {
      testName,
      description: testCase.description,
      input: testCase.input,
      expected: testCase.expected,
      libraries: {},
    };

    // Test each library
    results.libraries.DOMPurify = this.testDOMPurify(testCase.input);
    results.libraries.sanitizeHtml = this.testSanitizeHtml(testCase.input);
    results.libraries.bleach = this.simulateBleach(testCase.input);

    // Calculate accuracy scores
    results.accuracy = {};
    for (const [libName, libResult] of Object.entries(results.libraries)) {
      results.accuracy[libName] = libResult.success ? this.calculateAccuracy(libResult.output, testCase.expected) : 0;
    }

    return results;
  }

  /**
   * Calculates accuracy score (0-100) based on output similarity to expected
   */
  calculateAccuracy(output, expected) {
    // Normalize strings for comparison
    const normalize = (str) => str.replaceAll(/\s+/g, ' ').trim().toLowerCase();

    const normalizedOutput = normalize(output);
    const normalizedExpected = normalize(expected);

    if (normalizedOutput === normalizedExpected) {
      return 100;
    }

    // Simple similarity score based on common substrings
    const outputWords = normalizedOutput.split(' ');
    const expectedWords = normalizedExpected.split(' ');

    const commonWords = outputWords.filter((word) => expectedWords.includes(word)).length;
    const totalWords = Math.max(outputWords.length, expectedWords.length);

    return Math.round((commonWords / totalWords) * 100);
  }

  /**
   * Runs all comparison tests
   */
  runAllTests() {
    const results = {
      summary: {
        totalTests: Object.keys(this.testCases).length,
        libraries: ['DOMPurify', 'sanitizeHtml', 'bleach'],
      },
      tests: {},
      aggregateScores: {},
    };

    // Initialize aggregate scores
    for (const lib of results.summary.libraries) {
      results.aggregateScores[lib] = {
        totalScore: 0,
        successfulTests: 0,
        averageAccuracy: 0,
      };
    }

    // Run each test
    for (const [testName, testCase] of Object.entries(this.testCases)) {
      const testResult = this.runComparisonTest(testName, testCase);
      results.tests[testName] = testResult;

      // Update aggregate scores
      for (const lib of results.summary.libraries) {
        if (testResult.libraries[lib].success) {
          results.aggregateScores[lib].successfulTests++;
          results.aggregateScores[lib].totalScore += testResult.accuracy[lib];
        }
      }
    }

    // Calculate averages
    for (const lib of results.summary.libraries) {
      const agg = results.aggregateScores[lib];
      agg.averageAccuracy =
        agg.successfulTests > 0 ? Math.round(agg.totalScore / agg.successfulTests) : 0;
    }

    return results;
  }

  /**
   * Generates feature comparison matrix
   */
  generateFeatureComparison() {
    return {
      DOMPurify: {
        type: 'DOM-based',
        serverCompatible: true,
        clientCompatible: true,
        performance: 'Fast',
        security: 'High',
        configurability: 'High',
        learningCurve: 'Medium',
        maintenance: 'Low',
        pros: [
          'Industry standard for HTML sanitization',
          'Excellent security track record',
          'Highly configurable',
          'Works in Node.js and browsers',
        ],
        cons: [
          'Requires JSDOM for server-side DOM manipulation',
          'Larger bundle size',
          'Complex configuration options',
        ],
      },
      sanitizeHtml: {
        type: 'Parser-based',
        serverCompatible: true,
        clientCompatible: false,
        performance: 'Very Fast',
        security: 'High',
        configurability: 'High',
        learningCurve: 'Low',
        maintenance: 'Low',
        pros: ['Lightweight and fast', 'Simple API', 'Good documentation', 'Active maintenance'],
        cons: ['Server-side only', 'Less comprehensive than DOMPurify', 'Fewer advanced features'],
      },
      bleach: {
        type: 'Parser-based',
        serverCompatible: true,
        clientCompatible: false,
        performance: 'Fast',
        security: 'Very High',
        configurability: 'Medium',
        learningCurve: 'Medium',
        maintenance: 'Medium',
        pros: [
          'Python standard for HTML sanitization',
          'Excellent security reputation',
          'Comprehensive tag/attribute control',
          'Battle-tested in production',
        ],
        cons: [
          'Python only (requires separate process)',
          'Less active development than Node.js alternatives',
          'Configuration can be complex',
        ],
      },
    };
  }

  /**
   * Generates implementation recommendations
   */
  generateRecommendations(comparisonResults) {
    const recommendations = {
      primaryRecommendation: '',
      alternatives: [],
      migrationStrategy: {},
      riskAssessment: {},
    };

    // Analyze results to determine best library
    const scores = comparisonResults.aggregateScores;

    // DOMPurify typically scores highest in comprehensive HTML sanitization
    if (scores.DOMPurify.averageAccuracy >= 90) {
      recommendations.primaryRecommendation = 'DOMPurify';
      recommendations.alternatives = ['sanitizeHtml', 'bleach'];
    } else if (scores.sanitizeHtml.averageAccuracy >= 85) {
      recommendations.primaryRecommendation = 'sanitizeHtml';
      recommendations.alternatives = ['DOMPurify', 'bleach'];
    } else {
      recommendations.primaryRecommendation = 'bleach';
      recommendations.alternatives = ['DOMPurify', 'sanitizeHtml'];
    }

    // Migration strategy
    recommendations.migrationStrategy = {
      phases: [
        'Evaluate current sanitization usage patterns',
        'Create adapter layer for new library',
        'Implement gradual rollout with feature flags',
        'Monitor performance and security metrics',
        'Complete migration and remove old implementation',
      ],
      estimatedEffort: '2-3 weeks',
      riskLevel: 'Medium',
      rollbackPlan: 'Feature flag rollback to previous implementation',
    };

    // Risk assessment
    recommendations.riskAssessment = {
      security: 'Low - All evaluated libraries have strong security track records',
      performance: 'Low - Libraries are optimized for performance',
      compatibility: 'Medium - May require configuration adjustments',
      maintenance: 'Low - All libraries are actively maintained',
    };

    return recommendations;
  }
}

module.exports = BleachNodeComparison;
