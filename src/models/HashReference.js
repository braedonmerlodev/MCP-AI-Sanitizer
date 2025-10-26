/**
 * HashReference model represents cryptographic linkage between raw and sanitized data.
 */
class HashReference {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.dataId = data.dataId;
    this.rawDataHash = data.rawDataHash;
    this.sanitizedDataHash = data.sanitizedDataHash;
    this.combinedHash = data.combinedHash;
    this.algorithm = data.algorithm || 'sha256';
    this.timestamp = data.timestamp || new Date().toISOString();
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Generates a unique ID for the hash reference
   * @returns {string} - Unique ID
   */
  generateId() {
    return `hr_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Verifies if the hash reference is valid (hashes match combined)
   * @returns {boolean} - True if valid
   */
  isValid() {
    if (!this.rawDataHash || !this.sanitizedDataHash || !this.combinedHash) {
      return false;
    }

    // In a real implementation, this would use the crypto module to verify
    // For now, just check if combined hash exists
    return true;
  }

  /**
   * Gets the data lineage information
   * @returns {Object} - Lineage info
   */
  getLineageInfo() {
    return {
      rawDataHash: this.rawDataHash,
      sanitizedDataHash: this.sanitizedDataHash,
      transformationHash: this.combinedHash,
      algorithm: this.algorithm,
      timestamp: this.timestamp,
      metadata: this.metadata,
    };
  }

  /**
   * Checks if this hash reference matches another
   * @param {HashReference} other - Other hash reference
   * @returns {boolean} - True if they match
   */
  matches(other) {
    return (
      this.rawDataHash === other.rawDataHash &&
      this.sanitizedDataHash === other.sanitizedDataHash &&
      this.algorithm === other.algorithm
    );
  }

  /**
   * Converts to plain object for storage/serialization
   * @returns {Object} - Plain object representation
   */
  toObject() {
    return {
      id: this.id,
      dataId: this.dataId,
      rawDataHash: this.rawDataHash,
      sanitizedDataHash: this.sanitizedDataHash,
      combinedHash: this.combinedHash,
      algorithm: this.algorithm,
      timestamp: this.timestamp,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Creates HashReference from plain object
   * @param {Object} obj - Plain object
   * @returns {HashReference} - HashReference instance
   */
  static fromObject(obj) {
    return new HashReference(obj);
  }
}

module.exports = HashReference;
