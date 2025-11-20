const AdminOverrideController = require('./src/controllers/AdminOverrideController');

const controller = new AdminOverrideController({
  logger: console,
  auditSecret: 'test-audit-secret',
  adminAuthSecret: 'test-admin-secret',
});

const mockReq = {
  method: 'POST',
  path: '/api/admin/override/activate',
  ip: '127.0.0.1',
  headers: {
    'user-agent': 'test-agent',
    'x-admin-auth': 'test-admin-secret',
    'x-admin-id': 'admin-user-1',
  },
  body: { justification: 'Test', duration: 1000 },
};

const mockRes = {
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
};

// Activate
controller.activateOverride(mockReq, mockRes);
console.log('Activation response:', mockRes.json.mock.calls[0]);

// Check immediately
console.log('Is active:', controller.isOverrideActive());
console.log('Size:', controller.activeOverrides.size);

// Wait and check again
setTimeout(() => {
  console.log('After 1.1s - Is active:', controller.isOverrideActive());
  console.log('Size:', controller.activeOverrides.size);

  // Try to deactivate
  const overrideId = mockRes.json.mock.calls[0][0].overrideId;
  console.log('Override ID:', overrideId);

  const deactivateReq = {
    ...mockReq,
    params: { overrideId },
  };

  const deactivateRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  controller.deactivateOverride(deactivateReq, deactivateRes);
  console.log('Deactivation status:', deactivateRes.status.mock.calls);
  console.log('Deactivation response:', deactivateRes.json.mock.calls);
}, 1100);
