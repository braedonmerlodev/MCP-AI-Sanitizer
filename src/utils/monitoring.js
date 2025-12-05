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
    p50: 0,
    p95: 0,
    p99: 0,
    slaCompliance: 100, // % under 200ms
  },
  tokenGeneration: {
    times: [],
    avgTime: 0,
    p50: 0,
    p95: 0,
    p99: 0,
    slaCompliance: 100,
  },
  security: {
    failedValidations: 0,
    authFailures: 0,
    suspiciousRequests: 0,
    aiInputSanitization: {
      totalProcessed: 0,
      sanitizationFailures: 0,
      validationFailures: 0,
      dangerousContentBlocked: 0,
    },
  },
  pipeline: {
    totalProcessed: 0,
    sanitizationTime: [],
    aiProcessingTime: [],
    totalPipelineTime: [],
    concurrencyMetrics: {
      activeJobs: 0,
      queueDepth: 0,
      throughput: 0,
    },
    performanceBreakdown: {
      sanitizationVsAI: {
        sanitizationPortion: 0,
        aiPortion: 0,
      },
    },
  },
  stability: {
    errors: 0,
    errorRate: 0,
  },
};

// Update uptime
setInterval(() => {
  metrics.uptime = process.uptime();
}, 60_000); // Update every minute

// Functions to update metrics
const recordRequest = (method, endpoint, responseTime) => {
  metrics.requests.total++;
  metrics.requests.byMethod[method] = (metrics.requests.byMethod[method] || 0) + 1;
  metrics.requests.byEndpoint[endpoint] = (metrics.requests.byEndpoint[endpoint] || 0) + 1;

  metrics.performance.responseTimes.push(responseTime);
  if (metrics.performance.responseTimes.length > 1000) {
    metrics.performance.responseTimes.shift(); // Keep last 1000
  }
  updatePerformanceMetrics();
};

const recordTokenGeneration = (generationTime) => {
  metrics.tokenGeneration.times.push(generationTime);
  if (metrics.tokenGeneration.times.length > 1000) {
    metrics.tokenGeneration.times.shift(); // Keep last 1000
  }
  updateTokenGenerationMetrics();
};

const updatePerformanceMetrics = () => {
  const times = metrics.performance.responseTimes;
  if (times.length === 0) return;

  metrics.performance.avgResponseTime = times.reduce((a, b) => a + b, 0) / times.length;
  metrics.performance.p50 = calculatePercentile(times, 50);
  metrics.performance.p95 = calculatePercentile(times, 95);
  metrics.performance.p99 = calculatePercentile(times, 99);
  metrics.performance.slaCompliance = calculateSLACompliance(times, 200);
};

const updateTokenGenerationMetrics = () => {
  const times = metrics.tokenGeneration.times;
  if (times.length === 0) return;

  metrics.tokenGeneration.avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  metrics.tokenGeneration.p50 = calculatePercentile(times, 50);
  metrics.tokenGeneration.p95 = calculatePercentile(times, 95);
  metrics.tokenGeneration.p99 = calculatePercentile(times, 99);
  metrics.tokenGeneration.slaCompliance = calculateSLACompliance(times, 200);
};

