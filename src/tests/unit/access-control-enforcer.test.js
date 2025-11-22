const AccessControlEnforcer = require('../../components/AccessControlEnforcer');

describe('AccessControlEnforcer', () => {
  let enforcer;
  let mockReq;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    enforcer = new AccessControlEnforcer({ logger: mockLogger });

    mockReq = {
      method: 'POST',
      path: '/api/documents',
      ip: '127.0.0.1',
      trustTokenValidation: {
        isValid: true,
        error: null,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(), // 1 hour from now
      },
    };
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultEnforcer = new AccessControlEnforcer();
      expect(defaultEnforcer.defaultLevel).toBe('strict');
      expect(defaultEnforcer.getValidationLevels()).toEqual(['strict', 'moderate', 'lenient']);
    });

    it('should accept custom options', () => {
      const customEnforcer = new AccessControlEnforcer({ defaultLevel: 'moderate' });
      expect(customEnforcer.defaultLevel).toBe('moderate');
    });
  });

  describe('enforce', () => {
    it('should allow access with valid trust token in strict mode', () => {
      const result = enforcer.enforce(mockReq, 'strict');
      expect(result.allowed).toBe(true);
      expect(result.error).toBe(null);
      expect(result.code).toBe(null);
      expect(mockLogger.info).toHaveBeenCalledWith('Access granted', expect.any(Object));
    });

    it('should deny access without trust token validation', () => {
      const reqWithoutValidation = { ...mockReq };
      delete reqWithoutValidation.trustTokenValidation;

      const result = enforcer.enforce(reqWithoutValidation, 'strict');
      expect(result.allowed).toBe(false);
      expect(result.error).toBe('Trust token validation required');
      expect(result.code).toBe('NO_VALIDATION');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should deny access with invalid trust token', () => {
      const reqWithInvalidToken = {
        ...mockReq,
        trustTokenValidation: { isValid: false, error: 'Invalid signature' },
      };

      const result = enforcer.enforce(reqWithInvalidToken, 'strict');
      expect(result.allowed).toBe(false);
      expect(result.error).toBe('Invalid signature');
      expect(result.code).toBe('INVALID_TOKEN');
    });

    it('should deny access with expired token in strict mode', () => {
      const reqWithExpiredToken = {
        ...mockReq,
        trustTokenValidation: {
          isValid: true,
          expiresAt: new Date(Date.now() - 3_600_000).toISOString(), // 1 hour ago
        },
      };

      const result = enforcer.enforce(reqWithExpiredToken, 'strict');
      expect(result.allowed).toBe(false);
      expect(result.error).toBe('Trust token has expired');
      expect(result.code).toBe('EXPIRED_TOKEN');
    });

    it('should allow access with expired token in lenient mode', () => {
      const reqWithExpiredToken = {
        ...mockReq,
        trustTokenValidation: {
          isValid: true,
          expiresAt: new Date(Date.now() - 3_600_000).toISOString(),
        },
      };

      const result = enforcer.enforce(reqWithExpiredToken, 'lenient');
      expect(result.allowed).toBe(true);
    });

    it('should deny access with invalid validation level', () => {
      const result = enforcer.enforce(mockReq, 'invalid');
      expect(result.allowed).toBe(false);
      expect(result.error).toBe('Invalid validation level: invalid');
      expect(result.code).toBe('INVALID_LEVEL');
    });

    it('should use default level when none specified', () => {
      const result = enforcer.enforce(mockReq);
      expect(result.allowed).toBe(true);
    });

    it('should allow access via admin override when active', () => {
      const mockAdminOverrideController = {
        isOverrideActive: jest.fn(() => true),
        getActiveOverride: jest.fn(() => ({
          id: 'override-123',
          adminId: 'admin-456',
          justification: 'Emergency maintenance',
        })),
      };

      const enforcerWithOverride = new AccessControlEnforcer({
        logger: mockLogger,
        adminOverrideController: mockAdminOverrideController,
      });

      const result = enforcerWithOverride.enforce(mockReq, 'strict');
      expect(result.allowed).toBe(true);
      expect(result.code).toBe('ADMIN_OVERRIDE');
      expect(result.override.id).toBe('override-123');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Access granted via admin override',
        expect.any(Object),
      );
    });

    it('should not use admin override when not active', () => {
      const mockAdminOverrideController = {
        isOverrideActive: jest.fn(() => false),
      };

      const enforcerWithOverride = new AccessControlEnforcer({
        logger: mockLogger,
        adminOverrideController: mockAdminOverrideController,
      });

      const result = enforcerWithOverride.enforce(mockReq, 'strict');
      expect(result.allowed).toBe(true);
      expect(result.code).toBe(null);
    });

    it('should allow system operation without trust token validation', () => {
      const reqSystem = {
        method: 'POST',
        path: '/export/training-data',
        ip: '127.0.0.1',
        // no trustTokenValidation
      };

      const result = enforcer.enforce(reqSystem, 'strict');
      expect(result.allowed).toBe(true);
      expect(result.error).toBe(null);
      expect(result.code).toBe('SYSTEM_OPERATION');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Allowing system operation without trust token validation',
        expect.any(Object),
      );
    });

    it('should deny access for non-system operation without trust token validation', () => {
      const reqNoValidation = {
        method: 'POST',
        path: '/api/documents',
        ip: '127.0.0.1',
        // no trustTokenValidation
      };

      const result = enforcer.enforce(reqNoValidation, 'strict');
      expect(result.allowed).toBe(false);
      expect(result.error).toBe('Trust token validation required');
      expect(result.code).toBe('NO_VALIDATION');
    });

    it('should handle trust token without expiresAt', () => {
      const reqNoExpires = {
        ...mockReq,
        trustTokenValidation: {
          isValid: true,
          // no expiresAt
        },
      };

      const result = enforcer.enforce(reqNoExpires, 'strict');
      expect(result.allowed).toBe(true);
    });
  });

  describe('getValidationLevels', () => {
    it('should return available validation levels', () => {
      const levels = enforcer.getValidationLevels();
      expect(levels).toContain('strict');
      expect(levels).toContain('moderate');
      expect(levels).toContain('lenient');
    });
  });

  describe('performance', () => {
    it('should enforce access in less than 1ms', () => {
      const start = process.hrtime.bigint();
      enforcer.enforce(mockReq, 'strict');
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
      expect(duration).toBeLessThan(1);
    });
  });

  describe('private methods', () => {
    describe('_isSignatureValid', () => {
      it('should return true for valid signature', () => {
        const validation = { isValid: true };
        expect(enforcer._isSignatureValid(validation)).toBe(true);
      });

      it('should return false for invalid signature', () => {
        const validation = { isValid: false };
        expect(enforcer._isSignatureValid(validation)).toBe(false);
      });
    });

    describe('_isExpired', () => {
      it('should return false when no expiresAt', () => {
        const validation = {};
        expect(enforcer._isExpired(validation)).toBe(false);
      });

      it('should return false when not expired', () => {
        const validation = { expiresAt: new Date(Date.now() + 3600000).toISOString() };
        expect(enforcer._isExpired(validation)).toBe(false);
      });

      it('should return true when expired', () => {
        const validation = { expiresAt: new Date(Date.now() - 3600000).toISOString() };
        expect(enforcer._isExpired(validation)).toBe(true);
      });
    });

    describe('_contentMatches', () => {
      it('should return true (placeholder implementation)', () => {
        expect(enforcer._contentMatches()).toBe(true);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle null request object', () => {
      expect(() => enforcer.enforce(null)).toThrow();
    });

    it('should handle undefined request object', () => {
      expect(() => enforcer.enforce(undefined)).toThrow();
    });

    it('should handle request with null trustTokenValidation', () => {
      const reqWithNullValidation = {
        ...mockReq,
        trustTokenValidation: null,
      };

      const result = enforcer.enforce(reqWithNullValidation, 'strict');
      expect(result.allowed).toBe(false);
      expect(result.error).toBe('Trust token validation required');
    });

    it('should handle malformed expiresAt date', () => {
      const reqWithBadDate = {
        ...mockReq,
        trustTokenValidation: {
          isValid: true,
          expiresAt: 'not-a-date',
        },
      };

      // Should not throw and should allow access in lenient mode
      const result = enforcer.enforce(reqWithBadDate, 'lenient');
      expect(result.allowed).toBe(true);
    });

    it('should handle empty validation object', () => {
      const reqWithEmptyValidation = {
        ...mockReq,
        trustTokenValidation: {},
      };

      const result = enforcer.enforce(reqWithEmptyValidation, 'strict');
      expect(result.allowed).toBe(false);
      expect(result.error).toBe('Invalid trust token');
    });

    it('should handle validation with error message', () => {
      const reqWithError = {
        ...mockReq,
        trustTokenValidation: {
          isValid: false,
          error: 'Custom validation error',
        },
      };

      const result = enforcer.enforce(reqWithError, 'strict');
      expect(result.allowed).toBe(false);
      expect(result.error).toBe('Custom validation error');
    });

    it('should handle different HTTP methods for system operations', () => {
      const systemReqs = [
        { method: 'GET', path: '/export/training-data' },
        { method: 'PUT', path: '/export/training-data' },
        { method: 'DELETE', path: '/export/training-data' },
      ];

      systemReqs.forEach((req) => {
        const result = enforcer.enforce({ ...req, ip: '127.0.0.1' }, 'strict');
        expect(result.allowed).toBe(false); // Should deny non-POST methods
        expect(result.code).toBe('NO_VALIDATION');
      });
    });

    it('should handle concurrent access enforcement', () => {
      // Test that multiple calls work correctly
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(enforcer.enforce(mockReq, 'strict'));
      }

      results.forEach((result) => {
        expect(result.allowed).toBe(true);
        expect(result.error).toBe(null);
      });
    });
  });
});
