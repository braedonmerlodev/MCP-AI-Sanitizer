const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { PromptTemplate } = require('@langchain/core/prompts');
const winston = require('winston');
const SanitizationPipeline = require('./sanitization-pipeline');
const aiConfig = require('../config/aiConfig');
const config = require('../config');
const { recordAIInputSanitization } = require('../utils/monitoring');

// Simple in-memory rate limiter for Gemini API
class RateLimiter {
  constructor(requestsPerMinute = 60, requestsPerHour = 1000) {
    this.requestsPerMinute = requestsPerMinute;
    this.requestsPerHour = requestsPerHour;
    this.requests = []; // For tracking all requests within hour window
  }

  canMakeRequest() {
    const now = Date.now();
    // Filter requests within the last hour
    const recentRequests = this.requests.filter((time) => now - time < 3_600_000); // 1 hour in ms
    // Filter requests within the last minute
    const minuteRequests = recentRequests.filter((time) => now - time < 60_000); // 1 minute in ms

    return (
      minuteRequests.length < this.requestsPerMinute && recentRequests.length < this.requestsPerHour
    );
  }

  recordRequest() {
    this.requests.push(Date.now());
  }
} // Global rate limiter instance
const geminiRateLimiter = new RateLimiter(
  config.rateLimits.gemini.requestsPerMinute,
  config.rateLimits.gemini.requestsPerHour,
);

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * AITextTransformer handles AI-powered text transformations using Gemini models with double sanitization
 * and security-aware processing. The AI agent is aware of its role in the three-layer sanitization system
 * and includes security validation in all responses.
 *
 * Security Features:
 * - Security-aware prompts that instruct AI to avoid malicious content
 * - AI response validation for dangerous patterns
 * - Security metadata included in all transformation results
 * - Risk level assessment for AI-generated content
 *
 * Supports multiple transformation types: structure, summarize, extract_entities, json_schema.
 */
class AITextTransformer {
  constructor(options = {}) {
    this.gemini = new ChatGoogleGenerativeAI({
      apiKey: aiConfig.gemini.apiKey,
      model: options.model ? `models/${options.model}` : 'models/gemini-pro',
      temperature: options.temperature ?? 0.1,
      maxOutputTokens: options.maxTokens ?? 2000,
    });

    this.sanitizer = new SanitizationPipeline(options.sanitizerOptions || {});
    this.logger = logger;

    // Define prompt templates for each transformation type with security awareness
    this.logger.info('Initializing AITextTransformer with enhanced security prompts');
    this.prompts = {
      structure: PromptTemplate.fromTemplate(
        `🚨 CRITICAL SECURITY PROTOCOL - VIOLATION = REJECTION 🚨

You are the FINAL SECURITY LAYER. You MUST sanitize and clean the input before structuring it.

TASK: First sanitize the input text by removing ALL malicious content, then structure the cleaned text into JSON.

SANITIZATION REQUIREMENTS (Apply BEFORE structuring):
1. Remove ALL zero-width characters, control characters, invisible Unicode
2. Remove ALL HTML tags: <script>, <iframe>, <object>, <embed>, etc.
3. Remove ALL dangerous URIs: javascript:, vbscript:, data:, etc.
4. CRITICAL: Remove ALL redacted placeholders completely: EMAIL_REDACTED, PHONE_REDACTED, SSN_REDACTED, NAME_REDACTED, ADDRESS_REDACTED - these must be entirely removed from output
5. Remove ALL mathematical symbols, special Unicode blocks, suspicious characters
6. Keep ONLY safe ASCII: a-z, A-Z, 0-9, spaces, . , ! ? - _ ( ) [ ] { } " ' : ;

STRUCTURING TASK: After sanitization, create JSON with keys like "title", "summary", "content", "key_points" (array).

SECURITY VALIDATION:
- Include "securityValidated": true in JSON output
- Your response will be scanned - ANY malicious pattern = REJECTION
- If input contains test/example malicious content, sanitize it completely

Return ONLY clean, safe JSON with sanitized content: {text}`,
      ),
      summarize: PromptTemplate.fromTemplate(
        `🚨 CRITICAL SECURITY PROTOCOL - VIOLATION = REJECTION 🚨

You are the FINAL SECURITY LAYER. First sanitize, then summarize.

SANITIZATION: Remove ALL malicious content from input before summarizing:
- Zero-width/control characters, HTML tags, dangerous URIs
- CRITICAL: Remove ALL redacted placeholders completely: EMAIL_REDACTED, PHONE_REDACTED, SSN_REDACTED, etc.
- Special Unicode, non-ASCII symbols
- Keep ONLY safe ASCII characters

TASK: Provide concise summary of the sanitized text.

SECURITY SCAN: ANY malicious pattern in output = REJECTION.

{text}

Return ONLY clean, safe summary text.`,
      ),
      extract_entities: PromptTemplate.fromTemplate(
        `🚨 CRITICAL SECURITY PROTOCOL - VIOLATION = REJECTION 🚨

You are the FINAL SECURITY LAYER. Sanitize first, then extract.

SANITIZATION: Clean input of all malicious content before entity extraction:
- Remove ALL redacted placeholders: EMAIL_REDACTED, PHONE_REDACTED, SSN_REDACTED, etc.
- Remove HTML tags, dangerous URIs, special characters

TASK: Extract only legitimate entities (people, organizations, locations, dates) from sanitized text.

SECURITY: Extract ONLY safe, legitimate entities. ANY malicious pattern = REJECTION.

{text}

Return ONLY clean entity extractions.`,
      ),
      json_schema: PromptTemplate.fromTemplate(
        `🚨 CRITICAL SECURITY PROTOCOL - VIOLATION = REJECTION 🚨

You are the FINAL SECURITY LAYER. Sanitize input, generate safe schema.

SANITIZATION: Remove all malicious content from input first:
- CRITICAL: Remove ALL redacted placeholders: EMAIL_REDACTED, PHONE_REDACTED, SSN_REDACTED, etc.
- Remove HTML tags, dangerous URIs, special characters

TASK: Generate valid JSON schema from sanitized text.

SECURITY: Schema must be safe and contain no malicious patterns. ANY violation = REJECTION.

{text}

Return ONLY clean, safe JSON schema.`,
      ),
    };
  }

