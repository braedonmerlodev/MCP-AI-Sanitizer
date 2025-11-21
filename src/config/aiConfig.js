require('dotenv').config();

const validateOpenAIApiKey = (apiKey, environment) => {
  if (!apiKey || apiKey === '') {
    if (environment === 'production') {
      throw new Error('OPENAI_API_KEY environment variable must be set in production');
    }
    // In development, allow missing key but log warning
    console.warn('OPENAI_API_KEY not set - AI features may not work in development');
    return false;
  }

  // Format validation: must start with 'sk-'
  if (!apiKey.startsWith('sk-')) {
    const errorMsg = 'OPENAI_API_KEY must start with "sk-"';
    if (environment === 'production') {
      throw new Error(errorMsg);
    }
    console.warn(`Warning: ${errorMsg}`);
    return false;
  }

  // Length check: exactly 51 characters
  if (apiKey.length !== 51) {
    const errorMsg = `OPENAI_API_KEY must be exactly 51 characters, got ${apiKey.length}`;
    if (environment === 'production') {
      throw new Error(errorMsg);
    }
    console.warn(`Warning: ${errorMsg}`);
    return false;
  }

  // Check remaining characters are alphanumeric
  const remaining = apiKey.slice(3);
  if (!/^[a-zA-Z0-9]+$/.test(remaining)) {
    const errorMsg = 'OPENAI_API_KEY must contain only alphanumeric characters after "sk-"';
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
  const openaiApiKey = process.env.OPENAI_API_KEY;

  const isValid = validateOpenAIApiKey(openaiApiKey, environment);

  return {
    openai: {
      apiKey: openaiApiKey,
      isValid: isValid,
    },
  };
};

// For testing purposes, export the function
getConfig.getConfig = getConfig;

module.exports = getConfig();
