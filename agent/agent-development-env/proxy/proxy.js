const express = require('express');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const winston = require('winston');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const app = express();

// Environment variables with defaults
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const PORT = process.env.PROXY_PORT || 3001;
const RATE_LIMIT_REQUESTS = parseInt(process.env.RATE_LIMIT_REQUESTS) || 100;
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 3600000; // 1 hour
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 3600000; // 1 hour
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Initialize caches
const cache = new NodeCache({ stdTTL: CACHE_TTL / 1000 });
const validationCache = new NodeCache({ stdTTL: 900 }); // 15 minutes TTL for validation results

// Trust token-based cache management functions
const invalidateCacheByTrustToken = (trustToken, validation) => {
  if (!trustToken || !validation.valid) {
    // For invalid tokens, clear all 'no_token' entries
    const keys = cache.keys();
    let clearedCount = 0;
    keys.forEach((key) => {
      try {
        const cacheData = JSON.parse(key);
        if (cacheData.trustToken === 'no_token') {
          cache.del(key);
          clearedCount++;
        }
      } catch (e) {
        // Skip invalid JSON keys
      }
    });
    logger.info('Cache invalidation completed', {
      type: 'trust_token_invalidation',
      tokenStatus: 'invalid_or_missing',
      entriesCleared: clearedCount,
    });
    return clearedCount;
  }

  // For valid tokens, clear entries with matching token hash
  const tokenKey = generateTrustTokenCacheKey(trustToken, validation);
  const keys = cache.keys();
  let clearedCount = 0;
  keys.forEach((key) => {
    try {
      const cacheData = JSON.parse(key);
      if (cacheData.trustToken === tokenKey) {
        cache.del(key);
        clearedCount++;
      }
    } catch (e) {
      // Skip invalid JSON keys
    }
  });

  logger.info('Cache invalidation completed', {
    type: 'trust_token_invalidation',
    tokenHash: tokenKey,
    tokenFormat: validation.format,
    entriesCleared: clearedCount,
  });

  return clearedCount;
};

// Get cache statistics by trust token
const getCacheStatsByTrustToken = () => {
  const keys = cache.keys();
  const stats = {};

  keys.forEach((key) => {
    try {
      const cacheData = JSON.parse(key);
      const tokenKey = cacheData.trustToken || 'no_token';
      if (!stats[tokenKey]) {
        stats[tokenKey] = 0;
      }
      stats[tokenKey]++;
    } catch (e) {
      // Skip invalid JSON keys
    }
  });

  return stats;
};

// Configure logging (no sensitive data)
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'proxy.log' }),
  ],
});

// Trust token validation function
const validateTrustToken = (token) => {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'missing_or_invalid_type' };
  }

  // Check minimum length (reasonable security threshold)
  if (token.length < 8) {
    return { valid: false, reason: 'too_short' };
  }

  // Check maximum length (prevent DoS)
  if (token.length > 2048) {
    return { valid: false, reason: 'too_long' };
  }

  // Check for basic format validity
  // Allow alphanumeric, dots, dashes, underscores, plus, slash (for JWT/base64)
  const validChars = /^[A-Za-z0-9._\-+/=]+$/;
  if (!validChars.test(token)) {
    return { valid: false, reason: 'invalid_characters' };
  }

  // Additional format checks based on detected type
  const format = getTokenFormat(token);
  switch (format) {
    case 'jwt':
      // JWT should have exactly 2 dots (header.payload.signature)
      const dotCount = (token.match(/\./g) || []).length;
      if (dotCount !== 2) {
        return { valid: false, reason: 'invalid_jwt_format' };
      }
      break;

    case 'uuid':
      // UUID format already validated in getTokenFormat
      break;

    case 'base64':
      // Should be valid base64
      try {
        Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
      } catch (e) {
        return { valid: false, reason: 'invalid_base64' };
      }
      break;

    default:
      // For custom formats, basic validation is sufficient
      break;
  }

  return { valid: true, format };
};

// Helper function to detect basic token format (for logging only)
const getTokenFormat = (token) => {
  if (!token) return 'none';

  // JWT format (has dots)
  if (token.includes('.')) return 'jwt';

  // UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(token)) return 'uuid';

  // Base64-like format
  if (token.length > 20 && /^[A-Za-z0-9+/=]+$/.test(token)) return 'base64';

  // Default to custom
  return 'custom';
};

