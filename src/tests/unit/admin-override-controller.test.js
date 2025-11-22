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
      debug: jest.fn(),
    };

    mockAuditLogger = {
      logAccessEnforcement: jest.fn(),
    };

    controller = new AdminOverrideController({
      logger: mockLogger,
      auditSecret: 'test-audit-secret',
      adminAuthSecret: 'test-admin-secret',
      maxConcurrentOverrides: 1,
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

    it('should reject when auth header length differs from secret', () => {
      const req = {
        ...mockReq,
        headers: { ...mockReq.headers, 'x-admin-auth': 'short' }, // shorter than 'test-admin-secret'
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
        message: 'Maximum 1 concurrent overrides allowed within 200ms',
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

  // Additional tests for branch coverage improvement

  describe('authenticateAdmin - additional branch coverage', () => {
    it('should reject when auth header length differs from secret', () => {
      const req = {
        ...mockReq,
        headers: { ...mockReq.headers, 'x-admin-auth': 'short' }, // shorter than 'test-admin-secret'
      };
      const result = controller.authenticateAdmin(req);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid admin credentials');
    });

    it('should handle Buffer.from error in authenticateAdmin', () => {
      // Mock Buffer.from to throw
      const originalBufferFrom = Buffer.from;
      Buffer.from = jest.fn(() => {
        throw new Error('Buffer error');
      });

      try {
        const req = { ...mockReq };
        const result = controller.authenticateAdmin(req);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid admin credentials');
      } finally {
        Buffer.from = originalBufferFrom;
      }
    });
  });

  describe('activateOverride - additional branch coverage', () => {
    it('should reject duration below minimum', () => {
      mockReq.body = {
        justification: 'Test minimum duration',
        duration: 500, // Below min 1000 in test env
      };

      controller.activateOverride(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid duration',
        message: 'Override duration must be at least 1000ms',
      });
    });

    it('should enforce global concurrent cap', () => {
      // Set high concurrent window limit to avoid recent window check
      controller.concurrentWindowLimit = 100;
      controller.maxConcurrentOverrides = 2;

      // Activate first override
      mockReq.body = { justification: 'First override' };
      controller.activateOverride(mockReq, mockRes);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Admin override activated successfully' }),
      );

      // Reset mocks
      mockRes.json.mockClear();
      mockRes.status.mockClear();

      // Activate second override
      controller.activateOverride(mockReq, mockRes);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Admin override activated successfully' }),
      );

      // Reset mocks
      mockRes.json.mockClear();
      mockRes.status.mockClear();

      // Try third - should hit global cap
      controller.activateOverride(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Concurrent override limit exceeded',
        message: 'Maximum 2 concurrent overrides allowed (global cap)',
      });
    });
  });

  describe('deactivateOverride - additional branch coverage', () => {
    it('should reject unauthenticated deactivate requests', () => {
      mockReq.headers['x-admin-auth'] = 'wrong-secret';
      mockReq.params = { overrideId: 'some-id' };

      controller.deactivateOverride(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication failed',
        message: 'Invalid admin credentials',
      });
    });

    it('should reject deactivate with missing overrideId', () => {
      mockReq.params = {};

      controller.deactivateOverride(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Override ID required',
        message: 'Override ID must be provided in URL path',
      });
    });

    it('should log warning when different admin deactivates override', () => {
      // Activate with admin-user-1
      mockReq.body = { justification: 'Different admin test' };
      controller.activateOverride(mockReq, mockRes);
      const overrideId = mockRes.json.mock.calls[0][0].overrideId;

      // Reset mocks
      mockRes.json.mockClear();
      mockRes.status.mockClear();

      // Deactivate with different admin
      mockReq.params = { overrideId };
      mockReq.headers['x-admin-id'] = 'admin-user-2';

      controller.deactivateOverride(mockReq, mockRes);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Admin override deactivation attempted by different admin',
        expect.objectContaining({
          overrideId,
          requestingAdmin: 'admin-user-2',
          overrideAdmin: 'admin-user-1',
        }),
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Admin override deactivated successfully',
          originalAdmin: 'admin-user-1',
        }),
      );
    });
  });

  describe('getOverrideStatus - additional branch coverage', () => {
    it('should reject unauthenticated getOverrideStatus requests', () => {
      mockReq.headers['x-admin-auth'] = 'wrong-secret';

      controller.getOverrideStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication failed',
        message: 'Invalid admin credentials',
      });
    });
  });

  describe('isOverrideActive - additional branch coverage', () => {
    it('should check specific override by id', () => {
      mockReq.body = { justification: 'Specific override test' };
      controller.activateOverride(mockReq, mockRes);
      const overrideId = mockRes.json.mock.calls[0][0].overrideId;

      expect(controller.isOverrideActive(overrideId)).toBe(true);
      expect(controller.isOverrideActive('non-existent')).toBe(false);
    });
  });

  describe('test-only helpers - branch coverage', () => {
    it('should allow _getActiveOverrideIds in test environment', () => {
      mockReq.body = { justification: 'Test helper' };
      controller.activateOverride(mockReq, mockRes);

      const ids = controller._getActiveOverrideIds();
      expect(ids).toHaveLength(1);
      expect(ids[0]).toMatch(/^override_/);
    });

    it('should throw error for _getActiveOverrideIds outside test', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        expect(() => controller._getActiveOverrideIds()).toThrow(
          '_getActiveOverrideIds is a test-only helper',
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should allow clearAllOverrides in test environment', () => {
      mockReq.body = { justification: 'Clear all test' };
      controller.activateOverride(mockReq, mockRes);

      expect(controller.activeOverrides.size).toBe(1);

      controller.clearAllOverrides();

      expect(controller.activeOverrides.size).toBe(0);
    });

    it('should throw error for clearAllOverrides outside test', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        expect(() => controller.clearAllOverrides()).toThrow(
          'clearAllOverrides is a test-only helper',
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('error handling coverage', () => {
    describe('activateOverride error handling', () => {
      it('should handle audit logger errors during activation', () => {
        // Mock audit logger to throw error
        mockAuditLogger.logAccessEnforcement = jest.fn(() => {
          throw new Error('Audit logger failure');
        });

        mockReq.body = { justification: 'Test audit failure' };

        controller.activateOverride(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Override activation failed',
          message: 'An error occurred while activating the override',
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Admin override activation error',
          expect.objectContaining({
            error: 'Audit logger failure',
          }),
        );
      });

      it('should handle unexpected errors during activation', () => {
        // Mock activeOverrides.set to throw error
        const originalSet = controller.activeOverrides.set;
        controller.activeOverrides.set = jest.fn(() => {
          throw new Error('Map set failure');
        });

        mockReq.body = { justification: 'Test unexpected error' };

        controller.activateOverride(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Override activation failed',
          message: 'An error occurred while activating the override',
        });

        // Restore original method
        controller.activeOverrides.set = originalSet;
      });
    });

    describe('deactivateOverride error handling', () => {
      it('should handle audit logger errors during deactivation', () => {
        // First activate an override
        mockReq.body = { justification: 'Test deactivation error' };
        controller.activateOverride(mockReq, mockRes);
        const overrideId = controller.activeOverrides.keys().next().value;

        // Reset mocks
        jest.clearAllMocks();

        // Mock audit logger to throw error
        mockAuditLogger.logAccessEnforcement = jest.fn(() => {
          throw new Error('Audit logger failure');
        });

        mockReq.params = { overrideId };

        controller.deactivateOverride(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Override deactivation failed',
          message: 'An error occurred while deactivating the override',
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Admin override deactivation error',
          expect.objectContaining({
            error: 'Audit logger failure',
          }),
        );
      });

      it('should handle timer clearing errors during deactivation', () => {
        // First activate an override with explicit duration (to create timer in test env)
        mockReq.body = { justification: 'Test timer error', duration: 30000 };
        controller.activateOverride(mockReq, mockRes);
        const overrideId = controller.activeOverrides.keys().next().value;

        // Reset mocks
        jest.clearAllMocks();

        // Mock clearTimeout to throw error
        const originalClearTimeout = global.clearTimeout;
        global.clearTimeout = jest.fn(() => {
          throw new Error('Timer clearing failure');
        });

        mockReq.params = { overrideId };

        controller.deactivateOverride(mockReq, mockRes);

        expect(mockLogger.debug).toHaveBeenCalledWith('Failed to clear override timer', {
          error: 'Timer clearing failure',
        });

        // Restore original method
        global.clearTimeout = originalClearTimeout;
      });
    });

    describe('getOverrideStatus error handling', () => {
      it('should handle unexpected errors during status retrieval', () => {
        // Mock activeOverrides.entries to throw error
        const originalEntries = controller.activeOverrides.entries;
        controller.activeOverrides.entries = jest.fn(() => {
          throw new Error('Map entries failure');
        });

        controller.getOverrideStatus(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Status retrieval failed',
          message: 'An error occurred while retrieving override status',
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Get override status error',
          expect.objectContaining({
            error: 'Map entries failure',
          }),
        );

        // Restore original method
        controller.activeOverrides.entries = originalEntries;
      });
    });

    describe('clearAllOverrides error handling', () => {
      it('should handle timer clearing errors in clearAllOverrides', () => {
        // First activate an override with explicit duration (to create timer in test env)
        mockReq.body = { justification: 'Test clearAll timer error', duration: 30000 };
        controller.activateOverride(mockReq, mockRes);

        // Mock clearTimeout to throw error
        const originalClearTimeout = global.clearTimeout;
        global.clearTimeout = jest.fn(() => {
          throw new Error('Timer clearing failure');
        });

        controller.clearAllOverrides();

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Failed to clear override timer during clearAllOverrides',
          expect.objectContaining({
            error: 'Timer clearing failure',
          }),
        );

        // Restore original method
        global.clearTimeout = originalClearTimeout;
      });
    });

    describe('_cleanExpiredOverrides error handling', () => {
      it('should handle timer clearing errors in _cleanExpiredOverrides', () => {
        // First activate an override with explicit duration (to create timer in test env)
        mockReq.body = { justification: 'Test cleanup timer error', duration: 30000 };
        controller.activateOverride(mockReq, mockRes);

        // Manually expire the override
        const overrideId = controller.activeOverrides.keys().next().value;
        const override = controller.activeOverrides.get(overrideId);
        override.endTime = new Date(Date.now() - 1000);

        // Mock clearTimeout to throw error
        const originalClearTimeout = global.clearTimeout;
        global.clearTimeout = jest.fn(() => {
          throw new Error('Timer clearing failure');
        });

        controller._cleanExpiredOverrides();

        expect(mockLogger.debug).toHaveBeenCalledWith('Failed to clear expired override timer', {
          error: 'Timer clearing failure',
        });

        // Restore original method
        global.clearTimeout = originalClearTimeout;
      });
    });
  });
});
