const { ChatOpenAI } = require('@langchain/openai');
const { PromptTemplate } = require('@langchain/core/prompts');
const winston = require('winston');
const SanitizationPipeline = require('./sanitization-pipeline');
const aiConfig = require('../config/aiConfig');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * AITextTransformer handles AI-powered text transformations using GPT models with double sanitization.
 * Supports multiple transformation types: structure, summarize, extract_entities, json_schema.
 */
class AITextTransformer {
  constructor(options = {}) {
    this.openai = new ChatOpenAI({
      openAIApiKey: aiConfig.openai.apiKey,
      modelName: options.model || 'gpt-3.5-turbo',
      temperature: options.temperature ?? 0.1,
      maxTokens: options.maxTokens ?? 2000,
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

      // Create and execute the Langchain pipeline
      const chain = prompt.pipe(this.openai);
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

      // Cost calculation: GPT-3.5-turbo pricing (as of 2024)
      // Input: $0.0015 per 1K tokens, Output: $0.002 per 1K tokens
      const inputCost = (promptTokens / 1000) * 0.0015;
      const outputCost = (completionTokens / 1000) * 0.002;
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
      // Log the error
      const processingTime = Date.now() - startTime;
      this.logger.error('AI transformation failed, falling back to sanitized input', {
        type,
        error: error.message,
        inputLength: text.length,
        processingTime,
        stack: error.stack,
      });

      // Fallback: return the sanitized original text
      const fallbackOutput = await this.sanitizer.sanitize(text, options.sanitizerOptions || {});
      return {
        text: fallbackOutput,
        metadata: null,
      };
    }
  }
}

module.exports = AITextTransformer;
