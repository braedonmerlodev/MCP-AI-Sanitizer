#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PERFORMANCE_LOG = path.join(__dirname, '..', 'performance.log');

// Performance thresholds (in milliseconds)
const UNIT_TESTS_THRESHOLD = 30000; // 30 seconds for unit tests
const INTEGRATION_TESTS_THRESHOLD = 120000; // 2 minutes for integration tests

function runUnitTests() {
  const start = Date.now();
  try {
    execSync('npx jest src/tests/unit/health.test.js --coverage --silent --testTimeout=30000', {
      stdio: 'ignore',
      timeout: 60000,
    });
    const end = Date.now();
    return end - start;
  } catch (error) {
    console.error('Unit test run failed:', error.message);
    return null;
  }
}

function runIntegrationTests() {
  const start = Date.now();
  try {
    execSync(
      'npx jest src/tests/integration/destination-tracking.test.js --coverage --silent --testTimeout=60000',
      { stdio: 'ignore', timeout: 120000 },
    );
    const end = Date.now();
    return end - start;
  } catch (error) {
    console.error('Integration test run failed:', error.message);
    return null;
  }
}

function main() {
  console.log('Running performance measurement...');

  // Run unit tests
  console.log('Testing unit test performance...');
  const unitTime = runUnitTests();
  if (unitTime === null) {
    console.error('Unit tests failed');
    process.exit(1);
  }
  console.log(`Unit tests completed in ${(unitTime / 1000).toFixed(2)}s`);

  // Run integration tests
  console.log('Testing integration test performance...');
  const integrationTime = runIntegrationTests();
  if (integrationTime === null) {
    console.error('Integration tests failed');
    process.exit(1);
  }
  console.log(`Integration tests completed in ${(integrationTime / 1000).toFixed(2)}s`);

  const result = {
    timestamp: new Date().toISOString(),
    unitTestTimeMs: unitTime,
    integrationTestTimeMs: integrationTime,
    unitTestThresholdMs: UNIT_TESTS_THRESHOLD,
    integrationTestThresholdMs: INTEGRATION_TESTS_THRESHOLD,
  };

  // Log to file
  const logEntry = JSON.stringify(result) + '\n';
  fs.appendFileSync(PERFORMANCE_LOG, logEntry);

  console.log('\nPerformance Results:');
  console.log(
    `Unit tests: ${(unitTime / 1000).toFixed(2)}s (threshold: ${UNIT_TESTS_THRESHOLD / 1000}s)`,
  );
  console.log(
    `Integration tests: ${(integrationTime / 1000).toFixed(2)}s (threshold: ${INTEGRATION_TESTS_THRESHOLD / 1000}s)`,
  );

  // Check thresholds
  let passed = true;
  if (unitTime > UNIT_TESTS_THRESHOLD) {
    console.warn(
      `⚠️  Unit test performance degraded: ${(unitTime / 1000).toFixed(2)}s exceeds ${UNIT_TESTS_THRESHOLD / 1000}s threshold`,
    );
    passed = false;
  }
  if (integrationTime > INTEGRATION_TESTS_THRESHOLD) {
    console.warn(
      `⚠️  Integration test performance degraded: ${(integrationTime / 1000).toFixed(2)}s exceeds ${INTEGRATION_TESTS_THRESHOLD / 1000}s threshold`,
    );
    passed = false;
  }

  if (passed) {
    console.log('✅ All performance checks passed');
  } else {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