const calculatePercentile = (sorted, percentile) => {
  if (sorted.length === 0) return 0;
  if (percentile <= 0) return sorted[0];
  if (percentile >= 100) return sorted.at(-1);

  const sortedTimes = [...sorted].toSorted((a, b) => a - b);
  const index = (percentile / 100) * (sortedTimes.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  if (upper >= sortedTimes.length) return sortedTimes.at(-1);

  return sortedTimes[lower] * (1 - weight) + sortedTimes[upper] * weight;
};

const calculateSLACompliance = (times, targetMs = 200) => {
  const underTarget = times.filter((time) => time <= targetMs).length;
  return (underTarget / times.length) * 100;
};

const recordSecurityEvent = (type) => {
  if (type === 'failedValidation') metrics.security.failedValidations++;
  if (type === 'authFailure') metrics.security.authFailures++;
  if (type === 'suspiciousRequest') metrics.security.suspiciousRequests++;
};

const recordAIInputSanitization = (eventType, details = {}) => {
  metrics.security.aiInputSanitization.totalProcessed++;

  if (eventType === 'sanitizationFailure') {
    metrics.security.aiInputSanitization.sanitizationFailures++;
  } else if (eventType === 'validationFailure') {
    metrics.security.aiInputSanitization.validationFailures++;
  } else if (eventType === 'dangerousContentBlocked') {
    metrics.security.aiInputSanitization.dangerousContentBlocked++;
  }

  // Log the event for monitoring
  console.log(`AI Input Sanitization Event: ${eventType}`, {
    ...details,
    timestamp: new Date().toISOString(),
  });
};

const recordPipelinePerformance = (sanitizationTime, aiProcessingTime, totalTime, details = {}) => {
  metrics.pipeline.totalProcessed++;

  // Track timing metrics (keep last 1000 measurements)
  metrics.pipeline.sanitizationTime.push(sanitizationTime);
  metrics.pipeline.aiProcessingTime.push(aiProcessingTime);
  metrics.pipeline.totalPipelineTime.push(totalTime);

  // Maintain rolling window
  const maxMetrics = 1000;
  if (metrics.pipeline.sanitizationTime.length > maxMetrics) {
    metrics.pipeline.sanitizationTime.shift();
    metrics.pipeline.aiProcessingTime.shift();
    metrics.pipeline.totalPipelineTime.shift();
  }

  // Update performance breakdown
  const totalTimeSum = metrics.pipeline.totalPipelineTime.reduce((a, b) => a + b, 0);
  if (totalTimeSum > 0) {
    const sanitizationPortion =
      (metrics.pipeline.sanitizationTime.reduce((a, b) => a + b, 0) / totalTimeSum) * 100;
    const aiPortion =
      (metrics.pipeline.aiProcessingTime.reduce((a, b) => a + b, 0) / totalTimeSum) * 100;

    metrics.pipeline.performanceBreakdown.sanitizationVsAI.sanitizationPortion =
      sanitizationPortion;
    metrics.pipeline.performanceBreakdown.sanitizationVsAI.aiPortion = aiPortion;
  }

  // Log performance metrics
  console.log('Pipeline Performance Recorded', {
    sanitizationTime: `${sanitizationTime.toFixed(2)}ms`,
    aiProcessingTime: `${aiProcessingTime.toFixed(2)}ms`,
    totalTime: `${totalTime.toFixed(2)}ms`,
    efficiency:
      totalTime > 0
        ? (((sanitizationTime + aiProcessingTime) / totalTime) * 100).toFixed(1) + '%'
        : 'N/A',
    ...details,
    timestamp: new Date().toISOString(),
  });
};

const updateConcurrencyMetrics = (activeJobs, queueDepth) => {
  metrics.pipeline.concurrencyMetrics.activeJobs = activeJobs;
  metrics.pipeline.concurrencyMetrics.queueDepth = queueDepth;

  // Calculate throughput (operations per minute, based on recent activity)
  const recentProcessed = Math.min(metrics.pipeline.totalProcessed, 60); // Last minute approximation
  metrics.pipeline.concurrencyMetrics.throughput = recentProcessed;

  console.log('Concurrency Metrics Updated', {
    activeJobs,
    queueDepth,
    throughput: `${metrics.pipeline.concurrencyMetrics.throughput} ops/min`,
    timestamp: new Date().toISOString(),
  });
};

const recordError = () => {
  metrics.stability.errors++;
  metrics.stability.errorRate =
    metrics.requests.total > 0
      ? metrics.stability.errors / metrics.requests.total
      : metrics.stability.errors > 0
        ? 1
        : 0;

  // Check for rollback triggers
  checkRollbackTriggers();
};

const getMetrics = () => {
  return { ...metrics };
};

const checkRollbackTriggers = () => {
  const errorRateThreshold = 0.05; // 5%
  const latencyThreshold = 500; // 500ms

  if (metrics.stability.errorRate > errorRateThreshold) {
    console.error(
      `ROLLBACK TRIGGER: Error rate ${(metrics.stability.errorRate * 100).toFixed(2)}% exceeds threshold ${errorRateThreshold * 100}%`,
    );
  }

  if (metrics.performance.avgResponseTime > latencyThreshold) {
    console.error(
      `ROLLBACK TRIGGER: Average latency ${metrics.performance.avgResponseTime.toFixed(2)}ms exceeds threshold ${latencyThreshold}ms`,
    );
  }
};

const resetMetrics = () => {
  metrics = {
    uptime: process.uptime(),
    startTime: Date.now(),
    requests: { total: 0, byMethod: {}, byEndpoint: {} },
    performance: {
      responseTimes: [],
      avgResponseTime: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      slaCompliance: 100,
    },
    tokenGeneration: { times: [], avgTime: 0, p50: 0, p95: 0, p99: 0, slaCompliance: 100 },
    security: {
      failedValidations: 0,
      authFailures: 0,
      suspiciousRequests: 0,
      aiInputSanitization: {
        totalProcessed: 0,
        sanitizationFailures: 0,
        validationFailures: 0,
        dangerousContentBlocked: 0,
      },
    },
    pipeline: {
      totalProcessed: 0,
      sanitizationTime: [],
      aiProcessingTime: [],
      totalPipelineTime: [],
      concurrencyMetrics: {
        activeJobs: 0,
        queueDepth: 0,
        throughput: 0,
      },
      performanceBreakdown: {
        sanitizationVsAI: {
          sanitizationPortion: 0,
          aiPortion: 0,
        },
      },
    },
    stability: { errors: 0, errorRate: 0 },
  };
};

module.exports = {
  recordRequest,
  recordTokenGeneration,
  recordSecurityEvent,
  recordAIInputSanitization,
  recordPipelinePerformance,
  updateConcurrencyMetrics,
  recordError,
  getMetrics,
  resetMetrics,
};
