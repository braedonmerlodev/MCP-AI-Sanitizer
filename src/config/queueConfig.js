/**
 * Configuration for job queue using better-queue with promise mode.
 */
const queueConfig = {
  // Enable promise mode for better async handling
  promise: true,
  // Retry logic for failed jobs
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
};

module.exports = queueConfig;
