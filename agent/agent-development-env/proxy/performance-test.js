const { app, clearCaches } = require('./proxy');

// Performance testing for trust token overhead
// This script measures the performance impact of trust token processing

const request = require('supertest');

async function runPerformanceTests() {
  console.log('🚀 Running Trust Token Performance Tests...\n');

  // Clear caches for consistent testing
  clearCaches();

  const testData = { pdf: 'test pdf content for performance testing' };
  const validToken = 'valid-performance-test-token-123';
  const iterations = 100;

  console.log(`Running ${iterations} requests with trust token validation...`);

  // Test with trust token
  const startWithToken = Date.now();
  const promisesWithToken = [];

  for (let i = 0; i < iterations; i++) {
    promisesWithToken.push(
      request(app).post('/api/process-pdf').set('X-Trust-Token', validToken).send(testData),
    );
  }

  await Promise.all(promisesWithToken);
  const endWithToken = Date.now();
  const avgWithToken = (endWithToken - startWithToken) / iterations;

  console.log(`✅ Average response time with trust token: ${avgWithToken.toFixed(2)}ms`);

  // Clear caches
  clearCaches();

  // Test without trust token
  const startWithoutToken = Date.now();
  const promisesWithoutToken = [];

  for (let i = 0; i < iterations; i++) {
    promisesWithoutToken.push(request(app).post('/api/process-pdf').send(testData));
  }

  await Promise.all(promisesWithoutToken);
  const endWithoutToken = Date.now();
  const avgWithoutToken = (endWithoutToken - startWithoutToken) / iterations;

  console.log(`✅ Average response time without trust token: ${avgWithoutToken.toFixed(2)}ms`);

  // Calculate overhead
  const overhead = avgWithToken - avgWithoutToken;
  const overheadPercent = ((overhead / avgWithoutToken) * 100).toFixed(2);

  console.log(`📊 Trust token processing overhead: ${overhead.toFixed(2)}ms (${overheadPercent}%)`);

  // Performance assertions
  const maxAcceptableOverhead = 50; // ms
  const maxAcceptablePercent = 25; // %

  if (overhead > maxAcceptableOverhead) {
    console.log(`⚠️  WARNING: Trust token overhead exceeds ${maxAcceptableOverhead}ms threshold`);
  } else {
    console.log(
      `✅ Trust token overhead is within acceptable limits (< ${maxAcceptableOverhead}ms)`,
    );
  }

  if (parseFloat(overheadPercent) > maxAcceptablePercent) {
    console.log(`⚠️  WARNING: Trust token overhead exceeds ${maxAcceptablePercent}% threshold`);
  } else {
    console.log(
      `✅ Trust token overhead percentage is within acceptable limits (< ${maxAcceptablePercent}%)`,
    );
  }

  // Cache hit performance test
  console.log('\n🧪 Testing cache performance...');

  clearCaches();

  // First request (cache miss)
  await request(app).post('/api/process-pdf').set('X-Trust-Token', validToken).send(testData);

  const cacheTestIterations = 50;
  const cacheStart = Date.now();

  for (let i = 0; i < cacheTestIterations; i++) {
    await request(app).post('/api/process-pdf').set('X-Trust-Token', validToken).send(testData);
  }

  const cacheEnd = Date.now();
  const avgCacheHit = (cacheEnd - cacheStart) / cacheTestIterations;

  console.log(`✅ Average cache hit response time: ${avgCacheHit.toFixed(2)}ms`);

  const maxCacheHitTime = 10; // ms
  if (avgCacheHit > maxCacheHitTime) {
    console.log(`⚠️  WARNING: Cache hit time exceeds ${maxCacheHitTime}ms threshold`);
  } else {
    console.log(`✅ Cache hit performance is within acceptable limits (< ${maxCacheHitTime}ms)`);
  }

  console.log('\n🎉 Performance testing completed!');
}

// Run tests if called directly
if (require.main === module) {
  runPerformanceTests().catch(console.error);
}

module.exports = { runPerformanceTests };
