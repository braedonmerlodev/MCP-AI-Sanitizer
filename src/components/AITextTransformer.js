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
    this.prompts = {
      structure: PromptTemplate.fromTemplate(
        `SECURITY AWARENESS: You are part of a three-layer sanitization system. The input has already been sanitized, but you must ensure your JSON output is safe and secure.

Structure this sanitized text into a JSON object with keys like "title", "summary", "content", "key_points" (as array), and any other relevant sections.

SECURITY REQUIREMENTS:
- Never include any potentially malicious content, scripts, or dangerous patterns
- Ensure all string values are safe for web display
- Generate only valid, secure JSON
- Include a "securityValidated" field set to true in the output
- Flag any suspicious content in a "securityNotes" field if detected

Return only valid JSON: {text}`,
      ),
      summarize: PromptTemplate.fromTemplate(
        `SECURITY AWARENESS: You are part of a three-layer sanitization system. The input has already been sanitized.

Provide a concise summary of the following sanitized text.

SECURITY REQUIREMENTS:
- Never include any potentially malicious content or dangerous patterns
- Ensure the summary is safe for web display
- Do not propagate any suspicious content from the input
- Include security validation metadata

{text}`,
      ),
      extract_entities: PromptTemplate.fromTemplate(
        `SECURITY AWARENESS: You are part of a three-layer sanitization system. The input has already been sanitized.

Extract and list all named entities (people, organizations, locations, dates, etc.) from the following sanitized text.

SECURITY REQUIREMENTS:
- Only extract safe, legitimate entities
- Do not include any potentially malicious or suspicious content
- Validate that extracted entities are appropriate and safe
- Flag any potentially problematic entities in security notes

{text}`,
      ),
      json_schema: PromptTemplate.fromTemplate(
        `SECURITY AWARENESS: You are part of a three-layer sanitization system. The input has already been sanitized.

Convert the following sanitized text into a valid JSON schema representation.

SECURITY REQUIREMENTS:
- Generate only safe, valid JSON schema
- Ensure no malicious patterns are included in the schema
- Validate that the schema structure is secure
- Include security validation in the schema metadata
- Never generate schemas that could be used maliciously

{text}`,
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
      // Check for dangerous patterns that should never appear in AI responses
      const dangerousPatterns = [
        /<script[^>]*>[\s\S]*?<\/script>/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /<iframe[^>]*>/i,
        /<object[^>]*>/i,
        /<embed[^>]*>/i,
        /vbscript:/i,
        /data:text\/html/i,
        /expression\s*\(/i,
      ];

      const hasDangerousContent = dangerousPatterns.some((pattern) => pattern.test(response));

      if (hasDangerousContent) {
        securityMetadata.securityNotes.push('Dangerous content detected in AI response');
        securityMetadata.riskLevel = 'high';
        return securityMetadata;
      }

      // Validate JSON responses for the 'structure' type
      if (type === 'structure') {
        try {
          const parsed = JSON.parse(response);
          if (parsed.securityValidated) {
            securityMetadata.securityValidated = true;
            securityMetadata.riskLevel = 'low';
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
        // For non-JSON responses, basic validation
        securityMetadata.securityValidated = !hasDangerousContent;
        securityMetadata.riskLevel = hasDangerousContent ? 'high' : 'low';
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

    // Sanitize input before AI processing
    const sanitizedInput = await this.sanitizer.sanitize(text, options.sanitizerOptions || {});

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
      const securityValidation = this.validateAIResponse(aiOutput, type);
      if (securityValidation.riskLevel === 'high') {
        this.logger.warn('AI response failed security validation', {
          type,
          riskLevel: securityValidation.riskLevel,
          securityNotes: securityValidation.securityNotes,
          responseLength: aiOutput.length,
        });
        // Continue processing but log the security concern
      }

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
