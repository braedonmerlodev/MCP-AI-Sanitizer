const winston = require('winston');

// Monitoring metrics storage (in-memory for simplicity; in production, use Redis or DB)
let metrics = {
  uptime: process.uptime(),
  startTime: Date.now(),
  requests: {
    total: 0,
    byMethod: {},
    byEndpoint: {},
  },
  performance: {
    responseTimes: [],
    avgResponseTime: 0,
  },
  security: {
    failedValidations: 0,
    authFailures: 0,
    suspiciousRequests: 0,
  },
  stability: {
    errors: 0,
    errorRate: 0,
  },
};

// Update uptime
setInterval(() => {
  metrics.uptime = process.uptime();
}, 60000); // Update every minute

// Functions to update metrics
const recordRequest = (method, endpoint, responseTime) => {
  metrics.requests.total++;
  metrics.requests.byMethod[method] = (metrics.requests.byMethod[method] || 0) + 1;
  metrics.requests.byEndpoint[endpoint] = (metrics.requests.byEndpoint[endpoint] || 0) + 1;

  metrics.performance.responseTimes.push(responseTime);
  if (metrics.performance.responseTimes.length > 1000) {
    metrics.performance.responseTimes.shift(); // Keep last 1000
  }
  metrics.performance.avgResponseTime =
    metrics.performance.responseTimes.reduce((a, b) => a + b, 0) /
    metrics.performance.responseTimes.length;
};

const recordSecurityEvent = (type) => {
  if (type === 'failedValidation') metrics.security.failedValidations++;
  if (type === 'authFailure') metrics.security.authFailures++;
  if (type === 'suspiciousRequest') metrics.security.suspiciousRequests++;
};

const recordError = () => {
  metrics.stability.errors++;
  metrics.stability.errorRate =
    metrics.requests.total > 0
      ? metrics.stability.errors / metrics.requests.total
      : metrics.stability.errors > 0
        ? 1
        : 0;
};

const getMetrics = () => {
  return { ...metrics };
};

const resetMetrics = () => {
  metrics = {
    uptime: process.uptime(),
    startTime: Date.now(),
    requests: { total: 0, byMethod: {}, byEndpoint: {} },
    performance: { responseTimes: [], avgResponseTime: 0 },
    security: { failedValidations: 0, authFailures: 0, suspiciousRequests: 0 },
    stability: { errors: 0, errorRate: 0 },
  };
};

module.exports = {
  recordRequest,
  recordSecurityEvent,
  recordError,
  getMetrics,
  resetMetrics,
};
