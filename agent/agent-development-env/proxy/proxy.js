const express = require('express');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const winston = require('winston');
const cookieParser = require('cookie-parser');

// Export functions for testing
module.exports = {
  validateTrustToken,
  getTokenFormat,
  extractTrustToken,
};

const app = express();

// Environment variables with defaults
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const PORT = process.env.PROXY_PORT || 3001;
const RATE_LIMIT_REQUESTS = parseInt(process.env.RATE_LIMIT_REQUESTS) || 100;
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 3600000; // 1 hour
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 3600000; // 1 hour
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Initialize cache
const cache = new NodeCache({ stdTTL: CACHE_TTL / 1000 });

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
        atob(token.replace(/-/g, '+').replace(/_/g, '/'));
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
    trustToken = req.get('X-Trust-Token');
  }

  // Check trust_token cookie
  if (!trustToken && req.cookies) {
    trustToken = req.cookies.trust_token;
  }

  // Check custom headers (coordinate with security team)
  if (!trustToken) {
    trustToken = req.get('X-Security-Token') || req.get('X-Auth-Token');
  }

  // Validate the extracted token
  const validation = validateTrustToken(trustToken);

  // Store extracted token and validation on request object
  req.trustToken = trustToken;
  req.trustTokenValidation = validation;
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
  } else if (!validation.valid) {
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
      validationFailureReason: validation.reason,
      severity: 'high',
      action: 'logged_and_continued',
      recommendation: 'review_token_format_requirements',
    });

    // For security-critical endpoints, we might want to add additional handling
    // For now, we log extensively and continue to maintain backward compatibility
  } else {
    // Valid token - success audit logging
    logger.info('TRUST_TOKEN_VALID', {
      eventType: 'trust_token_validation',
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      timestamp: new Date().toISOString(),
      tokenFormat: validation.format,
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
    },
    backend: BACKEND_URL,
  });
});

// Main proxy endpoint for PDF processing
app.post('/api/process-pdf', async (req, res) => {
  try {
    const requestId = Math.random().toString(36).substring(7);

    // Create cache key from request (excluding timestamps)
    const cacheKey = JSON.stringify({
      method: 'POST',
      path: '/api/process-pdf',
      body: req.body,
    });

    // Check cache first
    const cachedResponse = cache.get(cacheKey);
    if (cachedResponse) {
      logger.info('Cache hit', { requestId });
      return res.json(cachedResponse);
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

// Start server
app.listen(PORT, () => {
  logger.info('Proxy service started', {
    port: PORT,
    backend: BACKEND_URL,
    rateLimit: `${RATE_LIMIT_REQUESTS} requests per ${RATE_LIMIT_WINDOW / 1000} seconds`,
  });
});

module.exports = app;
