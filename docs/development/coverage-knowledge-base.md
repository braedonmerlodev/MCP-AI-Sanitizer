# Coverage Knowledge Base

## Overview

This knowledge base serves as a comprehensive reference for the development team on test coverage practices, patterns, and maintenance procedures. It consolidates best practices, common solutions, and troubleshooting guidance for maintaining high test coverage standards.

## Core Concepts

### Coverage Types

#### Line Coverage

- **Definition**: Percentage of executable code lines executed during testing
- **Importance**: Ensures all code paths are tested
- **Target**: 85%+ overall
- **Measurement**: `lines` in coverage reports

#### Branch Coverage

- **Definition**: Percentage of decision points (if/else, switch) tested
- **Importance**: Validates conditional logic
- **Target**: 80%+ for critical paths
- **Measurement**: `branches` in coverage reports

#### Function Coverage

- **Definition**: Percentage of functions called during testing
- **Importance**: Ensures function interfaces are tested
- **Target**: 90%+ for public APIs
- **Measurement**: `functions` in coverage reports

#### Statement Coverage

- **Definition**: Percentage of statements executed
- **Importance**: Basic coverage metric
- **Target**: 85%+ overall
- **Measurement**: `statements` in coverage reports

## Testing Patterns

### Unit Testing Patterns

#### Arrange-Act-Assert (AAA)

```javascript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user successfully', async () => {
      // Arrange
      const userData = { email: 'test@example.com', name: 'Test User' };
      const mockRepository = { save: jest.fn().mockResolvedValue(userData) };
      const service = new UserService(mockRepository);

      // Act
      const result = await service.createUser(userData);

      // Assert
      expect(result).toEqual(userData);
      expect(mockRepository.save).toHaveBeenCalledWith(userData);
    });
  });
});
```

#### Test Data Builders

```javascript
// test/utils/testDataBuilders.js
export class UserBuilder {
  constructor() {
    this.user = {
      id: 'test-id',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      createdAt: new Date(),
      isActive: true,
    };
  }

  withEmail(email) {
    this.user.email = email;
    return this;
  }

  withRole(role) {
    this.user.role = role;
    return this;
  }

  inactive() {
    this.user.isActive = false;
    return this;
  }

  build() {
    return { ...this.user };
  }
}

// Usage in tests
const user = new UserBuilder().withRole('admin').inactive().build();
```

### Integration Testing Patterns

#### API Endpoint Testing

```javascript
describe('POST /api/users', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  it('should create user and return 201', async () => {
    const userData = { email: 'new@example.com', name: 'New User' };

    const response = await request(app).post('/api/users').send(userData).expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      email: userData.email,
      name: userData.name,
      createdAt: expect.any(String),
    });

    // Verify database state
    const savedUser = await User.findById(response.body.id);
    expect(savedUser).toBeTruthy();
  });
});
```

#### Database Transaction Testing

```javascript
describe('User Update Operations', () => {
  let transaction;

  beforeEach(async () => {
    transaction = await startTestTransaction();
  });

  afterEach(async () => {
    await rollbackTransaction(transaction);
  });

  it('should rollback on failure', async () => {
    const userId = await createTestUser(transaction);
    const updateData = { email: 'invalid-email' };

    await expect(userService.updateUser(userId, updateData, { transaction })).rejects.toThrow(
      'Invalid email format',
    );

    // Verify no changes persisted
    const user = await User.findById(userId);
    expect(user.email).not.toBe(updateData.email);
  });
});
```

## Mocking Strategies

### External Service Mocking

```javascript
// __mocks__/externalApi.js
export const callExternalAPI = jest.fn();

export const mockSuccessfulResponse = {
  success: true,
  data: { id: '123', status: 'completed' },
};

export const mockErrorResponse = {
  success: false,
  error: 'Service unavailable',
};

// In test files
import { callExternalAPI, mockSuccessfulResponse } from '../__mocks__/externalApi';

beforeEach(() => {
  callExternalAPI.mockClear();
});

it('should handle successful API call', async () => {
  callExternalAPI.mockResolvedValue(mockSuccessfulResponse);

  const result = await service.processWithExternalAPI(data);

  expect(result.success).toBe(true);
  expect(callExternalAPI).toHaveBeenCalledWith(data);
});
```

