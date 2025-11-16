require('dotenv').config();

const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  throw new Error('OPENAI_API_KEY environment variable must be set');
}

module.exports = {
  openai: {
    apiKey: openaiApiKey,
  },
};
