const sqlite3 = require('sqlite3').verbose();
const path = require('node:path');

/**
 * JobResult model represents cached job results for faster retrieval.
 * Provides temporary storage with automatic cleanup for completed job outputs.
 */
class JobResult {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.jobId = data.jobId;
    this.result = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.expiresAt = data.expiresAt || this.calculateExpiry();
    this.size = data.size === undefined ? this.calculateSize() : data.size;
    this.dbPath = data.dbPath || path.join(__dirname, '../../data/job-status.db');
  }

  /**
   * Initializes the database and creates the job_results table if it doesn't exist
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          this.db.run(
            `
              CREATE TABLE IF NOT EXISTS job_results (
                id TEXT PRIMARY KEY,
                jobId TEXT NOT NULL UNIQUE,
                result TEXT NOT NULL,
                createdAt TEXT NOT NULL,
                expiresAt TEXT NOT NULL,
                size INTEGER NOT NULL
              )
           `,
            (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            },
          );
        }
      });
    });
  }

  /**
   * Saves the job result to the database
   */
  async save() {
    await this.initialize();
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO job_results (id, jobId, result, createdAt, expiresAt, size)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      const db = this.db;
      db.run(
        sql,
        [
          this.id,
          this.jobId,
          JSON.stringify(this.result),
          this.createdAt,
          this.expiresAt,
          this.size,
        ],
        function (err) {
          // Close DB handle after operation
          db.close(() => {
            if (err) {
              reject(err);
            } else {
              resolve(this.lastID);
            }
          });
        },
      );
    });
  }

  /**
   * Loads a job result from the database by jobId
   * @param {string} jobId - The job ID
   * @returns {JobResult|null} - The job result or null if not found
   */
  static async load(jobId, dbPath) {
    const instance = new JobResult({ dbPath });
    await instance.initialize();
    return new Promise((resolve, reject) => {
      const db = instance.db;
      db.get('SELECT * FROM job_results WHERE jobId = ?', [jobId], (err, row) => {
        db.close(() => {
          if (err) {
            reject(err);
          } else if (row) {
            resolve(new JobResult(row));
          } else {
            resolve(null);
          }
        });
      });
    });
  }

  /**
   * Deletes expired results from the database
   * @returns {number} - Number of deleted records
   */
  static async cleanupExpired(dbPath) {
    const instance = new JobResult({ dbPath });
    await instance.initialize();
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      const db = instance.db;
      db.run('DELETE FROM job_results WHERE expiresAt < ?', [now], function (err) {
        db.close(() => {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        });
      });
    });
  }

  /**
   * Generates a unique ID for the job result entry
   * @returns {string} - Unique ID
   */
  generateId() {
    return `jr_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Calculates result expiration time (7 days from creation by default)
   * @returns {string} - ISO timestamp for expiration
   */
  calculateExpiry() {
    const expiryTime = new Date(this.createdAt);
    expiryTime.setDate(expiryTime.getDate() + 7); // 7 days expiry
    return expiryTime.toISOString();
  }

  /**
   * Calculates the size of the result in bytes
   * @returns {number} - Size in bytes
   */
  calculateSize() {
    try {
      const str = JSON.stringify(this.result);
      return str ? str.length : 0;
    } catch (error) {
      // If JSON.stringify fails (circular references, etc.), return 0
      return 0;
    }
  }

  /**
   * Checks if the result has expired
   * @returns {boolean} - True if expired
   */
  isExpired() {
    return new Date() > new Date(this.expiresAt);
  }

  /**
   * Converts to plain object for storage/serialization
   * @returns {Object} - Plain object representation
   */
  toObject() {
    return {
      id: this.id,
      jobId: this.jobId,
      result: this.result,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
      size: this.size,
    };
  }

  /**
   * Creates JobResult from plain object
   * @param {Object} obj - Plain object
   * @returns {JobResult} - JobResult instance
   */
  static fromObject(obj) {
    return new JobResult(obj);
  }
}

module.exports = JobResult;