### Database Mocking

```javascript
// For unit tests - mock the database layer
jest.mock('../database/connection', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

// For integration tests - use test database
describe('Database Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });
});
```

## Error Testing Patterns

### Synchronous Error Testing

```javascript
describe('ValidationService', () => {
  describe('validateEmail', () => {
    it('should throw ValidationError for invalid email', () => {
      expect(() => {
        validationService.validateEmail('invalid-email');
      }).toThrow(ValidationError);

      expect(() => {
        validationService.validateEmail('invalid-email');
      }).toThrow('Invalid email format');
    });

    it('should throw specific error for empty email', () => {
      expect(() => {
        validationService.validateEmail('');
      }).toThrow('Email is required');
    });
  });
});
```

### Asynchronous Error Testing

```javascript
describe('AsyncService', () => {
  describe('processData', () => {
    it('should reject with ProcessingError for invalid data', async () => {
      const invalidData = { type: 'invalid' };

      await expect(asyncService.processData(invalidData)).rejects.toThrow(ProcessingError);

      await expect(asyncService.processData(invalidData)).rejects.toThrow('Invalid data type');
    });

    it('should handle timeout gracefully', async () => {
      jest.useFakeTimers();

      const promise = asyncService.processWithTimeout(largeData);
      jest.advanceTimersByTime(30000); // Past timeout

      await expect(promise).rejects.toThrow('Operation timeout');
    });
  });
});
```

## Performance Testing

### Load Testing Patterns

```javascript
describe('Performance Tests', () => {
  it('should handle 100 concurrent requests within 5 seconds', async () => {
    const requests = Array(100)
      .fill()
      .map(() => request(app).get('/api/data'));

    const startTime = Date.now();
    const responses = await Promise.all(requests);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5000);
    responses.forEach((response) => {
      expect(response.status).toBe(200);
    });
  });

  it('should maintain memory usage under 500MB', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Perform memory-intensive operations
    await performMemoryIntensiveTask();

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024); // 500MB
  });
});
```

## Security Testing Patterns

### Authentication Testing

```javascript
describe('Authentication Middleware', () => {
  it('should allow valid token', async () => {
    const validToken = generateValidToken();
    const user = { id: '123', role: 'user' };

    mockTokenVerification.mockResolvedValue(user);

    const response = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);

    expect(response.body.user).toEqual(user);
  });

  it('should reject expired token', async () => {
    const expiredToken = generateExpiredToken();

    mockTokenVerification.mockRejectedValue(new Error('Token expired'));

    await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });
});
```

### Input Sanitization Testing

```javascript
describe('Input Sanitization', () => {
  it('should prevent XSS attacks', () => {
    const maliciousInput = '<script>alert("xss")</script>';
    const sanitized = sanitizer.sanitize(maliciousInput);

    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('&lt;script&gt;');
  });

  it('should handle SQL injection attempts', async () => {
    const maliciousQuery = "'; DROP TABLE users; --";
    const safeQuery = sqlSanitizer.escape(maliciousQuery);

    // Verify the malicious parts are escaped
    expect(safeQuery).not.toContain("';");
    expect(safeQuery).toContain("\\';");
  });
});
```

## Test Organization Best Practices

### File Structure

```
src/
  components/
    UserComponent.js
    __tests__/
      UserComponent.test.js
      UserComponent.integration.test.js

tests/
  unit/
    utils/
    services/
  integration/
    api/
    database/
  security/
    auth/
    sanitization/
  performance/
    load/
    memory/
```

### Naming Conventions

