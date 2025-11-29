require('dotenv').config();

const express = require('express');
// const winston = require('winston');
const apiRoutes = require('./routes/api');
// const jobStatusRoutes = require('./routes/jobStatus');
const responseValidationMiddleware = require('./middleware/response-validation');
const apiContractValidationMiddleware = require('./middleware/ApiContractValidationMiddleware');
const { requestSchemas, responseSchemas } = require('./schemas/api-contract-schemas');
const { recordRequest } = require('./utils/monitoring');

// Initialize logger - temporarily disabled
// const logger = winston.createLogger({
//   level: 'info',
//   format: winston.format.json(),
//   transports: [new winston.transports.Console()],
// });

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Monitoring middleware for performance and request tracking
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    recordRequest(req.method, req.originalUrl, duration);
  });
  next();
});

// Response validation middleware (non-blocking)
app.use(responseValidationMiddleware);

// Routes
app.use('/api', apiRoutes);
// app.use('/api/jobs', jobStatusRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Obfuscation-Aware Sanitizer API',
    version: '1.0.0',
    endpoints: {
      'POST /api/sanitize/json': 'Sanitize input data with trust tokens',
      'POST /api/webhook/n8n': 'Handle n8n webhook with sanitization',
      'POST /api/documents/upload': 'Upload PDF documents for processing',
    },
  });
});

// Health check
app.get(
  '/health',
  apiContractValidationMiddleware(requestSchemas['/health'], responseSchemas['/health']),
  (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  },
);

// Error handling
app.use((err, req, res) => {
  console.error('Application error:', err.message);
  // recordError(); // Disabled

  // Safe error response handling
  try {
    if (
      res &&
      typeof res.status === 'function' &&
      typeof res.json === 'function' &&
      !res.headersSent
    ) {
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      console.error('Cannot send error response - response object invalid');
    }
  } catch (responseError) {
    console.error('Failed to send error response', responseError);
  }
});

// Start server (don't auto-listen during tests)
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
