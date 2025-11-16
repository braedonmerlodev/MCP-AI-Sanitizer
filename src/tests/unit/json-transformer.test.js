const { normalizeKeys, removeFields } = require('../../utils/jsonTransformer');

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
  });
});
