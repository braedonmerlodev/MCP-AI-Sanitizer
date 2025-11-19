const AdminOverrideController = require('../../controllers/AdminOverrideController');

describe('AdminOverrideController', () => {
  let controller;
  let mockReq;
  let mockRes;
  let mockLogger;
  let mockAuditLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockAuditLogger = {
      logAccessEnforcement: jest.fn(),
    };

    controller = new AdminOverrideController({
      logger: mockLogger,
      auditSecret: 'test-audit-secret',
      adminAuthSecret: 'test-admin-secret',
    });

    // Mock the audit logger
    controller.auditLogger = mockAuditLogger;

    mockReq = {
      method: 'POST',
      path: '/api/admin/override/activate',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent',
        'x-admin-auth': 'test-admin-secret',
        'x-admin-id': 'admin-user-1',
      },
      body: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('authenticateAdmin', () => {
    it('should authenticate valid admin credentials', () => {
      const result = controller.authenticateAdmin(mockReq);
      expect(result.isValid).toBe(true);
      expect(result.adminId).toBe('admin-user-1');
    });

    it('should reject missing auth header', () => {
      const req = { ...mockReq, headers: {} };
      const result = controller.authenticateAdmin(req);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Admin authentication required');
    });

    it('should reject invalid auth secret', () => {
      const req = {
        ...mockReq,
        headers: { ...mockReq.headers, 'x-admin-auth': 'wrong-secret' },
      };
      const result = controller.authenticateAdmin(req);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid admin credentials');
    });
  });

  describe('activateOverride', () => {
    beforeEach(() => {
      mockReq.body = {
        justification: 'Emergency system maintenance required',
        duration: 900_000, // 15 minutes
      };
    });

    it('should activate override with valid request', () => {
      controller.activateOverride(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Admin override activated successfully',
          adminId: 'admin-user-1',
          justification: 'Emergency system maintenance required',
        }),
      );

      expect(mockAuditLogger.logAccessEnforcement).toHaveBeenCalledWith(
        expect.any(String),
        true,
        'admin',
        expect.any(Object),
        expect.objectContaining({
          userId: 'admin-user-1',
          reason: 'Admin override activated',
          justification: 'Emergency system maintenance required',
        }),
      );

      // Check that override was stored
      expect(controller.isOverrideActive()).toBe(true);
    });

    it('should reject invalid justification', () => {
      mockReq.body.justification = 'short';

      controller.activateOverride(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Justification required',
        message: 'Override justification must be at least 10 characters',
      });
    });

    it('should use default duration when not specified', () => {
      delete mockReq.body.duration;

      controller.activateOverride(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.duration).toBe(900_000); // 15 minutes default
    });

    it('should enforce concurrent override limit', () => {
      // Set max concurrent to 1
      controller.maxConcurrentOverrides = 1;

      // Activate first override
      controller.activateOverride(mockReq, mockRes);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Admin override activated successfully' }),
      );

      // Reset mocks
      mockRes.json.mockClear();
      mockRes.status.mockClear();

      // Try to activate second override
      controller.activateOverride(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Concurrent override limit exceeded',
        message: 'Maximum 1 concurrent overrides allowed',
      });
    });

    it('should reject unauthenticated requests', () => {
      mockReq.headers['x-admin-auth'] = 'wrong-secret';

      controller.activateOverride(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication failed',
        message: 'Invalid admin credentials',
      });
    });

    it('should clean expired overrides before checking concurrent limit', () => {
      // Set max concurrent to 1
      controller.maxConcurrentOverrides = 1;

      // Activate first override
      controller.activateOverride(mockReq, mockRes);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Admin override activated successfully' }),
      );

      const firstOverrideId = mockRes.json.mock.calls[0][0].overrideId;

      // Reset mocks
      mockRes.json.mockClear();
      mockRes.status.mockClear();

      // Manually expire the first override
      const override = controller.activeOverrides.get(firstOverrideId);
      override.endTime = new Date(Date.now() - 1000);

      // Now activate second override - should succeed because expired was cleaned
      controller.activateOverride(mockReq, mockRes);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Admin override activated successfully' }),
      );
    });
  });

  describe('deactivateOverride', () => {
    let overrideId;

    it('should deactivate active override', () => {
      // Activate an override first
      mockReq.body = { justification: 'Test deactivation' };
      controller.activateOverride(mockReq, mockRes);
      overrideId = mockRes.json.mock.calls[0][0].overrideId;

      // Reset mocks
      mockRes.json.mockClear();
      mockRes.status.mockClear();

      mockReq.params = { overrideId };

      controller.deactivateOverride(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Admin override deactivated successfully',
          overrideId,
          deactivatedBy: 'admin-user-1',
        }),
      );

      expect(controller.isOverrideActive()).toBe(false);
    });

    it('should reject deactivation of non-existent override', () => {
      mockReq.params = { overrideId: 'non-existent-id' };

      controller.deactivateOverride(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Override not found',
        message: 'The specified override does not exist or has expired',
      });
    });

    it('should reject deactivation of expired override', () => {
      // Activate override
      mockReq.body = { justification: 'Expire test' };
      controller.activateOverride(mockReq, mockRes);
      overrideId = mockRes.json.mock.calls[0][0].overrideId;

      // Reset mocks
      mockRes.json.mockClear();
      mockRes.status.mockClear();

      // Manually expire the override
      const override = controller.activeOverrides.get(overrideId);
      override.endTime = new Date(Date.now() - 1000);

      // Try to deactivate
      mockReq.params = { overrideId };
      controller.deactivateOverride(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Override expired',
        message: 'The specified override has expired',
      });
  });

});

