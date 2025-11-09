/**
 * FeatureExtractor processes risk assessment data to generate structured features
 * compatible with ML frameworks. Includes content analysis, behavioral patterns,
 * and risk indicators for AI model training.
 */

class FeatureExtractor {
  constructor(options = {}) {
    this.options = {
      maxContentLength: options.maxContentLength || 10000,
      enableBehavioralAnalysis: options.enableBehavioralAnalysis !== false,
      enableContentAnalysis: options.enableContentAnalysis !== false,
      enableRiskIndicators: options.enableRiskIndicators !== false,
      ...options,
    };

    // Suspicious patterns for risk indicators
    this.suspiciousPatterns = {
      scriptTags: /<script[^>]*>[\s\S]*?<\/script>/gi,
      javascriptUrls: /javascript:/gi,
      dataUrls: /data:[^;]/gi,
      eventHandlers: /on\w+\s*=/gi,
      sqlInjection:
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b.*\b(FROM|INTO|WHERE|VALUES)\b)/gi,
      xssVectors: /(<iframe|<object|<embed|<form|<input|<meta|<link)/gi,
      commandInjection: /(\||&|;|\$\(|\`)/g,
      pathTraversal: /(\.\.\/|\.\.\\)/g,
      unicodeObfuscation: /\\u[0-9a-f]{4}/gi,
    };

    // Behavioral pattern indicators
    this.behavioralPatterns = {
      highFrequencyRequests: (requestCount) => requestCount > 100,
      unusualTiming: (timestamps) => this.detectUnusualTiming(timestamps),
      repetitiveContent: (content) => this.detectRepetitiveContent(content),
      encodingAnomalies: (content) => this.detectEncodingAnomalies(content),
    };
  }

  /**
   * Extracts comprehensive features from risk assessment data
   * @param {Object} riskData - Risk assessment data
   * @param {string} riskData.content - Original content
   * @param {Object} riskData.metadata - Request metadata
   * @param {Array} riskData.processingSteps - Processing history
   * @param {Object} riskData.context - Additional context
   * @returns {Object} - Structured feature vector
   */
  extractFeatures(riskData) {
    const { content, metadata = {}, processingSteps = [], context = {} } = riskData;

    const features = {
      // Content analysis features
      ...this.extractContentFeatures(content),

      // Behavioral pattern features
      ...this.extractBehavioralFeatures(metadata, processingSteps, context),

      // Risk indicator features
      ...this.extractRiskIndicators(content, metadata),

      // Structural features
      ...this.extractStructuralFeatures(content),

      // Temporal features
      ...this.extractTemporalFeatures(metadata),

      // Metadata features
      ...this.extractMetadataFeatures(metadata),
    };

    return features;
  }

  /**
   * Extracts content-based features
   * @param {string} content - Content to analyze
   * @returns {Object} - Content features
   */
  extractContentFeatures(content) {
    if (!content || typeof content !== 'string') {
      return {
        contentLength: 0,
        specialCharsCount: 0,
        scriptTagsCount: 0,
        suspiciousPatternsCount: 0,
        entropyScore: 0,
        languageFeatures: {},
      };
    }

    const truncatedContent = content.substring(0, this.options.maxContentLength);

    // Basic content metrics
    const contentLength = truncatedContent.length;
    const specialCharsCount = (truncatedContent.match(/[^a-zA-Z0-9\s]/g) || []).length;

    // Script and injection patterns
    const scriptTagsCount = (truncatedContent.match(this.suspiciousPatterns.scriptTags) || [])
      .length;
    const javascriptUrlsCount = (
      truncatedContent.match(this.suspiciousPatterns.javascriptUrls) || []
    ).length;
    const dataUrlsCount = (truncatedContent.match(this.suspiciousPatterns.dataUrls) || []).length;
    const eventHandlersCount = (truncatedContent.match(this.suspiciousPatterns.eventHandlers) || [])
      .length;

    // Injection attack patterns
    const sqlInjectionCount = (truncatedContent.match(this.suspiciousPatterns.sqlInjection) || [])
      .length;
    const xssVectorsCount = (truncatedContent.match(this.suspiciousPatterns.xssVectors) || [])
      .length;
    const commandInjectionCount = (
      truncatedContent.match(this.suspiciousPatterns.commandInjection) || []
    ).length;
    const pathTraversalCount = (truncatedContent.match(this.suspiciousPatterns.pathTraversal) || [])
      .length;

    // Calculate suspicious patterns count
    const suspiciousPatternsCount =
      scriptTagsCount +
      javascriptUrlsCount +
      dataUrlsCount +
      eventHandlersCount +
      sqlInjectionCount +
      xssVectorsCount +
      commandInjectionCount +
      pathTraversalCount;

    // Entropy calculation (measure of randomness)
    const entropyScore = this.calculateEntropy(truncatedContent);

    // Language features
    const languageFeatures = this.extractLanguageFeatures(truncatedContent);

    return {
      contentLength,
      specialCharsCount,
      scriptTagsCount,
      javascriptUrlsCount,
      dataUrlsCount,
      eventHandlersCount,
      sqlInjectionCount,
      xssVectorsCount,
      commandInjectionCount,
      pathTraversalCount,
      suspiciousPatternsCount,
      entropyScore,
      languageFeatures,
    };
  }

  /**
   * Extracts behavioral pattern features
   * @param {Object} metadata - Request metadata
   * @param {Array} processingSteps - Processing history
   * @param {Object} context - Additional context
   * @returns {Object} - Behavioral features
   */
  extractBehavioralFeatures(metadata, processingSteps, context) {
    const features = {
      processingStepsCount: processingSteps.length,
      hasValidationErrors: false,
      hasSanitizationModifications: false,
      requestFrequency: 0,
      sessionDuration: 0,
      userAgentAnomaly: false,
      ipReputationScore: 0,
    };

    // Processing steps analysis
    if (processingSteps.length > 0) {
      features.hasValidationErrors = processingSteps.some(
        (step) => step.result && step.result.errors && step.result.errors.length > 0,
      );
      features.hasSanitizationModifications = processingSteps.some(
        (step) => step.action && step.action.includes('sanitize'),
      );
    }

    // Request frequency analysis
    if (metadata.requestCount && metadata.timeWindow) {
      features.requestFrequency = metadata.requestCount / Math.max(metadata.timeWindow, 1);
    }

    // Session analysis
    if (metadata.sessionStart && metadata.sessionEnd) {
      features.sessionDuration = new Date(metadata.sessionEnd) - new Date(metadata.sessionStart);
    }

    // User agent analysis
    if (metadata.userAgent) {
      features.userAgentAnomaly = this.detectUserAgentAnomaly(metadata.userAgent);
    }

    // IP reputation (placeholder - would integrate with external service)
    if (metadata.ipAddress) {
      features.ipReputationScore = this.getIPReputationScore(metadata.ipAddress);
    }

    return features;
  }

  /**
   * Extracts risk indicator features
   * @param {string} content - Content to analyze
   * @param {Object} metadata - Request metadata
   * @returns {Object} - Risk indicator features
   */
  extractRiskIndicators(content, metadata = {}) {
    const features = {
      riskScore: 0,
      threatLevel: 'low',
      anomalyIndicators: [],
      complianceFlags: [],
      securityHeadersPresent: false,
      encryptionIndicators: false,
    };

    if (!content) return features;

    // Calculate risk score based on patterns
    let riskScore = 0;
    const anomalyIndicators = [];

    // High-risk patterns
    if (this.suspiciousPatterns.scriptTags.test(content)) {
      riskScore += 0.8;
      anomalyIndicators.push('script_injection');
    }
    if (this.suspiciousPatterns.sqlInjection.test(content)) {
      riskScore += 0.9;
      anomalyIndicators.push('sql_injection');
    }
    if (this.suspiciousPatterns.commandInjection.test(content)) {
      riskScore += 0.7;
      anomalyIndicators.push('command_injection');
    }

    // Medium-risk patterns
    if (this.suspiciousPatterns.xssVectors.test(content)) {
      riskScore += 0.6;
      anomalyIndicators.push('xss_attempt');
    }
    if (this.suspiciousPatterns.pathTraversal.test(content)) {
      riskScore += 0.5;
      anomalyIndicators.push('path_traversal');
    }

    // Low-risk patterns
    if (this.suspiciousPatterns.javascriptUrls.test(content)) {
      riskScore += 0.3;
      anomalyIndicators.push('javascript_url');
    }
    if (this.suspiciousPatterns.dataUrls.test(content)) {
      riskScore += 0.2;
      anomalyIndicators.push('data_url');
    }

    // Behavioral risk indicators
    if (metadata.requestFrequency > 10) {
      riskScore += 0.4;
      anomalyIndicators.push('high_frequency');
    }
    if (metadata.sessionDuration > 3600000) {
      // 1 hour
      riskScore += 0.2;
      anomalyIndicators.push('long_session');
    }

    // Determine threat level
    let threatLevel = 'low';
    if (riskScore >= 0.8) threatLevel = 'high';
    else if (riskScore >= 0.4) threatLevel = 'medium';

    // Compliance flags
    const complianceFlags = [];
    if (!metadata.hasSecurityHeaders) {
      complianceFlags.push('missing_security_headers');
    }
    if (metadata.unencryptedTransmission) {
      complianceFlags.push('unencrypted_transmission');
    }

    features.riskScore = Math.min(riskScore, 1.0);
    features.threatLevel = threatLevel;
    features.anomalyIndicators = anomalyIndicators;
    features.complianceFlags = complianceFlags;
    features.securityHeadersPresent = metadata.hasSecurityHeaders || false;
    features.encryptionIndicators = !metadata.unencryptedTransmission;

    return features;
  }

  /**
   * Extracts structural features from content
   * @param {string} content - Content to analyze
   * @returns {Object} - Structural features
   */
  extractStructuralFeatures(content) {
    if (!content) {
      return {
        structuralFeatures: {
          hasHtml: false,
          hasJson: false,
          hasXml: false,
          tagCount: 0,
          attributeCount: 0,
          nestingDepth: 0,
          compressionRatio: 0,
        },
      };
    }

    const features = {
      hasHtml: /<\/?[a-zA-Z][^>]*>/i.test(content),
      hasJson: this.isValidJson(content),
      hasXml: /<\/?[a-zA-Z][^>]*>/.test(content) && content.includes('<?xml'),
      tagCount: (content.match(/<\/?[a-zA-Z][^>]*>/gi) || []).length,
      attributeCount: (content.match(/\s+[a-zA-Z-]+\s*=/gi) || []).length,
      nestingDepth: this.calculateNestingDepth(content),
      compressionRatio: this.calculateCompressionRatio(content),
    };

    return { structuralFeatures: features };
  }

  /**
   * Extracts temporal features
   * @param {Object} metadata - Request metadata
   * @returns {Object} - Temporal features
   */
  extractTemporalFeatures(metadata) {
    const features = {
      temporalFeatures: {
        isBusinessHours: false,
        isWeekend: false,
        requestHour: 0,
        requestDayOfWeek: 0,
        timeSinceLastRequest: 0,
        burstRequestPattern: false,
      },
    };

    if (metadata.timestamp) {
      const date = new Date(metadata.timestamp);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();

      features.temporalFeatures.isBusinessHours = hour >= 9 && hour <= 17;
      features.temporalFeatures.isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      features.temporalFeatures.requestHour = hour;
      features.temporalFeatures.requestDayOfWeek = dayOfWeek;
    }

    if (metadata.lastRequestTime) {
      features.temporalFeatures.timeSinceLastRequest =
        new Date(metadata.timestamp) - new Date(metadata.lastRequestTime);
    }

    if (metadata.requestTimestamps && metadata.requestTimestamps.length > 5) {
      features.temporalFeatures.burstRequestPattern = this.detectBurstPattern(
        metadata.requestTimestamps,
      );
    }

    return features;
  }

  /**
   * Extracts metadata-based features
   * @param {Object} metadata - Request metadata
   * @returns {Object} - Metadata features
   */
  extractMetadataFeatures(metadata) {
    return {
      metadataFeatures: {
        contentType: metadata.contentType || 'unknown',
        userAgentLength: metadata.userAgent ? metadata.userAgent.length : 0,
        hasReferer: !!metadata.referer,
        hasCookies: !!(metadata.cookies && Object.keys(metadata.cookies).length > 0),
        requestMethod: metadata.method || 'GET',
        protocolVersion: metadata.protocol || 'HTTP/1.1',
        geoLocationKnown: !!(metadata.country || metadata.city),
        deviceType: this.classifyDeviceType(metadata.userAgent),
      },
    };
  }

  /**
   * Calculates Shannon entropy of content
   * @param {string} content - Content to analyze
   * @returns {number} - Entropy score (0-1)
   */
  calculateEntropy(content) {
    if (!content || content.length === 0) return 0;

    const charCounts = {};
    for (const char of content) {
      charCounts[char] = (charCounts[char] || 0) + 1;
    }

    let entropy = 0;
    const len = content.length;

    for (const count of Object.values(charCounts)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    // Normalize to 0-1 scale (max entropy for ASCII is ~7 bits)
    return Math.min(entropy / 7, 1);
  }

  /**
   * Extracts language-specific features
   * @param {string} content - Content to analyze
   * @returns {Object} - Language features
   */
  extractLanguageFeatures(content) {
    const features = {
      wordCount: 0,
      averageWordLength: 0,
      sentenceCount: 0,
      uppercaseRatio: 0,
      digitRatio: 0,
      whitespaceRatio: 0,
    };

    if (!content) return features;

    const words = content.split(/\s+/).filter((word) => word.length > 0);
    features.wordCount = words.length;
    features.averageWordLength =
      words.length > 0 ? words.reduce((sum, word) => sum + word.length, 0) / words.length : 0;

    features.sentenceCount = (content.match(/[.!?]+/g) || []).length;
    features.uppercaseRatio = (content.match(/[A-Z]/g) || []).length / Math.max(content.length, 1);
    features.digitRatio = (content.match(/\d/g) || []).length / Math.max(content.length, 1);
    features.whitespaceRatio = (content.match(/\s/g) || []).length / Math.max(content.length, 1);

    return features;
  }

  /**
   * Detects unusual timing patterns
   * @param {Array} timestamps - Array of timestamps
   * @returns {boolean} - Whether timing is unusual
   */
  detectUnusualTiming(timestamps) {
    if (!timestamps || timestamps.length < 3) return false;

    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance =
      intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) /
      intervals.length;

    // High variance indicates irregular timing
    return variance > avgInterval * 2;
  }

  /**
   * Detects repetitive content patterns
   * @param {string} content - Content to analyze
   * @returns {boolean} - Whether content is repetitive
   */
  detectRepetitiveContent(content) {
    if (!content || content.length < 20) return false;

    // Simple repetition detection using substrings
    const substrings = new Set();
    let repetitionCount = 0;

    for (let len = 10; len <= 50; len += 10) {
      for (let i = 0; i <= content.length - len; i += len) {
        const substring = content.substring(i, i + len);
        if (substrings.has(substring)) {
          repetitionCount++;
        }
        substrings.add(substring);
      }
    }

    return repetitionCount > 5;
  }

  /**
   * Detects encoding anomalies
   * @param {string} content - Content to analyze
   * @returns {boolean} - Whether encoding anomalies are detected
   */
  detectEncodingAnomalies(content) {
    if (!content) return false;

    // Check for mixed encodings, unusual unicode, etc.
    const mixedEncoding =
      /[\u0000-\u001F\u007F-\u009F]/.test(content) && /[\u0080-\uFFFF]/.test(content);
    const excessiveUnicode = (content.match(/\\u[0-9a-f]{4}/gi) || []).length > 10;

    return mixedEncoding || excessiveUnicode;
  }

  /**
   * Detects user agent anomalies
   * @param {string} userAgent - User agent string
   * @returns {boolean} - Whether user agent is anomalous
   */
  detectUserAgentAnomaly(userAgent) {
    if (!userAgent) return true;

    // Common bot indicators
    const botIndicators = [
      'bot',
      'crawler',
      'spider',
      'scraper',
      'python',
      'curl',
      'wget',
      'postman',
    ];

    const lowerUA = userAgent.toLowerCase();
    return botIndicators.some((indicator) => lowerUA.includes(indicator));
  }

  /**
   * Gets IP reputation score (placeholder)
   * @returns {number} - Reputation score (0-1, higher is better)
   */
  getIPReputationScore() {
    // Placeholder - would integrate with IP reputation service
    // For now, return neutral score
    return 0.5;
  }

  /**
   * Checks if content is valid JSON
   * @param {string} content - Content to check
   * @returns {boolean} - Whether content is valid JSON
   */
  isValidJson(content) {
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calculates nesting depth of HTML/XML structure
   * @param {string} content - Content to analyze
   * @returns {number} - Maximum nesting depth
   */
  calculateNestingDepth(content) {
    const tags = content.match(/<\/?[a-zA-Z][^>]*>/gi) || [];
    let maxDepth = 0;
    let currentDepth = 0;

    for (const tag of tags) {
      if (!tag.startsWith('</')) {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else {
        currentDepth = Math.max(0, currentDepth - 1);
      }
    }

    return maxDepth;
  }

  /**
   * Calculates compression ratio
   * @param {string} content - Content to analyze
   * @returns {number} - Compression ratio (0-1, lower means more compressible)
   */
  calculateCompressionRatio(content) {
    if (!content) return 0;

    // Simple compression ratio using LZ compression simulation
    const compressed = this.simpleLZCompress(content);
    return compressed.length / content.length;
  }

  /**
   * Simple LZ compression simulation
   * @param {string} str - String to compress
   * @returns {string} - Compressed representation
   */
  simpleLZCompress(str) {
    const dict = {};
    let result = '';
    let current = '';

    for (const char of str) {
      const next = current + char;
      if (dict[next]) {
        current = next;
      } else {
        if (current) {
          result += dict[current] || current;
        }
        dict[next] = Object.keys(dict).length + 1;
        current = char;
      }
    }

    if (current) {
      result += dict[current] || current;
    }

    return result;
  }

  /**
   * Detects burst request patterns
   * @param {Array} timestamps - Request timestamps
   * @returns {boolean} - Whether burst pattern is detected
   */
  detectBurstPattern(timestamps) {
    if (timestamps.length < 5) return false;

    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    // Look for clusters of very short intervals
    let burstCount = 0;
    for (let i = 0; i < intervals.length - 2; i++) {
      if (intervals[i] < 1000 && intervals[i + 1] < 1000 && intervals[i + 2] < 1000) {
        burstCount++;
      }
    }

    return burstCount > 2;
  }

  /**
   * Classifies device type from user agent
   * @param {string} userAgent - User agent string
   * @returns {string} - Device type classification
   */
  classifyDeviceType(userAgent) {
    if (!userAgent) return 'unknown';

    const ua = userAgent.toLowerCase();

    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    } else if (
      ua.includes('desktop') ||
      ua.includes('windows') ||
      ua.includes('macintosh') ||
      ua.includes('linux')
    ) {
      return 'desktop';
    } else {
      return 'unknown';
    }
  }

  /**
   * Generates feature vector compatible with ML frameworks
   * @param {Object} features - Extracted features
   * @returns {Object} - ML-ready feature vector
   */
  generateMLFeatureVector(features) {
    // Flatten nested features for ML compatibility
    const flattened = this.flattenFeatures(features);

    // Convert categorical features to numerical
    const numerical = this.categorizeToNumerical(flattened);

    return {
      features: numerical,
      featureNames: Object.keys(numerical),
      metadata: {
        extractionTimestamp: new Date().toISOString(),
        version: '1.0',
        frameworkCompatible: ['scikit-learn', 'tensorflow', 'pytorch'],
      },
    };
  }

  /**
   * Flattens nested feature objects
   * @param {Object} obj - Nested object
   * @param {string} prefix - Key prefix
   * @returns {Object} - Flattened object
   */
  flattenFeatures(obj, prefix = '') {
    const flattened = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}_${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenFeatures(value, newKey));
      } else if (Array.isArray(value)) {
        // Convert arrays to counts or binary indicators
        flattened[`${newKey}_count`] = value.length;
        flattened[`${newKey}_present`] = value.length > 0 ? 1 : 0;
      } else {
        flattened[newKey] = value;
      }
    }

    return flattened;
  }

  /**
   * Converts categorical features to numerical values
   * @param {Object} features - Feature object
   * @returns {Object} - Numerical features
   */
  categorizeToNumerical(features) {
    const numerical = { ...features };

    // Convert string categories to numbers
    const categoryMappings = {
      threatLevel: { low: 0, medium: 1, high: 2 },
      contentType: {
        unknown: 0,
        'text/plain': 1,
        'text/html': 2,
        'application/json': 3,
        'application/xml': 4,
        'multipart/form-data': 5,
      },
      requestMethod: { GET: 0, POST: 1, PUT: 2, DELETE: 3, PATCH: 4, HEAD: 5, OPTIONS: 6 },
      deviceType: { unknown: 0, mobile: 1, tablet: 2, desktop: 3 },
    };

    for (const [key, mapping] of Object.entries(categoryMappings)) {
      if (numerical[key] !== undefined && typeof numerical[key] === 'string') {
        numerical[key] = mapping[numerical[key]] !== undefined ? mapping[numerical[key]] : -1;
      }
    }

    // Ensure all values are numbers
    for (const [key, value] of Object.entries(numerical)) {
      if (typeof value === 'boolean') {
        numerical[key] = value ? 1 : 0;
      } else if (typeof value !== 'number') {
        numerical[key] = 0; // Default for unexpected types
      }
    }

    return numerical;
  }
}

module.exports = FeatureExtractor;
