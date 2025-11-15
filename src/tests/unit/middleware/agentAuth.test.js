const {
  agentAuth,
  enforceAgentSync,
  determineAgentType,
} = require('../../../middleware/agentAuth');

describe('Agent Authentication Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      get: jest.fn(),
      ip: '127.0.0.1',
      path: '/api/sanitize',
      originalUrl: '/api/sanitize',
    };
    mockRes = {
      set: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe('agentAuth middleware', () => {
    it('should detect agent request via X-Agent-Key header', () => {
      mockReq.get.mockImplementation((header) => {
        if (header === 'X-Agent-Key') return 'agent-security-123';
        if (header === 'User-Agent') return 'TestAgent/1.0';
      });

      agentAuth(mockReq, mockRes, mockNext);

      expect(mockReq.isAgentRequest).toBe(true);
      expect(mockReq.agentKey).toBe('agent-security-123');
      expect(mockReq.agentType).toBe('security');
      expect(mockRes.set).toHaveBeenCalledWith('X-Agent-Request', 'true');
      expect(mockRes.set).toHaveBeenCalledWith('X-Agent-Type', 'security');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should detect agent request via X-API-Key header', () => {
      mockReq.get.mockImplementation((header) => {
        if (header === 'X-API-Key') return 'agent-monitor-456';
        if (header === 'User-Agent') return 'MonitorAgent/2.0';
        return;
      });

      agentAuth(mockReq, mockRes, mockNext);

      expect(mockReq.isAgentRequest).toBe(true);
      expect(mockReq.agentKey).toBe('agent-monitor-456');
      expect(mockReq.agentType).toBe('monitoring');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should detect agent request via User-Agent string', () => {
      mockReq.get.mockImplementation((header) => {
        if (header === 'User-Agent') return 'BMad-Agent/1.0';
        return;
      });

      agentAuth(mockReq, mockRes, mockNext);

      expect(mockReq.isAgentRequest).toBe(true);
      expect(mockReq.agentType).toBe('bmad-framework');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not mark non-agent requests', () => {
      mockReq.get.mockImplementation((header) => {
        if (header === 'User-Agent') return 'Mozilla/5.0';
        return;
      });

      agentAuth(mockReq, mockRes, mockNext);

      expect(mockReq.isAgentRequest).toBe(false);
      expect(mockRes.set).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle errors gracefully', () => {
      mockReq.get.mockImplementation(() => {
        throw new Error('Header error');
      });

      agentAuth(mockReq, mockRes, mockNext);

      expect(mockReq.isAgentRequest).toBe(false);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('enforceAgentSync middleware', () => {
    it('should enforce sync mode for agent requests', () => {
      mockReq.isAgentRequest = true;
      mockReq.query = {};

      enforceAgentSync(mockReq, mockRes, mockNext);

      expect(mockReq.query.sync).toBe('true');
      expect(mockReq.forceSync).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not override explicit async preference', () => {
      mockReq.isAgentRequest = true;
      mockReq.query = { async: 'true' };

      enforceAgentSync(mockReq, mockRes, mockNext);

      expect(mockReq.query.sync).toBeUndefined();
      expect(mockReq.forceSync).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not affect non-agent requests', () => {
      mockReq.isAgentRequest = false;
      mockReq.query = {};

      enforceAgentSync(mockReq, mockRes, mockNext);

      expect(mockReq.query.sync).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('determineAgentType function', () => {
    it('should classify security agents', () => {
      const req = {
        get: jest.fn((header) => {
          if (header === 'X-Agent-Key') return 'agent-security-123';
          if (header === 'User-Agent') return 'SecurityAgent/1.0';
          return;
        }),
      };

      const type = determineAgentType(req);
      expect(type).toBe('security');
    });

    it('should classify monitoring agents', () => {
      const req = {
        get: jest.fn((header) => {
          if (header === 'X-API-Key') return 'agent-monitor-456';
          return;
        }),
      };

      const type = determineAgentType(req);
      expect(type).toBe('monitoring');
    });

    it('should classify BMad framework agents', () => {
      const req = {
        get: jest.fn((header) => {
          if (header === 'User-Agent') return 'BMad-Agent/1.0';
          return;
        }),
      };

      const type = determineAgentType(req);
      expect(type).toBe('bmad-framework');
    });

    it('should default to generic type', () => {
      const req = {
        get: jest.fn((header) => {
          if (header === 'X-Agent-Key') return 'agent-custom-789';
          return;
        }),
      };

      const type = determineAgentType(req);
      expect(type).toBe('generic');
    });
  });
});
