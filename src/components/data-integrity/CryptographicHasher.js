const crypto = require('crypto');

/**
 * CryptographicHasher manages hash generation and verification for data lineage tracking.
 * Provides SHA-256 hashing with salt support for data integrity.
 */
class CryptographicHasher {
  constructor() {
    this.algorithm = 'sha256';
    this.encoding = 'hex';
  }

  /**
   * Generates a hash for the provided data
   * @param {string|Buffer} data - Data to hash
   * @param {string} salt - Optional salt for additional security
   * @returns {string} - Hex-encoded hash
   */
  generateHash(data, salt = '') {
    try {
      const hash = crypto.createHash(this.algorithm);
      hash.update(data + salt);
      return hash.digest(this.encoding);
    } catch (error) {
      throw new Error(`Hash generation failed: ${error.message}`);
    }
  }

  /**
   * Verifies a hash against data
   * @param {string|Buffer} data - Original data
   * @param {string} expectedHash - Expected hash value
   * @param {string} salt - Optional salt used during hashing
   * @returns {boolean} - Whether the hash matches
   */
  verifyHash(data, expectedHash, salt = '') {
    try {
      const computedHash = this.generateHash(data, salt);
      return crypto.timingSafeEqual(
        Buffer.from(computedHash, this.encoding),
        Buffer.from(expectedHash, this.encoding),
      );
    } catch (error) {
      // If timingSafeEqual fails (different lengths), return false
      return false;
    }
  }

  /**
   * Generates hash references for data lineage tracking
   * @param {Object} data - Data object to hash
   * @returns {Object} - Hash references { dataHash, metadataHash, combinedHash }
   */
  generateDataHashes(data) {
    try {
      // Hash the main data content
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      const dataHash = this.generateHash(dataString);

      // Hash metadata (timestamps, etc.) separately if present
      let metadataHash = null;
      if (data.timestamp || data.createdAt || data.updatedAt) {
        const metadata = {
          timestamp: data.timestamp,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
        metadataHash = this.generateHash(JSON.stringify(metadata));
      }

      // Combined hash of data + metadata
      const combinedData = {
        data: dataString,
        metadata: metadataHash ? { hash: metadataHash } : null,
      };
      const combinedHash = this.generateHash(JSON.stringify(combinedData));

      return {
        dataHash,
        metadataHash,
        combinedHash,
        algorithm: this.algorithm,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Data hash generation failed: ${error.message}`);
    }
  }

  /**
   * Creates hash reference objects for storage
   * @param {string|Object} rawData - Original raw data
   * @param {string|Object} sanitizedData - Sanitized data
   * @param {Object} metadata - Additional metadata
   * @returns {Object} - Hash reference object
   */
  createHashReference(rawData, sanitizedData, metadata = {}) {
    const rawHashes = this.generateDataHashes(rawData);
    const sanitizedHashes = this.generateDataHashes(sanitizedData);

    return {
      id: this.generateHash(Date.now().toString() + Math.random().toString()),
      rawDataHash: rawHashes.dataHash,
      sanitizedDataHash: sanitizedHashes.dataHash,
      combinedHash: this.generateHash(rawHashes.dataHash + sanitizedHashes.dataHash),
      algorithm: this.algorithm,
      timestamp: new Date().toISOString(),
      metadata: {
        ...metadata,
        rawDataLength:
          typeof rawData === 'string' ? rawData.length : JSON.stringify(rawData).length,
        sanitizedDataLength:
          typeof sanitizedData === 'string'
            ? sanitizedData.length
            : JSON.stringify(sanitizedData).length,
      },
    };
  }

  /**
   * Verifies data lineage using hash references
   * @param {string|Object} currentData - Current data to verify
   * @param {Object} hashReference - Stored hash reference
   * @returns {Object} - Verification result
   */
  verifyDataLineage(currentData, hashReference) {
    try {
      // For lineage verification, we need to verify against the original data structure
      // The hashReference should contain hashes for the raw and sanitized data separately

      const dataString =
        typeof currentData === 'string' ? currentData : JSON.stringify(currentData);

      // Determine which hash to verify against based on what's available
      // If we have sanitizedDataHash, assume currentData is sanitized data
      // If we only have rawDataHash, assume currentData is raw data
      let dataMatches = false;
      if (hashReference.sanitizedDataHash) {
        dataMatches = this.verifyHash(dataString, hashReference.sanitizedDataHash);
      } else if (hashReference.rawDataHash) {
        dataMatches = this.verifyHash(dataString, hashReference.rawDataHash);
      } else {
        dataMatches = true; // No hashes to verify against
      }

      // Verify combined hash by reconstructing the same structure used during creation
      let combinedMatches = true;
      if (hashReference.combinedHash) {
        // The combined hash is hash(rawHash + sanitizedHash)
        const expectedCombined = this.generateHash(
          hashReference.rawDataHash + hashReference.sanitizedDataHash,
        );
        combinedMatches = expectedCombined === hashReference.combinedHash;
      }

      const isValid = dataMatches && combinedMatches;

      return {
        isValid,
        details: {
          dataMatches,
          combinedMatches,
          algorithm: hashReference.algorithm || this.algorithm,
        },
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Lineage verification failed: ${error.message}`,
        details: { hashReference },
      };
    }
  }

  /**
   * Generates a salt for enhanced security
   * @param {number} length - Salt length in bytes
   * @returns {string} - Hex-encoded salt
   */
  generateSalt(length = 16) {
    return crypto.randomBytes(length).toString(this.encoding);
  }

  /**
   * Changes the hashing algorithm
   * @param {string} algorithm - New algorithm (sha256, sha512, etc.)
   */
  setAlgorithm(algorithm) {
    if (!crypto.getHashes().includes(algorithm)) {
      throw new Error(`Unsupported hash algorithm: ${algorithm}`);
    }
    this.algorithm = algorithm;
  }
}

module.exports = CryptographicHasher;
