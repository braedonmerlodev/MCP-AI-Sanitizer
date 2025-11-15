const sqlite3 = require('sqlite3').verbose();
const path = require('node:path');

/**
 * JobStatus model represents the status of jobs in the queue.
 * Provides tracking for job lifecycle with SQLite persistence.
 */
class JobStatus {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.jobId = data.jobId;
    this.status = data.status || 'queued'; // queued, processing, completed, failed
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.retryCount = data.retryCount || 0;
    this.errorMessage = data.errorMessage;
    this.dbPath = data.dbPath || path.join(__dirname, '../../data/job-status.db');
  }

  /**
   * Initializes the database and creates the job_status table if it doesn't exist
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          this.db.run(
            `
            CREATE TABLE IF NOT EXISTS job_status (
              id TEXT PRIMARY KEY,
              jobId TEXT NOT NULL,
              status TEXT NOT NULL,
              createdAt TEXT NOT NULL,
              updatedAt TEXT NOT NULL,
              retryCount INTEGER DEFAULT 0,
              errorMessage TEXT
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
   * Saves the job status to the database
   */
  async save() {
    await this.initialize();
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO job_status (id, jobId, status, createdAt, updatedAt, retryCount, errorMessage)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      this.db.run(
        sql,
        [
          this.id,
          this.jobId,
          this.status,
          this.createdAt,
          this.updatedAt,
          this.retryCount,
          this.errorMessage,
        ],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        },
      );
    });
  }

  /**
   * Loads a job status from the database by jobId
   * @param {string} jobId - The job ID
   * @returns {JobStatus|null} - The job status or null if not found
   */
  static async load(jobId, dbPath) {
    const instance = new JobStatus({ dbPath });
    await instance.initialize();
    return new Promise((resolve, reject) => {
      instance.db.get('SELECT * FROM job_status WHERE jobId = ?', [jobId], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve(new JobStatus(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Generates a unique ID for the job status entry
   * @returns {string} - Unique ID
   */
  generateId() {
    return `js_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Updates the status and updatedAt, then saves to database
   * @param {string} status - New status
   * @param {string} errorMessage - Error message if failed
   */
  async updateStatus(status, errorMessage = null) {
    this.status = status;
    this.updatedAt = new Date().toISOString();
    if (errorMessage) {
      this.errorMessage = errorMessage;
    }
    await this.save();
  }

  /**
   * Increments retry count and saves
   */
  async incrementRetry() {
    this.retryCount++;
    this.updatedAt = new Date().toISOString();
    await this.save();
  }

  /**
   * Converts to plain object for storage/serialization
   * @returns {Object} - Plain object representation
   */
  toObject() {
    return {
      id: this.id,
      jobId: this.jobId,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      retryCount: this.retryCount,
      errorMessage: this.errorMessage,
    };
  }

  /**
   * Creates JobStatus from plain object
   * @param {Object} obj - Plain object
   * @returns {JobStatus} - JobStatus instance
   */
  static fromObject(obj) {
    return new JobStatus(obj);
  }
}

module.exports = JobStatus;
