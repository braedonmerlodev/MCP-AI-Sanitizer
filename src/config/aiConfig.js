require('dotenv').config();

const getConfig = () => {
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey || openaiApiKey === '') {
    throw new Error('OPENAI_API_KEY environment variable must be set');
  }

  return {
    openai: {
      apiKey: openaiApiKey,
    },
  };
};

// For testing purposes, export the function
getConfig.getConfig = getConfig;

module.exports = getConfig();
