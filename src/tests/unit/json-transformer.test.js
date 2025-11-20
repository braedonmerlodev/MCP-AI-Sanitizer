const { normalizeKeys, removeFields, coerceTypes } = require('../../utils/jsonTransformer');

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
  });
});
