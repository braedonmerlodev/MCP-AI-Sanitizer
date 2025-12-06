require('dotenv').config();

const getConfig = () => {
  // Check environment variable for trust tokens (defaults to true if not set)
  const trustTokensEnabled =
    process.env.TRUST_TOKENS_ENABLED !== 'false' &&
    process.env.TRUST_TOKENS_ENABLED !== '0' &&
    process.env.TRUST_TOKENS_ENABLED !== 'no';

  return {
    // Feature flags
    features: {
      trustTokens: {
        enabled: trustTokensEnabled,
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
  };
};

module.exports = getConfig();
