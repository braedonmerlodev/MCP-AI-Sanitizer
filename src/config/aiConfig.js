require('dotenv').config();

const validateGeminiApiKey = (apiKey, environment) => {
  if (!apiKey || apiKey === '') {
    if (environment === 'production') {
      throw new Error('GEMINI_API_KEY environment variable must be set in production');
    }
    // In development, allow missing key but log warning
    console.warn('GEMINI_API_KEY not set - AI features may not work in development');
    return false;
  }

  // Format validation: must start with 'AIzaSy'
  if (!apiKey.startsWith('AIzaSy')) {
    const errorMsg = 'GEMINI_API_KEY must start with "AIzaSy"';
    if (environment === 'production') {
      throw new Error(errorMsg);
    }
    console.warn(`Warning: ${errorMsg}`);
    return false;
  }

  // Length check: exactly 39 characters
  if (apiKey.length !== 39) {
    const errorMsg = `GEMINI_API_KEY must be exactly 39 characters, got ${apiKey.length}`;
    if (environment === 'production') {
      throw new Error(errorMsg);
    }
    console.warn(`Warning: ${errorMsg}`);
    return false;
  }

  // Check remaining characters are alphanumeric
  const remaining = apiKey.slice(6);
  if (!/^[a-zA-Z0-9]+$/.test(remaining)) {
    const errorMsg = 'GEMINI_API_KEY must contain only alphanumeric characters and underscores after "AIzaSy"';
    if (environment === 'production') {
      throw new Error(errorMsg);
    }
    console.warn(`Warning: ${errorMsg}`);
    return false;
  }

  return true;
};

const getConfig = () => {
  const environment = process.env.NODE_ENV || 'development';
  const geminiApiKey = process.env.GEMINI_API_KEY;

  const isValid = validateGeminiApiKey(geminiApiKey, environment);

  return {
    gemini: {
      apiKey: geminiApiKey,
      isValid: isValid,
    },
  };
};

// For testing purposes, export the function
getConfig.getConfig = getConfig;

module.exports = getConfig();
