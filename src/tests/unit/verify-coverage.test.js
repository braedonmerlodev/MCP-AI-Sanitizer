const { calculateCoverage } = require('../../scripts/verify-coverage');

describe('Coverage Verification', () => {
  test('should calculate coverage correctly for mock data', () => {
    const mockData = {
      'file1.js': {
        statementMap: {
          0: { start: { line: 1 } },
          1: { start: { line: 2 } },
        },
        fnMap: {
          0: {},
        },
        s: { 0: 1, 1: 0 },
        f: { 0: 1 },
        b: { 0: [1, 0] },
      },
    };

    const coverage = calculateCoverage(mockData);

    expect(coverage.statements.pct).toBe(50);
    expect(coverage.functions.pct).toBe(100);
    expect(coverage.branches.pct).toBe(50);
    expect(coverage.lines.pct).toBe(50);
  });

  test('should handle empty data', () => {
    const coverage = calculateCoverage({});

    expect(coverage.statements.pct).toBe(0);
    expect(coverage.functions.pct).toBe(0);
    expect(coverage.branches.pct).toBe(0);
    expect(coverage.lines.pct).toBe(0);
  });
});
