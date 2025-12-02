require('dotenv').config();

const getConfig = () => ({
  // Feature flags
  features: {
    trustTokens: {
      enabled: !['false', '0', 'no', 'off'].includes(process.env.TRUST_TOKENS_ENABLED), // Default to true
    },
  },

  // Other config can be added here
});

module.exports = getConfig();
