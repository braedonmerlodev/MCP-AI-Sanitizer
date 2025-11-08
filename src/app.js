require('dotenv').config();
const express = require('express');
const winston = require('winston');
const apiRoutes = require('./routes/api');
const responseValidationMiddleware = require('./middleware/response-validation');
const apiContractValidationMiddleware = require('./middleware/ApiContractValidationMiddleware');
const { requestSchemas, responseSchemas } = require('./schemas/api-contract-schemas');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Response validation middleware (non-blocking)
app.use(responseValidationMiddleware);

// Routes
app.use('/api', apiRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Obfuscation-Aware Sanitizer API',
    version: '1.0.0',
    endpoints: {
      'POST /api/sanitize': 'Sanitize input data',
      'POST /api/webhook/n8n': 'Handle n8n webhook with sanitization',
      'POST /api/documents/upload': 'Upload PDF documents for processing',
      'GET /health': 'Health check',
    },
    documentation: 'See README.md for usage details',
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
  logger.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
