require('dotenv').config();

const getConfig = () => ({
  // Feature flags
  features: {
    trustTokens: {
      enabled: !['false', '0', 'no', 'off'].includes(process.env.TRUST_TOKENS_ENABLED), // Default to true
    },
  },

  // API rate limits (requests per minute per IP)
  rateLimits: {
    general: 100, // General API rate limit
    gemini: {
      requestsPerMinute: 60, // Gemini API calls per minute
      requestsPerHour: 1000, // Gemini API calls per hour
    },
  },

  // Other config can be added here
});

module.exports = getConfig();