// Generate secure cache key component from trust token
const generateTrustTokenCacheKey = (trustToken, validation) => {
  if (!trustToken || !validation.valid) {
    // For invalid or missing tokens, use a consistent key component
    return 'no_token';
  }

  // Create a hash of the token for cache key uniqueness without exposing sensitive data
  const crypto = require('crypto');
  const tokenHash = crypto.createHash('sha256').update(trustToken).digest('hex').substring(0, 16); // Use first 16 chars for reasonable key size

  return `${validation.format}_${tokenHash}`;
};

// Trust token validation function - calls backend API with caching
const validateTrustTokenWithBackend = async (token) => {
  try {
    // Create cache key from token signature (if available)
    const cacheKey = token.signature || JSON.stringify(token);

    // Check cache first
    const cachedResult = validationCache.get(cacheKey);
    if (cachedResult) {
      logger.debug('Trust token validation cache hit', {
        cacheKey: cacheKey.substring(0, 16) + '...',
        isValid: cachedResult.isValid,
      });
      return cachedResult;
    }

    const response = await axios.post(`${BACKEND_URL}/api/trust-tokens/validate`, token, {
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Request-ID': Math.random().toString(36).substring(7),
      },
    });

    const result = {
      isValid: response.data.valid,
      error: response.data.valid ? null : response.data.error,
      statusCode: response.status,
    };

    // Cache the result
    validationCache.set(cacheKey, result);

    logger.debug('Trust token validation completed', {
      cacheKey: cacheKey.substring(0, 16) + '...',
      isValid: result.isValid,
      cached: true,
    });

    return result;
  } catch (error) {
    logger.error('Trust token validation API error', {
      error: error.message,
      statusCode: error.response?.status,
      tokenPresent: !!token,
    });

    return {
      isValid: false,
      error: `Validation service error: ${error.message}`,
      statusCode: error.response?.status || 500,
    };
  }
};

