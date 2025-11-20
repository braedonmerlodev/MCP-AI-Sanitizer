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
    this.status = data.status || 'queued'; // queued, processing, completed, failed, cancelled
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.retryCount = data.retryCount || 0;
    this.errorMessage = data.errorMessage;
    this.result = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
    this.progress = data.progress || 0; // 0-100 percentage
    this.currentStep = data.currentStep || null; // current processing step
    this.totalSteps = data.totalSteps || null; // total steps for progress calculation
    this.expiresAt = data.expiresAt || this.calculateExpiry(); // job expiration time
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
                errorMessage TEXT,
                result TEXT,
                progress INTEGER DEFAULT 0,
                currentStep TEXT,
                totalSteps INTEGER,
                expiresAt TEXT
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
        INSERT OR REPLACE INTO job_status (id, jobId, status, createdAt, updatedAt, retryCount, errorMessage, result, progress, currentStep, totalSteps, expiresAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const db = this.db;
      db.run(
        sql,
        [
          this.id,
          this.jobId,
          this.status,
          this.createdAt,
          this.updatedAt,
          this.retryCount,
          this.errorMessage,
          this.result ? JSON.stringify(this.result) : null,
          this.progress,
          this.currentStep,
          this.totalSteps,
          this.expiresAt,
        ],
        function (err) {
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
   * Loads a job status from the database by jobId
   * @param {string} jobId - The job ID
   * @returns {JobStatus|null} - The job status or null if not found
   */
  static async load(jobId, dbPath) {
    const instance = new JobStatus({ dbPath });
    await instance.initialize();
    return new Promise((resolve, reject) => {
      const db = instance.db;
      db.get('SELECT * FROM job_status WHERE jobId = ?', [jobId], (err, row) => {
        db.close(() => {
          if (err) {
            reject(err);
          } else if (row) {
            resolve(new JobStatus(row));
          } else {
            resolve(null);
          }
        });
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
   * Calculates job expiration time (24 hours from creation by default)
   * @returns {string} - ISO timestamp for expiration
   */
  calculateExpiry() {
    const expiryTime = new Date(this.createdAt);
    expiryTime.setHours(expiryTime.getHours() + 24); // 24 hours expiry
    return expiryTime.toISOString();
  }

  /**
   * Updates the status and updatedAt, then saves to database
   * @param {string} status - New status
   * @param {string} errorMessage - Error message if failed
   * @param {Object} result - Result data if completed
   */
  async updateStatus(status, errorMessage = null, result = null) {
    this.status = status;
    this.updatedAt = new Date().toISOString();
    if (errorMessage) {
      this.errorMessage = errorMessage;
    }
    if (result) {
      this.result = result;
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
   * Updates progress and current step
   * @param {number} progress - Progress percentage (0-100)
   * @param {string} currentStep - Current processing step
   * @param {number} totalSteps - Total number of steps
   */
  async updateProgress(progress, currentStep = null, totalSteps = null) {
    this.progress = Math.min(100, Math.max(0, progress));
    if (currentStep) this.currentStep = currentStep;
    if (totalSteps) this.totalSteps = totalSteps;
    this.updatedAt = new Date().toISOString();
    await this.save();
  }

  /**
   * Checks if the job has expired
   * @returns {boolean} - True if expired
   */
  isExpired() {
    return new Date() > new Date(this.expiresAt);
  }

  /**
   * Cancels the job if it's in a cancellable state
   */
  async cancel() {
    if (this.status === 'queued' || this.status === 'processing') {
      this.status = 'cancelled';
      this.updatedAt = new Date().toISOString();
      await this.save();
    }
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
      result: this.result,
      progress: this.progress,
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      expiresAt: this.expiresAt,
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
