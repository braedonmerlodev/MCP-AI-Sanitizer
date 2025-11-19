const AdminOverrideController = require('../../controllers/AdminOverrideController');

describe('AdminOverrideController - Expiration Integration Tests', () => {
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

  describe('Multiple concurrent overrides with different expiration times', () => {
    it('should handle multiple overrides expiring at different times', () => {
      // Set max concurrent to 3
      controller.maxConcurrentOverrides = 3;

      // Activate first override with short duration
      mockReq.body = { justification: 'Short duration test', duration: 1000 }; // 1 second
      controller.activateOverride(mockReq, mockRes);
      const shortId = mockRes.json.mock.calls[0][0].overrideId;

      // Reset mocks
      mockRes.json.mockClear();
      mockRes.status.mockClear();

      // Activate second override with medium duration
      mockReq.body = { justification: 'Medium duration test', duration: 2000 }; // 2 seconds
      controller.activateOverride(mockReq, mockRes);
      const mediumId = mockRes.json.mock.calls[0][0].overrideId;

      // Reset mocks
      mockRes.json.mockClear();
      mockRes.status.mockClear();

      // Activate third override with long duration
      mockReq.body = { justification: 'Long duration test', duration: 5000 }; // 5 seconds
      controller.activateOverride(mockReq, mockRes);
      const longId = mockRes.json.mock.calls[0][0].overrideId;

      // Verify all are active
      expect(controller.isOverrideActive()).toBe(true);
      expect(controller.activeOverrides.size).toBe(3);

      // Wait for short to expire
      return new Promise((resolve) => setTimeout(resolve, 1100)).then(() => {
        // Clean expired
        controller._cleanExpiredOverrides();

        // Short should be expired, others active
        expect(controller.activeOverrides.size).toBe(2);
        expect(controller.activeOverrides.has(shortId)).toBe(false);
        expect(controller.activeOverrides.has(mediumId)).toBe(true);
        expect(controller.activeOverrides.has(longId)).toBe(true);

        // Wait for medium to expire
        return new Promise((resolve) => setTimeout(resolve, 1100)).then(() => {
          controller._cleanExpiredOverrides();

          // Medium expired, long active
          expect(controller.activeOverrides.size).toBe(1);
          expect(controller.activeOverrides.has(longId)).toBe(true);

          // Wait for long to expire
          return new Promise((resolve) => setTimeout(resolve, 4100)).then(() => {
            controller._cleanExpiredOverrides();

            // All expired
            expect(controller.activeOverrides.size).toBe(0);
            expect(controller.isOverrideActive()).toBe(false);
          });
        });
      });
    });
  });

  describe('Expiration during active override operations', () => {
    it('should handle expiration while checking status', () => {
      // Activate override
      mockReq.body = { justification: 'Status expiration test', duration: 1000 };
      controller.activateOverride(mockReq, mockRes);
      const overrideId = mockRes.json.mock.calls[0][0].overrideId;

      // Reset mocks
      mockRes.json.mockClear();

      // Check status - should be active
      controller.getOverrideStatus(mockReq, mockRes);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          activeOverrides: 1,
          overrides: expect.arrayContaining([
            expect.objectContaining({ id: overrideId, timeRemaining: expect.any(Number) }),
          ]),
        }),
      );

      // Reset mocks
      mockRes.json.mockClear();

      // Wait for expiration
      return new Promise((resolve) => setTimeout(resolve, 1100)).then(() => {
        // Check status again - should clean expired
        controller.getOverrideStatus(mockReq, mockRes);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            activeOverrides: 0,
            overrides: [],
          }),
        );
      });
    });

    it('should handle expiration while deactivating', () => {
      // Activate override
      mockReq.body = { justification: 'Deactivation expiration test', duration: 1000 };
      controller.activateOverride(mockReq, mockRes);
      const overrideId = mockRes.json.mock.calls[0][0].overrideId;

      // Reset mocks
      mockRes.json.mockClear();
      mockRes.status.mockClear();

      // Wait for expiration
      return new Promise((resolve) => setTimeout(resolve, 1100)).then(() => {
        // Try to deactivate expired override
        mockReq.params = { overrideId };
        controller.deactivateOverride(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Override expired',
          message: 'The specified override has expired',
        });
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle minimum duration override', () => {
      controller.maxConcurrentOverrides = 1;

      // Activate with minimum duration
      mockReq.body = { justification: 'Min duration test', duration: 60_000 }; // 1 minute
      controller.activateOverride(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Admin override activated successfully',
          duration: 60_000,
        }),
      );

      expect(controller.isOverrideActive()).toBe(true);
    });

    it('should handle maximum duration override', () => {
      controller.maxConcurrentOverrides = 1;

      // Activate with max duration
      mockReq.body = { justification: 'Max duration test', duration: 3_600_000 }; // 1 hour
      controller.activateOverride(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Admin override activated successfully',
          duration: 3_600_000,
        }),
      );

      expect(controller.isOverrideActive()).toBe(true);
    });

    it('should handle override that expires immediately', () => {
      controller.maxConcurrentOverrides = 1;

      // Create override with past end time (simulate immediate expiration)
      const overrideId = `override_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() - 1000); // Already expired

      controller.activeOverrides.set(overrideId, {
        adminId: 'admin-user-1',
        startTime,
        endTime,
        justification: 'Immediate expiration test',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });

      // Check if active - should clean and return false
      expect(controller.isOverrideActive()).toBe(false);
      expect(controller.activeOverrides.size).toBe(0);
    });
  });
});