// Function to perform full backend validation (async)
const performBackendValidation = async (trustToken) => {
  if (!trustToken) {
    return {
      isValid: false,
      error: 'No token provided',
      validationType: 'missing_token',
      statusCode: 400,
    };
  }

  // First do basic format validation
  const basicValidation = validateTrustToken(trustToken);
  if (!basicValidation.valid) {
    return {
      isValid: false,
      error: basicValidation.reason,
      validationType: 'basic_format_check',
      format: basicValidation.format,
      statusCode: 400,
    };
  }

  // For strings, perform backend validation
  if (typeof trustToken === 'string') {
    try {
      const result = await validateTrustTokenWithBackend(trustToken);
      return {
        ...result,
        validationType: 'full_backend',
        format: basicValidation.format,
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Backend validation failed: ${error.message}`,
        validationType: 'backend_error',
        format: basicValidation.format,
        statusCode: 500,
      };
    }
  }

  // Perform full backend validation
  try {
    const result = await validateTrustTokenWithBackend(trustToken);
    return {
      ...result,
      validationType: 'full_backend',
      statusCode: result.statusCode || 200,
    };
  } catch (error) {
    logger.warn('Backend validation service error', {
      error: error.message,
      tokenPresent: !!trustToken,
      validationType: 'backend_error',
    });
    return {
      isValid: false,
      error: `Backend validation service unavailable: ${error.message}`,
      validationType: 'backend_service_error',
      statusCode: error.response?.status || 503,
    };
  }
};

// Trust token extraction middleware
const extractTrustToken = (req, res, next) => {
  const requestId = Math.random().toString(36).substring(7);

  // Extract trust token from various sources
  let trustToken = null;

  // Check Authorization header (Bearer token)
  const authHeader = req.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    trustToken = authHeader.substring(7); // Remove 'Bearer ' prefix
  }

  // Check X-Trust-Token header
  if (!trustToken) {
    trustToken = req.get('X-Trust-Token') || null;
  }

  // Check trust_token cookie
  if (!trustToken && req.cookies) {
    trustToken = req.cookies.trust_token || null;
  }

  // Check custom headers (coordinate with security team)
  if (!trustToken) {
    trustToken = req.get('X-Security-Token') || req.get('X-Auth-Token') || null;
  }

  // Store extracted token and basic validation on request object
  req.trustToken = trustToken;
  req.trustTokenValidation = validateTrustToken(trustToken);
  req.requestId = requestId;

  // Handle missing or invalid tokens gracefully with comprehensive audit logging
  if (!trustToken) {
    // No token found - comprehensive audit logging
    logger.warn('TRUST_TOKEN_MISSING', {
      eventType: 'trust_token_extraction',
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      checkedSources: [
        'Authorization',
        'X-Trust-Token',
        'cookie',
        'X-Security-Token',
        'X-Auth-Token',
      ],
      severity: 'medium',
      action: 'logged_and_continued',
    });
  } else if (!req.trustTokenValidation.valid) {
    // Invalid token found - detailed security audit logging
    logger.warn('TRUST_TOKEN_INVALID', {
      eventType: 'trust_token_validation',
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      tokenLength: trustToken.length,
      tokenFormat: getTokenFormat(trustToken),
      validationFailureReason: req.trustTokenValidation.reason,
      severity: 'high',
      action: 'logged_and_continued',
      recommendation: 'review_token_format_requirements',
    });
  } else {
    // Valid token - success audit logging
    logger.info('TRUST_TOKEN_VALID', {
      eventType: 'trust_token_validation',
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      timestamp: new Date().toISOString(),
      tokenFormat: req.trustTokenValidation.format,
      severity: 'low',
      action: 'validation_successful',
    });
  }

  next();
};

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: RATE_LIMIT_REQUESTS,
  message: {
    error: 'Rate limit exceeded',
    retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000),
    });
  },
});

app.use('/api/', limiter);

// Trust token extraction middleware
app.use('/api/', extractTrustToken);

// Request logging middleware (no sensitive data)
app.use('/api/', (req, res, next) => {
  const start = Date.now();
  const requestId = req.requestId || Math.random().toString(36).substring(7);

  logger.info('API Request', {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('content-length'),
    trustTokenPresent: !!req.trustToken,
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function (data) {
    const duration = Date.now() - start;
    logger.info('API Response', {
      requestId,
      statusCode: res.statusCode,
      duration,
      hasData: !!data,
      trustTokenValidated: req.trustTokenValidated || false,
    });
    return originalJson.call(this, data);
  };

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    backend: BACKEND_URL,
  });
});

// Status endpoint
app.get('/api/status', (req, res) => {
  const stats = cache.getStats();
  const trustTokenStats = getCacheStatsByTrustToken();
  res.json({
    status: 'operational',
    rateLimit: {
      requests: RATE_LIMIT_REQUESTS,
      windowMs: RATE_LIMIT_WINDOW,
    },
    cache: {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      trustTokenBreakdown: trustTokenStats,
    },
    backend: BACKEND_URL,
  });
});

// Cache invalidation endpoint (admin use)
app.post('/api/cache/invalidate-trust-token', (req, res) => {
  try {
    const { trustToken } = req.body;

    if (!trustToken) {
      return res.status(400).json({
        error: 'Missing trust token',
        message: 'trustToken field is required in request body',
      });
    }

    // Validate the token format
    const validation = validateTrustToken(trustToken);
    const clearedCount = invalidateCacheByTrustToken(trustToken, validation);

    res.json({
      success: true,
      message: `Cache invalidation completed for trust token`,
      tokenFormat: validation.format,
      tokenValid: validation.valid,
      entriesCleared: clearedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Cache invalidation error', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Cache invalidation failed',
      message: error.message,
    });
  }
});

// Main proxy endpoint for PDF processing
app.post('/api/process-pdf', async (req, res) => {
  try {
    const requestId = Math.random().toString(36).substring(7);

    // Create cache key from request including trust token for proper isolation
    const trustTokenKey = generateTrustTokenCacheKey(req.trustToken, req.trustTokenValidation);
    const cacheKey = JSON.stringify({
      method: 'POST',
      path: '/api/process-pdf',
      body: req.body,
      trustToken: trustTokenKey, // Include trust token component for cache isolation
    });

    // Check cache first
    const cachedResponse = cache.get(cacheKey);
    if (cachedResponse) {
      // Cache hit - verify trust token before serving cached content
      logger.info('Cache hit - verifying trust token', { requestId });

      try {
        // Perform trust token validation with backend
        const validationResult = await performBackendValidation(req.trustToken);

        if (!validationResult.isValid) {
          // Trust token is invalid - invalidate all cache entries for this token and proxy to backend
          logger.warn(
            'Invalid trust token for cached content - invalidating all related cache entries',
            {
              requestId,
              cacheKey: cacheKey.substring(0, 16) + '...',
              validationError: validationResult.error,
              validationType: validationResult.validationType,
            },
          );
          const clearedCount = invalidateCacheByTrustToken(
            req.trustToken,
            req.trustTokenValidation,
          );
          logger.info('Cache invalidation completed for invalid token', {
            requestId,
            entriesCleared: clearedCount,
            tokenFormat: req.trustTokenValidation.format,
          });
          // Continue to backend proxy for fresh content
        } else {
          // Trust token is valid - serve cached content
          logger.info('Trust token verified - serving cached content', {
            requestId,
            cacheKey: cacheKey.substring(0, 16) + '...',
            validationType: validationResult.validationType,
          });

          // Mark request as validated for logging
          req.trustTokenValidated = true;

          return res.json(cachedResponse);
        }
      } catch (validationError) {
        // Validation service error - log and invalidate all cache entries for this token for security
        logger.error(
          'Trust token validation service error - invalidating all related cache entries',
          {
            requestId,
            error: validationError.message,
            cacheKey: cacheKey.substring(0, 16) + '...',
          },
        );

        // Remove all cached content for this token when validation service is unavailable
        const clearedCount = invalidateCacheByTrustToken(req.trustToken, req.trustTokenValidation);
        logger.info('Cache invalidation completed due to validation service error', {
          requestId,
          entriesCleared: clearedCount,
          tokenFormat: req.trustTokenValidation.format,
        });

        // Continue to backend proxy for fresh content
      }
    }

    // Proxy to backend
    logger.info('Proxying to backend', { requestId, backend: BACKEND_URL });

    const response = await axios.post(`${BACKEND_URL}/api/process-pdf`, req.body, {
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Request-ID': requestId,
      },
    });

    // Cache successful responses
    if (response.status === 200) {
      cache.set(cacheKey, response.data);
    }

    logger.info('Backend response received', {
      requestId,
      status: response.status,
      hasData: !!response.data,
    });

    res.json(response.data);
  } catch (error) {
    logger.error('Backend request failed', {
      error: error.message,
      status: error.response?.status,
      backend: BACKEND_URL,
    });

    if (error.response) {
      // Backend returned error
      res.status(error.response.status).json(error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      // Backend unavailable
      res.status(503).json({
        error: 'Backend service unavailable',
        retryAfter: 60,
      });
    } else {
      // Other error
      res.status(500).json({
        error: 'Internal proxy error',
        requestId: Math.random().toString(36).substring(7),
      });
    }
  }
});

// Generic proxy for other endpoints (optional)
app.all('/api/*', async (req, res) => {
  try {
    const url = `${BACKEND_URL}${req.path}`;
    const config = {
      method: req.method,
      url,
      data: req.body,
      headers: {
        ...req.headers,
        'X-Forwarded-For': req.ip,
      },
      timeout: 30000,
    };

    // Remove hop-by-hop headers
    delete config.headers['host'];
    delete config.headers['connection'];

    const response = await axios(config);
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('Generic proxy error', {
      path: req.path,
      method: req.method,
      error: error.message,
    });

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Proxy error' });
    }
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: 'Internal server error',
    requestId: Math.random().toString(36).substring(7),
  });
});

// Start server only if not in test environment
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info('Proxy service started', {
      port: PORT,
      backend: BACKEND_URL,
      rateLimit: `${RATE_LIMIT_REQUESTS} requests per ${RATE_LIMIT_WINDOW / 1000} seconds`,
    });
  });
}

// Export functions for testing
module.exports = {
  app,
  validateTrustToken,
  getTokenFormat,
  extractTrustToken,
  generateTrustTokenCacheKey,
  invalidateCacheByTrustToken,
  getCacheStatsByTrustToken,
  performBackendValidation,
  validateTrustTokenWithBackend,
  // Export cache instances for testing
  cache,
  validationCache,
  // Test helper to clear caches
  clearCaches: () => {
    cache.flushAll();
    validationCache.flushAll();
  },
};