  /**
   * Validates that input sanitization was successful by checking for dangerous patterns.
   * @param {string} original - Original input text
   * @param {string} sanitized - Sanitized input text
   * @returns {boolean} - True if sanitization appears successful
   */
  validateSanitization(original, sanitized) {
    // Check for common dangerous patterns that should be sanitized
    const dangerousPatterns = [
      /<script[^>]*>[\s\S]*?<\/script>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe[^>]*>/i,
      /<object[^>]*>/i,
      /<embed[^>]*>/i,
      /<form[^>]*>/i,
      /<input[^>]*>/i,
      /<meta[^>]*>/i,
      /expression\s*\(/i,
      /vbscript:/i,
      /data:text\/html/i,
    ];

    // If original contained dangerous patterns but sanitized doesn't, validation passes
    const originalHasDanger = dangerousPatterns.some((pattern) => pattern.test(original));
    const sanitizedHasDanger = dangerousPatterns.some((pattern) => pattern.test(sanitized));

    if (originalHasDanger && !sanitizedHasDanger) {
      // Successfully sanitized dangerous content
      recordAIInputSanitization('dangerousContentBlocked', {
        originalLength: original.length,
        sanitizedLength: sanitized.length,
      });
      return true;
    } else if (!originalHasDanger && !sanitizedHasDanger) {
      return true; // No dangerous content to begin with
    } else if (originalHasDanger && sanitizedHasDanger) {
      this.logger.warn('Sanitization validation failed: dangerous content still present', {
        originalLength: original.length,
        sanitizedLength: sanitized.length,
      });
      return false; // Dangerous content still present
    }

    return true; // Default pass
  }

  /**
   * Detect specific patterns in text for security analysis
   * @param {string} text - Text to analyze
   * @returns {Object} - Pattern analysis results
   */
  detectSpecificPatterns(text) {
    const patternsDetected = [];
    const detailedMatches = {
      redactedContent: [],
      zeroWidthChars: 0,
      scripts: [],
      iframes: [],
      javascriptUrls: [],
      nonAsciiChars: [],
    };

    // Check for redacted content patterns
    const redactedPatterns = [
      /EMAIL_REDACTED/gi,
      /PHONE_REDACTED/gi,
      /SSN_REDACTED/gi,
      /NAME_REDACTED/gi,
      /ADDRESS_REDACTED/gi,
    ];

    redactedPatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        detailedMatches.redactedContent.push(...matches);
        if (!patternsDetected.includes('redactedContent')) {
          patternsDetected.push('redactedContent');
        }
      }
    });

    // Check for zero-width characters
    const zeroWidthPattern = /[\u200B\u200C\u200D\u200E\u200F\uFEFF]/g;
    const zeroWidthMatches = text.match(zeroWidthPattern);
    if (zeroWidthMatches) {
      detailedMatches.zeroWidthChars = zeroWidthMatches.length;
      patternsDetected.push('zeroWidthChars');
    }

    // Check for scripts
    const scriptPattern = /<script[^>]*>[\s\S]*?<\/script>/gi;
    const scriptMatches = text.match(scriptPattern);
    if (scriptMatches) {
      detailedMatches.scripts = scriptMatches;
      patternsDetected.push('scripts');
    }

    // Check for iframes
    const iframePattern = /<iframe[^>]*>/gi;
    const iframeMatches = text.match(iframePattern);
    if (iframeMatches) {
      detailedMatches.iframes = iframeMatches;
      patternsDetected.push('iframes');
    }

    // Check for javascript URLs
    const jsUrlPattern = /javascript:/gi;
    const jsUrlMatches = text.match(jsUrlPattern);
    if (jsUrlMatches) {
      detailedMatches.javascriptUrls = jsUrlMatches;
      patternsDetected.push('javascriptUrls');
    }

    // Check for non-ASCII characters
    const nonAsciiPattern = /[^\x00-\x7F]/g;
    const nonAsciiMatches = text.match(nonAsciiPattern);
    if (nonAsciiMatches) {
      detailedMatches.nonAsciiChars = nonAsciiMatches;
      patternsDetected.push('nonAsciiChars');
    }

    return {
      patternsDetected,
      detailedMatches,
    };
  }

  /**
   * Check recursively if JSON object contains any values with malicious content.
   * @param {Object|Array|string|number|boolean} data - Data to check
   * @returns {boolean} - True if malicious content found
   */
  checkJsonForMaliciousContent(data) {
    if (typeof data === 'string') {
      const patterns = this.detectSpecificPatterns(data);
      return (
        patterns.detailedMatches.redactedContent?.length > 0 ||
        patterns.detailedMatches.zeroWidthChars > 0 ||
        patterns.patternsDetected.includes('scripts') ||
        patterns.patternsDetected.includes('iframes') ||
        patterns.patternsDetected.includes('javascriptUrls')
      );
    }

    if (Array.isArray(data)) {
      return data.some((item) => this.checkJsonForMaliciousContent(item));
    }

    if (data && typeof data === 'object' && data !== null) {
      return Object.values(data).some((value) => this.checkJsonForMaliciousContent(value));
    }

    return false;
  }

  /**
   * Validates AI response for security compliance and adherence to security instructions.
   * @param {string} response - AI generated response
   * @param {string} type - Transformation type
   * @returns {Object} - Validation result with security metadata
   */
  validateAIResponse(response, type) {
    const securityMetadata = {
      securityValidated: false,
      securityNotes: [],
      riskLevel: 'unknown',
      validationTimestamp: new Date().toISOString(),
    };

    try {
      // Get detailed pattern analysis for logging
      const patternAnalysis = this.detectSpecificPatterns(response);

      this.logger.debug('AI response pattern analysis', {
        type,
        patternsDetected: patternAnalysis.patternsDetected,
        detailedMatches: patternAnalysis.detailedMatches,
        responseLength: response.length,
      });

      // Check for dangerous patterns that should never appear in AI responses
      // Since AI is the "final security layer", be less strict - only reject truly dangerous executable content
      const dangerousPatterns = [
        /<script[^>]*>[\s\S]*?<\/script>/i,
        /javascript:/i,
        /vbscript:/i,
        /on\w+\s*=/i,
        /<iframe[^>]*>/i,
        /<object[^>]*>/i,
        /<embed[^>]*>/i,
        /data:text\/html/i,
        /expression\s*\(/i,
        // Keep zero-width characters as dangerous
        /\u200B|\u200C|\u200D|\uFEFF/, // Zero-width characters
        // Allow control characters in JSON (they might be escaped)
        // /[\u0000-\u001F\u007F-\u009F]/, // Control characters
        // CRITICAL: Reject redacted content - AI should remove these, not keep them
        /EMAIL_REDACTED/i,
        /PHONE_REDACTED/i,
        /SSN_REDACTED/i,
        /NAME_REDACTED/i,
        /ADDRESS_REDACTED/i,
        // Allow mathematical symbols in structured content
        // Allow miscellaneous symbols in content
      ];

      const hasDangerousContent = dangerousPatterns.some((pattern) => pattern.test(response));

      if (hasDangerousContent) {
        securityMetadata.securityNotes.push(
          `Content patterns detected: ${patternAnalysis.patternsDetected.join(', ')}`,
        );

        // For AI responses, be strict about redacted content - AI should have removed these
        const hasRedactedContent = patternAnalysis.patternsDetected.includes('redactedContent');
        const patternCount = patternAnalysis.patternsDetected.length;
        const hasMultipleThreats = patternCount > 2;
        const hasActiveThreats = patternAnalysis.detailedMatches.some(
          (match) =>
            match.includes('<script') ||
            match.includes('javascript:') ||
            match.includes('vbscript:'),
        );

        if (hasRedactedContent || hasMultipleThreats || hasActiveThreats) {
          securityMetadata.riskLevel = 'high';
          securityMetadata.securityNotes.push(
            'High-risk content detected - AI failed to sanitize properly',
          );
        } else {
          securityMetadata.riskLevel = 'medium';
          securityMetadata.securityNotes.push(
            'Minor content patterns detected - allowing with caution',
          );
        }

        securityMetadata.patternAnalysis = patternAnalysis;
        return securityMetadata;
      }

      // Check for non-ASCII characters that might be problematic
      const hasNonAscii = /[^ -~\s]/.test(response);
      if (hasNonAscii) {
        securityMetadata.securityNotes.push(
          `Non-ASCII characters detected (${patternAnalysis.detailedMatches.nonAsciiChars?.length || 0} instances)`,
        );
        securityMetadata.riskLevel = 'medium';
      }

      // Validate JSON responses for the 'structure' type
      if (type === 'structure') {
        try {
          const parsed = JSON.parse(response);

          // Check if the JSON contains any malicious content in its values
          const hasMaliciousInJson = this.checkJsonForMaliciousContent(parsed);
          if (hasMaliciousInJson) {
            securityMetadata.securityNotes.push('Malicious content detected in JSON structure');
            securityMetadata.riskLevel = 'high';
            return securityMetadata;
          }

          if (parsed.securityValidated) {
            securityMetadata.securityValidated = true;
            securityMetadata.riskLevel = hasNonAscii ? 'medium' : 'low';
          } else {
            securityMetadata.securityNotes.push(
              'Missing security validation flag in JSON response',
            );
            securityMetadata.riskLevel = 'medium';
          }
        } catch (jsonError) {
          securityMetadata.securityNotes.push('Invalid JSON structure in response');
          securityMetadata.riskLevel = 'high';
        }
      } else {
        // For non-JSON responses, comprehensive validation
        securityMetadata.securityValidated = !hasDangerousContent && !hasNonAscii;
        securityMetadata.riskLevel = hasDangerousContent ? 'high' : hasNonAscii ? 'medium' : 'low';
      }

      return securityMetadata;
    } catch (error) {
      this.logger.error('AI response validation failed', {
        error: error.message,
        responseLength: response.length,
        type,
      });
      securityMetadata.securityNotes.push('Validation error occurred');
      securityMetadata.riskLevel = 'high';
      return securityMetadata;
    }
  }

  /**
   * Transforms text using AI with double sanitization and security validation.
   * The AI agent includes security awareness and response validation.
   *
   * @param {string} text - The input text to transform
   * @param {string} type - Transformation type: 'structure', 'summarize', 'extract_entities', 'json_schema'
   * @param {Object} options - Transformation options
   * @returns {Object} - Result object with text and metadata including security validation
   * @returns {string} result.text - The transformed and sanitized text
   * @returns {Object} result.metadata - Processing metadata including security validation
   * @returns {Object} result.metadata.security - Security validation results
   */
  async transform(text, type, options = {}) {
    const startTime = Date.now();

    // Validate transformation type before processing
    const prompt = this.prompts[type];
    if (!prompt) {
      throw new Error(`Unknown transformation type: ${type}`);
    }

    this.logger.info('Selected AI prompt for transformation', {
      type,
      promptLength: prompt.template.length,
      hasSecurityInstructions: prompt.template.includes('CRITICAL SECURITY'),
      promptPreview: prompt.template.substring(0, 200) + '...',
    });

    // Sanitize input before AI processing
    const sanitizedInput = await this.sanitizer.sanitize(text, options.sanitizerOptions || {});

    this.logger.info('Input text for AI transformation', {
      type,
      originalInputLength: text.length,
      sanitizedInputLength: sanitizedInput.length,
      inputChanged: text !== sanitizedInput,
      originalInputPreview: text.slice(0, 300) + (text.length > 300 ? '...' : ''),
      sanitizedInputPreview:
        sanitizedInput.slice(0, 300) + (sanitizedInput.length > 300 ? '...' : ''),
    });

    // Validate that sanitization was successful
    const sanitizationValid = this.validateSanitization(text, sanitizedInput);
    if (!sanitizationValid) {
      this.logger.error('Input sanitization validation failed, rejecting AI processing', {
        type,
        inputLength: text.length,
        sanitizedLength: sanitizedInput.length,
      });
      // Record security event for monitoring
      recordAIInputSanitization('validationFailure', {
        type,
        inputLength: text.length,
        sanitizedLength: sanitizedInput.length,
      });
      throw new Error('Input sanitization validation failed - potential security risk');
    }

    try {
      // Check rate limits before calling Gemini API
      if (!geminiRateLimiter.canMakeRequest()) {
        this.logger.warn('Gemini API rate limit exceeded, using fallback strategy', {
          type,
          inputLength: text.length,
        });
        // Fallback: return the sanitized input
        return {
          text: sanitizedInput,
          metadata: {
            fallback: true,
            reason: 'rate_limit_exceeded',
          },
        };
      }

      geminiRateLimiter.recordRequest();

      // Create and execute the Langchain pipeline
      const chain = prompt.pipe(this.gemini);
      const result = await chain.invoke({ text: sanitizedInput });
      const aiOutput = result.content;

      // Validate AI response for security compliance
      this.logger.info('AI generated response before validation', {
        type,
        aiOutputLength: aiOutput.length,
        aiOutputPreview: aiOutput.slice(0, 500) + (aiOutput.length > 500 ? '...' : ''),
        isValidJSON: (() => {
          try {
            JSON.parse(aiOutput);
            return true;
          } catch {
            return false;
          }
        })(),
      });

      const securityValidation = this.validateAIResponse(aiOutput, type);
      if (securityValidation.riskLevel === 'high') {
        this.logger.error('AI response has high-risk patterns - rejecting AI output for security', {
          type,
          riskLevel: securityValidation.riskLevel,
          securityNotes: securityValidation.securityNotes,
          responseLength: aiOutput.length,
          responseSample: aiOutput.slice(0, 500),
          dangerousPatternsDetected: this.detectSpecificPatterns(aiOutput),
        });
        // Reject high-risk AI responses - they failed security validation
        throw new Error(
          `AI response failed security validation: ${securityValidation.securityNotes.join(', ')}`,
        );
      }

      this.logger.info('AI response passed security validation', {
        type,
        riskLevel: securityValidation.riskLevel,
        proceedingToOutput: true,
      });

      // Sanitize output after AI processing
      const sanitizedOutput = await this.sanitizer.sanitize(
        aiOutput,
        options.sanitizerOptions || {},
      );

      // Log performance metrics with actual token usage
      const processingTime = Date.now() - startTime;
      const usage = result.response_metadata?.usage || {};
      const promptTokens = usage.prompt_tokens || 0;
      const completionTokens = usage.completion_tokens || 0;
      const totalTokens = usage.total_tokens || promptTokens + completionTokens;

      // Cost calculation: Gemini pricing (as of 2024)
      // Input: $0.00025 per 1K characters, Output: $0.0005 per 1K characters (approximate)
      const inputCost = (sanitizedInput.length / 1000) * 0.000_25;
      const outputCost = (sanitizedOutput.length / 1000) * 0.0005;
      const totalCost = inputCost + outputCost;

      this.logger.info('AI transformation completed successfully', {
        type,
        inputLength: text.length,
        outputLength: sanitizedOutput.length,
        processingTime,
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
          total: totalTokens,
        },
        cost: {
          input: `$${inputCost.toFixed(4)}`,
          output: `$${outputCost.toFixed(4)}`,
          total: `$${totalCost.toFixed(4)}`,
        },
      });

      return {
        text: sanitizedOutput,
        metadata: {
          processingTime,
          cost: totalCost,
          tokens: {
            prompt: promptTokens,
            completion: completionTokens,
            total: totalTokens,
          },
          security: securityValidation,
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      // Check for quota/rate limit errors
      const isQuotaError =
        error.message?.includes('quota') ||
        error.message?.includes('rate limit') ||
        error.status === 429 ||
        error.code === 'RESOURCE_EXHAUSTED';

      if (isQuotaError) {
        this.logger.warn('Gemini API quota exceeded, using fallback strategy', {
          type,
          error: error.message,
          inputLength: text.length,
          processingTime,
        });
      } else {
        this.logger.error('AI transformation failed, falling back to sanitized input', {
          type,
          error: error.message,
          inputLength: text.length,
          processingTime,
          stack: error.stack,
        });
      }

      // Fallback: return the sanitized original text
      const fallbackOutput = await this.sanitizer.sanitize(text, options.sanitizerOptions || {});
      return {
        text: fallbackOutput,
        metadata: {
          fallback: true,
          reason: isQuotaError ? 'quota_exceeded' : 'ai_error',
        },
      };
    }
  }
}

module.exports = AITextTransformer;
