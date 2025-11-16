/**
 * Configuration for job queue using better-queue with in-memory storage.
 */
const queueConfig = {
  // Retry logic for failed jobs
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
};

module.exports = queueConfig;
