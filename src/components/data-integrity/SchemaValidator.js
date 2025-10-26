/**
 * SchemaValidator handles type/format checking and validation rules for data integrity.
 * Uses Joi for schema validation with custom rules for common data types.
 */
const Joi = require('joi');
class SchemaValidator {
  constructor() {
    // Define common validation schemas
    this.schemas = {
      // Basic data types with strict validation
      string: Joi.string().trim(),
      number: Joi.number(),
      integer: Joi.number().integer(),
      boolean: Joi.boolean(),
      date: Joi.date().iso(), // ISO 8601 format
      email: Joi.string().email(),
      url: Joi.string().uri(),

      // Custom schemas for specific use cases
      price: Joi.number().positive(), // Currency
      percentage: Joi.number().min(0).max(100),
      uuid: Joi.string().uuid(),
      phone: Joi.string().pattern(/^\+?[\d\s\-()]+$/),
    };
  }

  /**
   * Validates data against a provided schema
   * @param {any} data - Data to validate
   * @param {string|Object} schema - Schema name or Joi schema object
   * @returns {Object} - Validation result { isValid: boolean, errors: Array, details: Object }
   */
  validate(data, schema) {
    try {
      let joiSchema;

      if (!schema) {
        // Default schema: allow any data type
        joiSchema = Joi.any();
      } else if (typeof schema === 'string') {
        joiSchema = this.schemas[schema];
        if (!joiSchema) {
          return {
            isValid: false,
            errors: [`Unknown schema: ${schema}`],
            details: { schema, data },
          };
        }
      } else if (Joi.isSchema(schema)) {
        joiSchema = schema;
      } else {
        return {
          isValid: false,
          errors: ['Invalid schema format'],
          details: { schema, data },
        };
      }

      const result = joiSchema.validate(data, { abortEarly: false });

      if (result.error) {
        return {
          isValid: false,
          errors: result.error.details.map((detail) => detail.message),
          details: {
            schema: typeof schema === 'string' ? schema : 'custom',
            data,
            path: result.error.details[0]?.path,
          },
        };
      }

      return {
        isValid: true,
        errors: [],
        details: {
          schema: typeof schema === 'string' ? schema : 'custom',
          data: result.value,
        },
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        details: { schema, data, error: error.message },
      };
    }
  }

  /**
   * Validates multiple fields in an object
   * @param {Object} data - Object with multiple fields to validate
   * @param {Object} fieldSchemas - Map of field names to schema names/objects
   * @returns {Object} - Validation result for all fields
   */
  validateObject(data, fieldSchemas) {
    const results = {};
    let allValid = true;

    for (const [field, schema] of Object.entries(fieldSchemas)) {
      const result = this.validate(data[field], schema);
      results[field] = result;
      if (!result.isValid) {
        allValid = false;
      }
    }

    return {
      isValid: allValid,
      fieldResults: results,
      summary: {
        totalFields: Object.keys(fieldSchemas).length,
        validFields: Object.values(results).filter((r) => r.isValid).length,
        invalidFields: Object.values(results).filter((r) => !r.isValid).length,
      },
    };
  }

  /**
   * Adds a custom schema for reuse
   * @param {string} name - Schema name
   * @param {Object} schema - Joi schema object
   */
  addSchema(name, schema) {
    if (!Joi.isSchema(schema)) {
      throw new Error('Schema must be a Joi schema object');
    }
    this.schemas[name] = schema;
  }

  /**
   * Gets a schema by name
   * @param {string} name - Schema name
   * @returns {Object} - Joi schema object
   */
  getSchema(name) {
    return this.schemas[name];
  }
}

module.exports = SchemaValidator;
