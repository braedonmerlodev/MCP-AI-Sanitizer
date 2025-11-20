const {
  normalizeKeys,
  removeFields,
  coerceTypes,
  applyPreset,
  validatePreset,
  TRANSFORMATION_PRESETS,
  createChain,
} = require('../../utils/jsonTransformer');

describe('JSON Transformer', () => {
  describe('normalizeKeys', () => {
    it('should convert snake_case to camelCase', () => {
      const input = {
        user_name: 'john',
        user_age: 30,
        user_details: {
          first_name: 'John',
          last_name: 'Doe',
        },
      };
      const expected = {
        userName: 'john',
        userAge: 30,
        userDetails: {
          firstName: 'John',
          lastName: 'Doe',
        },
      };
      expect(normalizeKeys(input, 'camelCase')).toEqual(expected);
    });

    it('should convert camelCase to snake_case', () => {
      const input = {
        userName: 'john',
        userAge: 30,
        userDetails: {
          firstName: 'John',
          lastName: 'Doe',
        },
      };
      const expected = {
        user_name: 'john',
        user_age: 30,
        user_details: {
          first_name: 'John',
          last_name: 'Doe',
        },
      };
      expect(normalizeKeys(input, 'snake_case')).toEqual(expected);
    });

    it('should convert kebab-case to camelCase', () => {
      const input = {
        'user-name': 'john',
        'user-age': 30,
        'user-details': {
          'first-name': 'John',
          'last-name': 'Doe',
        },
      };
      const expected = {
        userName: 'john',
        userAge: 30,
        userDetails: {
          firstName: 'John',
          lastName: 'Doe',
        },
      };
      expect(normalizeKeys(input, 'camelCase')).toEqual(expected);
    });

    it('should convert camelCase to kebab-case', () => {
      const input = {
        userName: 'john',
        userAge: 30,
        userDetails: {
          firstName: 'John',
          lastName: 'Doe',
        },
      };
      const expected = {
        'user-name': 'john',
        'user-age': 30,
        'user-details': {
          'first-name': 'John',
          'last-name': 'Doe',
        },
      };
      expect(normalizeKeys(input, 'kebab-case')).toEqual(expected);
    });

    it('should convert snake_case to kebab-case', () => {
      const input = {
        user_name: 'john',
        user_age: 30,
      };
      const expected = {
        'user-name': 'john',
        'user-age': 30,
      };
      expect(normalizeKeys(input, 'kebab-case')).toEqual(expected);
    });

    it('should convert camelCase to PascalCase', () => {
      const input = {
        userName: 'john',
        userAge: 30,
        userDetails: {
          firstName: 'John',
          lastName: 'Doe',
        },
      };
      const expected = {
        UserName: 'john',
        UserAge: 30,
        UserDetails: {
          FirstName: 'John',
          LastName: 'Doe',
        },
      };
      expect(normalizeKeys(input, 'PascalCase')).toEqual(expected);
    });

    it('should convert snake_case to PascalCase', () => {
      const input = {
        user_name: 'john',
        user_age: 30,
      };
      const expected = {
        UserName: 'john',
        UserAge: 30,
      };
      expect(normalizeKeys(input, 'PascalCase')).toEqual(expected);
    });

    it('should support custom delimiters', () => {
      const input = {
        userName: 'john',
        userAge: 30,
      };
      const expected = {
        'user*name': 'john',
        'user*age': 30,
      };
      expect(normalizeKeys(input, { delimiter: '*' })).toEqual(expected);
    });

    it('should handle arrays', () => {
      const input = [{ user_name: 'john' }, { user_name: 'jane' }];
      const expected = [{ userName: 'john' }, { userName: 'jane' }];
      expect(normalizeKeys(input, 'camelCase')).toEqual(expected);
    });

    it('should handle primitives', () => {
      expect(normalizeKeys('string', 'camelCase')).toBe('string');
      expect(normalizeKeys(123, 'camelCase')).toBe(123);
      expect(normalizeKeys(null, 'camelCase')).toBe(null);
    });

    it('should support caching for performance', () => {
      const input = { user_name: 'john', user_age: 30 };
      const options = { useCache: true };

      // First call should cache the result
      const result1 = normalizeKeys(input, 'camelCase', options);
      // Second call should use cached result
      const result2 = normalizeKeys(input, 'camelCase', options);

      expect(result1).toEqual(result2);
      expect(result1).toEqual({ userName: 'john', userAge: 30 });
    });
  });

  describe('removeFields', () => {
    it('should remove specified fields', () => {
      const input = {
        name: 'john',
        password: 'secret',
        age: 30,
        details: {
          email: 'john@example.com',
          password: 'secret',
        },
      };
      const expected = {
        name: 'john',
        age: 30,
        details: {
          email: 'john@example.com',
        },
      };
      expect(removeFields(input, ['password'])).toEqual(expected);
    });

    it('should handle arrays', () => {
      const input = [
        { name: 'john', password: 'secret' },
        { name: 'jane', password: 'secret' },
      ];
      const expected = [{ name: 'john' }, { name: 'jane' }];
      expect(removeFields(input, ['password'])).toEqual(expected);
    });

    it('should handle primitives', () => {
      expect(removeFields('string', ['field'])).toBe('string');
      expect(removeFields(123, ['field'])).toBe(123);
      expect(removeFields(null, ['field'])).toBe(null);
    });

    it('should remove multiple fields', () => {
      const input = {
        name: 'john',
        password: 'secret',
        token: 'abc',
        age: 30,
      };
      const expected = {
        name: 'john',
        age: 30,
      };
      expect(removeFields(input, ['password', 'token'])).toEqual(expected);
    });

    it('should support regex pattern removal', () => {
      const input = {
        name: 'john',
        password: 'secret',
        temp_token: 'abc',
        session_id: '123',
        age: 30,
      };
      const expected = {
        name: 'john',
        age: 30,
      };
      expect(removeFields(input, [/password|temp_|session_/])).toEqual(expected);
    });

    it('should support mixed string and regex patterns', () => {
      const input = {
        name: 'john',
        password: 'secret',
        temp_token: 'abc',
        token: 'xyz',
        age: 30,
      };
      const expected = {
        name: 'john',
        age: 30,
      };
      expect(removeFields(input, ['token', /password|temp_/])).toEqual(expected);
    });

    it('should support conditional filtering', () => {
      const input = {
        name: 'john',
        age: 15,
        adult: true,
        score: 85,
      };
      const expected = {
        name: 'john',
        adult: true,
        score: 85,
      };
      const options = {
        conditionalFilter: {
          condition: (key, value) => key === 'age' && value < 18,
        },
      };
      expect(removeFields(input, [], options)).toEqual(expected);
    });
  });

  describe('coerceTypes', () => {
    it('should coerce string numbers to numbers', () => {
      const input = {
        age: '25',
        score: '85.5',
        count: 'not-a-number',
      };
      const typeMap = {
        age: 'number',
        score: 'number',
        count: 'number',
      };
      const expected = {
        age: 25,
        score: 85.5,
        count: 'not-a-number', // Should remain string if not parseable
      };
      expect(coerceTypes(input, typeMap)).toEqual(expected);
    });

    it('should coerce various values to boolean', () => {
      const input = {
        isActive: 'true',
        isAdmin: 'false',
        isVerified: '1',
        isBlocked: '0',
        status: 'yes',
        flag: true,
      };
      const typeMap = {
        isActive: 'boolean',
        isAdmin: 'boolean',
        isVerified: 'boolean',
        isBlocked: 'boolean',
        status: 'boolean',
        flag: 'boolean',
      };
      const expected = {
        isActive: true,
        isAdmin: false,
        isVerified: true,
        isBlocked: false,
        status: true,
        flag: true,
      };
      expect(coerceTypes(input, typeMap)).toEqual(expected);
    });

    it('should coerce strings to dates', () => {
      const input = {
        createdAt: '2023-12-25T10:00:00Z',
        updatedAt: 'invalid-date',
      };
      const typeMap = {
        createdAt: 'date',
        updatedAt: 'date',
      };
      const expected = {
        createdAt: '2023-12-25T10:00:00.000Z',
        updatedAt: 'invalid-date', // Should remain string if invalid
      };
      expect(coerceTypes(input, typeMap)).toEqual(expected);
    });

    it('should coerce values to strings', () => {
      const input = {
        id: 123,
        active: true,
        score: 95.5,
      };
      const typeMap = {
        id: 'string',
        active: 'string',
        score: 'string',
      };
      const expected = {
        id: '123',
        active: 'true',
        score: '95.5',
      };
      expect(coerceTypes(input, typeMap)).toEqual(expected);
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          age: '30',
          active: 'true',
        },
        metadata: {
          score: '85',
        },
      };
      const typeMap = {
        age: 'number',
        active: 'boolean',
        score: 'number',
      };
      const expected = {
        user: {
          age: 30,
          active: true,
        },
        metadata: {
          score: 85,
        },
      };
      expect(coerceTypes(input, typeMap)).toEqual(expected);
    });

    it('should handle arrays', () => {
      const input = {
        scores: ['85', '90', '95'],
        flags: ['true', 'false', 'true'],
      };
      const typeMap = {
        scores: 'number',
        flags: 'boolean',
      };
      const expected = {
        scores: [85, 90, 95],
        flags: [true, false, true],
      };
      expect(coerceTypes(input, typeMap)).toEqual(expected);
    });

    it('should handle primitives and null values', () => {
      expect(coerceTypes('string', {})).toBe('string');
      expect(coerceTypes(123, {})).toBe(123);
      expect(coerceTypes(null, {})).toBe(null);
      expect(coerceTypes(undefined, {})).toBe(undefined);
    });

    it('should validate input parameters', () => {
      expect(() => normalizeKeys({})).toThrow('targetCase parameter is required');
      expect(() => normalizeKeys({}, null)).toThrow('targetCase parameter is required');
      expect(() => normalizeKeys({}, 'invalidCase')).toThrow('unsupported targetCase');
      expect(() => normalizeKeys({}, { delimiter: 123 })).toThrow(
        'custom delimiter must be a non-empty string',
      );

      expect(() => removeFields({}, 'not-an-array')).toThrow('patterns parameter must be an array');
      expect(() => removeFields({}, [123])).toThrow(
        'all patterns must be strings or RegExp objects',
      );

      expect(() => coerceTypes({}, 'not-an-object')).toThrow('typeMap parameter must be an object');
      expect(() => coerceTypes({}, { age: 'invalidType' })).toThrow('invalid type');
    });

    it('should handle type coercion errors gracefully', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const input = {
        badNumber: 'not-a-number',
        badDate: 'invalid-date',
        badBool: 'maybe',
      };
      const typeMap = {
        badNumber: 'number',
        badDate: 'date',
        badBool: 'boolean',
      };

      const result = coerceTypes(input, typeMap);

      // Should return original values when coercion fails
      expect(result.badNumber).toBe('not-a-number');
      expect(result.badDate).toBe('invalid-date');
      expect(result.badBool).toBe('maybe');

      // Should have logged warnings
      expect(consoleWarnSpy).toHaveBeenCalledTimes(3);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('applyPreset', () => {
    it('should apply AI processing preset', () => {
      const input = {
        userName: 'john',
        userPassword: 'secret',
        confidenceScore: '0.95',
        isActiveStatus: 'true',
        createdAt: '2023-12-25T10:00:00Z',
        sessionId: 'abc123',
      };

      const result = applyPreset(input, 'aiProcessing');

      expect(result).toEqual({
        user_name: 'john',
        confidence_score: 0.95, // coerced to number
        is_active_status: true, // coerced to boolean
        created_at: '2023-12-25T10:00:00.000Z', // coerced to date
      });
    });

    it('should apply API response preset', () => {
      const input = {
        user_name: 'john',
        _id: 'mongo123',
        __v: 1,
        password: 'secret',
        total_count: '150',
        is_active: '1',
        created_at: '2023-12-25',
      };

      const result = applyPreset(input, 'apiResponse');

      expect(result).toEqual({
        userName: 'john', // camelCase
        totalCount: 150, // number
        isActive: true, // boolean
        createdAt: '2023-12-25T00:00:00.000Z', // date
        // _id, __v, password removed by removeFields before normalization
      });
    });

    it('should apply data export preset', () => {
      const input = {
        productName: 'Widget',
        exportQuantity: '100',
        unitPrice: '29.99',
        isAvailable: 'yes',
        exportDate: '2023-12-25T10:00:00Z',
      };

      const result = applyPreset(input, 'dataExport');

      expect(result).toEqual({
        product_name: 'Widget',
        export_quantity: 100,
        unit_price: 29.99,
        is_available: true,
        export_date: '2023-12-25T10:00:00.000Z',
      });
    });

    it('should allow custom options to override preset', () => {
      const input = { userName: 'john', tempField: 'remove' };
      const customOptions = {
        removeFields: ['tempField', 'userName'], // Override preset
      };

      const result = applyPreset(input, 'apiResponse', customOptions);
      expect(result).toEqual({}); // Both fields removed
    });

    it('should throw error for unknown preset', () => {
      expect(() => applyPreset({}, 'unknownPreset')).toThrow('Unknown preset');
    });
  });

  describe('validatePreset', () => {
    it('should validate correct presets', () => {
      const validPreset = {
        normalizeKeys: 'camelCase',
        removeFields: ['field1'],
        coerceTypes: { age: 'number' },
      };
      expect(validatePreset(validPreset)).toBe(true);
    });

    it('should reject invalid presets', () => {
      expect(validatePreset(null)).toBe(false);
      expect(validatePreset({ normalizeKeys: 123 })).toBe(false);
      expect(validatePreset({ removeFields: 'not-array' })).toBe(false);
      expect(validatePreset({ coerceTypes: 'not-object' })).toBe(false);
    });
  });

  describe('TRANSFORMATION_PRESETS', () => {
    it('should contain all expected presets', () => {
      expect(TRANSFORMATION_PRESETS).toHaveProperty('aiProcessing');
      expect(TRANSFORMATION_PRESETS).toHaveProperty('apiResponse');
      expect(TRANSFORMATION_PRESETS).toHaveProperty('dataExport');
      expect(TRANSFORMATION_PRESETS).toHaveProperty('databaseStorage');
    });

    it('should have valid preset configurations', () => {
      for (const preset of Object.values(TRANSFORMATION_PRESETS)) {
        expect(validatePreset(preset)).toBe(true);
      }
    });
  });

  describe('createChain', () => {
    it('should support fluent chaining of transformations', () => {
      const input = {
        user_name: 'john',
        user_age: '30',
        password: 'secret',
        is_active: 'true',
        created_at: '2023-12-25',
      };

      const result = createChain(input)
        .removeFields(['password'])
        .normalizeKeys('camelCase')
        .coerceTypes({
          userAge: 'number',
          isActive: 'boolean',
          createdAt: 'date',
        })
        .value();

      expect(result).toEqual({
        userName: 'john',
        userAge: 30,
        isActive: true,
        createdAt: '2023-12-25T00:00:00.000Z',
      });
    });

    it('should support preset application in chains', () => {
      const input = {
        user_name: 'john',
        _id: 'mongo123',
        password: 'secret',
        total_count: '100',
      };

      const result = createChain(input)
        .applyPreset('apiResponse')
        .normalizeKeys('snake_case') // Additional transformation after preset
        .value();

      expect(result).toEqual({
        user_name: 'john',
        total_count: 100,
        // _id and password removed by preset, then converted back to snake_case
      });
    });

    it('should support validation in chains', () => {
      const input = { name: 'john', age: 30 };

      const result = createChain(input).validate().normalizeKeys('camelCase').value();

      expect(result).toEqual({
        name: 'john',
        age: 30,
      });
    });

    it('should throw error for invalid data in validation', () => {
      expect(() => {
        createChain('not an object').validate().value();
      }).toThrow('Validation failed: data must be an object');
    });
  });
});
