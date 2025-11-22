const {
  recordRequest,
  recordSecurityEvent,
  recordError,
  getMetrics,
  resetMetrics,
} = require('../../utils/monitoring');

describe('Monitoring Utils', () => {
  beforeEach(() => {
    resetMetrics();
  });

  describe('recordRequest', () => {
    it('should record request metrics', () => {
      recordRequest('GET', '/test', 100);
      const metrics = getMetrics();
      expect(metrics.requests.total).toBe(1);
      expect(metrics.requests.byMethod.GET).toBe(1);
      expect(metrics.requests.byEndpoint['/test']).toBe(1);
      expect(metrics.performance.responseTimes).toContain(100);
      expect(metrics.performance.avgResponseTime).toBe(100);
    });
  });

  describe('recordSecurityEvent', () => {
    it('should record failed validation', () => {
      recordSecurityEvent('failedValidation');
      const metrics = getMetrics();
      expect(metrics.security.failedValidations).toBe(1);
    });

    it('should record auth failure', () => {
      recordSecurityEvent('authFailure');
      const metrics = getMetrics();
      expect(metrics.security.authFailures).toBe(1);
    });

    it('should record suspicious request', () => {
      recordSecurityEvent('suspiciousRequest');
      const metrics = getMetrics();
      expect(metrics.security.suspiciousRequests).toBe(1);
    });
  });

  describe('recordError', () => {
    it('should record error metrics', () => {
      recordError();
      const metrics = getMetrics();
      expect(metrics.stability.errors).toBe(1);
      expect(metrics.stability.errorRate).toBe(1); // 1 error / 0 requests = 1
    });
  });

  describe('getMetrics', () => {
    it('should return current metrics', () => {
      const metrics = getMetrics();
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('requests');
      expect(metrics).toHaveProperty('performance');
      expect(metrics).toHaveProperty('security');
      expect(metrics).toHaveProperty('stability');
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics', () => {
      recordRequest('GET', '/test', 100);
      recordSecurityEvent('failedValidation');
      recordError();
      resetMetrics();
      const metrics = getMetrics();
      expect(metrics.requests.total).toBe(0);
      expect(metrics.security.failedValidations).toBe(0);
      expect(metrics.stability.errors).toBe(0);
    });
  });
});
