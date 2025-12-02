const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { PromptTemplate } = require('@langchain/core/prompts');
const winston = require('winston');
const SanitizationPipeline = require('./sanitization-pipeline');
const aiConfig = require('../config/aiConfig');
const config = require('../config');

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
 * AITextTransformer handles AI-powered text transformations using Gemini models with double sanitization.
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

    // Define prompt templates for each transformation type
    this.prompts = {
      structure: PromptTemplate.fromTemplate(
        'Structure this raw text into a JSON object with keys like "title", "summary", "content", "key_points" (as array), and any other relevant sections. Return only valid JSON: {text}',
      ),
      summarize: PromptTemplate.fromTemplate(
        'Provide a concise summary of the following text: {text}',
      ),
      extract_entities: PromptTemplate.fromTemplate(
        'Extract and list all named entities (people, organizations, locations, dates, etc.) from the following text: {text}',
      ),
      json_schema: PromptTemplate.fromTemplate(
        'Convert the following text into a valid JSON schema representation: {text}',
      ),
    };
  }

  /**
   * Transforms text using AI with double sanitization.
   * @param {string} text - The input text to transform
   * @param {string} type - Transformation type: 'structure', 'summarize', 'extract_entities', 'json_schema'
   * @param {Object} options - Transformation options
   * @returns {string} - The transformed and sanitized text
   */
  async transform(text, type, options = {}) {
    const startTime = Date.now();

    // Validate transformation type before processing
    const prompt = this.prompts[type];
    if (!prompt) {
      throw new Error(`Unknown transformation type: ${type}`);
    }

    try {
      // Sanitize input before AI processing
      const sanitizedInput = await this.sanitizer.sanitize(text, options.sanitizerOptions || {});

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