describe('getOverrideStatus', () => {

  it('should return empty status when no overrides active', () => {

    controller.getOverrideStatus(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({

      activeOverrides: 0,

      maxConcurrent: 1,

      overrides: [],

    });

  });

  it('should return active override status', () => {
    // Activate override
    mockReq.body = { justification: 'Status test' };
    controller.activateOverride(mockReq, mockRes);

    // Reset mocks and get status
    mockRes.json.mockClear();
    controller.getOverrideStatus(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({
      activeOverrides: 1,
      maxConcurrent: 1,
      overrides: expect.arrayContaining([
        expect.objectContaining({
          adminId: 'admin-user-1',
          justification: 'Status test',
          timeRemaining: expect.any(Number),
        }),
      ]),
    });
  });
});

describe('isOverrideActive', () => {
  it('should return false when no overrides exist', () => {
    expect(controller.isOverrideActive()).toBe(false);
  });

  it('should return true when override is active', () => {
    mockReq.body = { justification: 'Active test' };
    controller.activateOverride(mockReq, mockRes);

    expect(controller.isOverrideActive()).toBe(true);
  });

  it('should return false after manual expiration simulation', () => {
    // Create a fresh controller for this test
    const testController = new AdminOverrideController({
      logger: mockLogger,
      adminAuthSecret: 'test-admin-secret',
    });
    testController.auditLogger = mockAuditLogger;

    mockReq.body = { justification: 'Expiration test' };
    testController.activateOverride(mockReq, mockRes);

    // Verify override is active initially
    expect(testController.isOverrideActive()).toBe(true);

    // Manually expire the override by setting endTime to past
    const overrideId = testController.activeOverrides.keys().next().value;
    const override = testController.activeOverrides.get(overrideId);
    override.endTime = new Date(Date.now() - 1000); // Set to 1 second ago

    // Check again - should clean up expired override
    expect(testController.isOverrideActive()).toBe(false);
  });
});

describe('getActiveOverride', () => {
  it('should return null when no overrides active', () => {
    expect(controller.getActiveOverride()).toBe(null);
  });

  it('should return active override details', () => {
    mockReq.body = { justification: 'Get active test' };
    controller.activateOverride(mockReq, mockRes);

    const active = controller.getActiveOverride();
    expect(active).toEqual(
      expect.objectContaining({
        adminId: 'admin-user-1',
        justification: 'Get active test',
        ipAddress: '127.0.0.1',
      }),
    );
  });
});

describe('automatic expiration', () => {
  it('should clean expired overrides when _cleanExpiredOverrides is called', () => {
    const testController = new AdminOverrideController({
      logger: mockLogger,
      adminAuthSecret: 'test-admin-secret',
    });
    testController.auditLogger = mockAuditLogger;

    mockReq.body = { justification: 'Cleanup test' };
    testController.activateOverride(mockReq, mockRes);

    expect(testController.activeOverrides.size).toBe(1);

    // Manually expire the override
    const overrideId = testController.activeOverrides.keys().next().value;
    const override = testController.activeOverrides.get(overrideId);
    override.endTime = new Date(Date.now() - 1000); // Set to expired

    // Call cleanup method
    testController._cleanExpiredOverrides();

    // Verify expired override was cleaned up
    expect(testController.activeOverrides.size).toBe(0);
  });
});
});
