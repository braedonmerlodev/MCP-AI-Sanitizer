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
});
