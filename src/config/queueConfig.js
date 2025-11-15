const path = require('node:path');

/**
 * Configuration for job queue using better-queue with SQLite persistence.
 */
const queueConfig = {
  store: {
    type: 'sql',
    dialect: 'sqlite',
    path: path.join(__dirname, '../../data/queue.db'), // SQLite database file for queue persistence
  },
  // Retry logic for failed jobs
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
};

module.exports = queueConfig;