```javascript
// Unit tests
describe('UserService', () => {
  describe('#createUser', () => {
    it('should create user with valid data', () => {
      // Test implementation
    });

    it('should throw ValidationError for invalid email', () => {
      // Test implementation
    });
  });
});

// Integration tests
describe('POST /api/users', () => {
  it('should create user and return user data', () => {
    // Test implementation
  });
});

// Security tests
describe('Authentication Security', () => {
  it('should prevent brute force attacks', () => {
    // Test implementation
  });
});
```

## Common Testing Utilities

### Custom Matchers

```javascript
// test/utils/customMatchers.js
expect.extend({
  toBeValidEmail(received) {
    const pass = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(received);
    return {
      message: () => `expected ${received} to be a valid email`,
      pass,
    };
  },

  toBeValidUUID(received) {
    const pass = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      received,
    );
    return {
      message: () => `expected ${received} to be a valid UUID`,
      pass,
    };
  },
});

// Usage
expect(email).toBeValidEmail();
expect(userId).toBeValidUUID();
```

### Test Helpers

```javascript
// test/utils/testHelpers.js
export const createAuthenticatedRequest = (token) => {
  return request(app).set('Authorization', `Bearer ${token}`);
};

export const createTestUser = async (overrides = {}) => {
  const defaultUser = {
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    role: 'user',
  };

  return await User.create({ ...defaultUser, ...overrides });
};

export const cleanupTestData = async () => {
  await User.deleteMany({ email: /test-/ });
  await OtherModel.deleteMany({ createdAt: { $lt: new Date() } });
};
```

## CI/CD Integration

### Coverage Gates

```yaml
# .github/workflows/test.yml
- name: Run Tests with Coverage
  run: npm run test:coverage

- name: Check Coverage Thresholds
  run: |
    npx jest --coverage --coverageThreshold='{
      "global": {
        "branches": 80,
        "functions": 85,
        "lines": 85,
        "statements": 85
      }
    }'
```

### Automated Reporting

```javascript
// scripts/coverageReporter.js
const { execSync } = require('child_process');

function generateCoverageReport() {
  try {
    execSync('npm run test:coverage', { stdio: 'inherit' });

    const coverage = require('../coverage/coverage-summary.json');

    console.log('Coverage Report:');
    console.log(`Lines: ${coverage.total.lines.pct}%`);
    console.log(`Functions: ${coverage.total.functions.pct}%`);
    console.log(`Branches: ${coverage.total.branches.pct}%`);

    // Send to monitoring system
    sendToMonitoring(coverage);
  } catch (error) {
    console.error('Coverage check failed:', error.message);
    process.exit(1);
  }
}
```

## Troubleshooting Quick Reference

### Coverage Not Updating

1. Clear Jest cache: `npx jest --clearCache`
2. Delete coverage directory: `rm -rf coverage/`
3. Check test file patterns in Jest config
4. Verify test files are being executed

### Tests Running Slowly

1. Use `--runInBand` for debugging
2. Mock heavy dependencies
3. Use `beforeAll` instead of `beforeEach` when possible
4. Parallelize independent test suites

### Flaky Tests

1. Avoid random data in tests
2. Use proper cleanup in `afterEach`
3. Mock external services consistently
4. Add retry logic for network-dependent tests

### Mock Issues

1. Reset mocks between tests
2. Use `mockResolvedValue` for promises
3. Verify mock calls with `toHaveBeenCalledWith`
4. Check mock implementation matches real behavior

## Resources

### Documentation

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/)
- [Coverage Scenarios](../testing/coverage-scenarios.md)
- [Maintenance Guide](../testing/coverage-maintenance-guide.md)

### Tools

- **Jest**: Testing framework
- **Supertest**: HTTP endpoint testing
- **Nock**: HTTP request mocking
- **Mockery**: Module mocking

### Community

- **Kent C. Dodds**: Testing blog and courses
- **Testing JavaScript**: Newsletter and resources
- **Jest Community**: Forums and discussions
