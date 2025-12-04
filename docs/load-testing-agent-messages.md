# Agent Message Load Testing

This directory contains load testing scenarios for validating the agent message system's performance under concurrent load conditions.

## Overview

The load testing suite validates that the agent message integration maintains <5% performance overhead when handling 100+ simultaneous connections and message generation.

## Test Scenarios

### 1. Concurrent PDF Upload with Agent Messages (70% load)

- Tests PDF upload processing that triggers agent message generation
- Validates job status tracking under concurrent load
- Ensures agent messages are properly queued and delivered

### 2. Rapid Sanitization Requests (20% load)

- Tests sanitization API performance with trust token generation
- Validates concurrent sanitization processing
- Ensures trust token validation doesn't degrade under load

### 3. Mixed Load with Message Broadcasting (10% load)

- Tests combined PDF upload and sanitization workflows
- Validates system stability under mixed operation patterns
- Ensures proper resource allocation across different operations

## Load Phases

1. **Warm-up** (60s): 5 requests/second - System stabilization
2. **Main Load** (300s): 20 requests/second - Sustained concurrent load (100+ connections)
3. **Peak Load** (120s): 50 requests/second - Maximum capacity testing
4. **Cool-down** (60s): 5 requests/second - System recovery validation

## Performance Baselines

| Metric                | Baseline     | Description                   |
| --------------------- | ------------ | ----------------------------- |
| Average Response Time | ≤ 200ms      | Overall system responsiveness |
| Maximum Response Time | ≤ 1000ms     | Worst-case performance        |
| Error Rate            | ≤ 5%         | System reliability            |
| Throughput            | ≥ 10 req/sec | Minimum processing capacity   |

## Running Load Tests

### Prerequisites

1. Start the MCP Security server: `npm start`
2. Ensure server is healthy: `curl http://localhost:3000/api/monitoring/metrics`

### Execute Load Tests

```bash
# Run complete load test suite
npm run test:load

# Or run Artillery directly
npx artillery run load-test-agent-messages.yml
```

### View Results

- Results are saved in `load-test-results/` directory
- JSON reports contain detailed metrics
- Markdown reports provide executive summaries
- Check console output for real-time progress

## Monitoring During Tests

The load tests include:

- **Real-time metrics** via Artillery console output
- **Endpoint-specific metrics** for API performance analysis
- **Error tracking** with detailed failure analysis
- **Performance histograms** for response time distribution

## Interpreting Results

### Success Criteria

- All performance baselines met
- Error rate within acceptable limits
- System remains stable under peak load
- No memory leaks or resource exhaustion

### Common Issues

- **High response times**: Check PDF processing pipeline
- **High error rates**: Investigate WebSocket connection handling
- **Low throughput**: Review database connection pooling
- **Memory issues**: Monitor agent message queue size

## Configuration

### Modifying Load Patterns

Edit `load-test-agent-messages.yml` to adjust:

- Request arrival rates
- Test duration
- Scenario weights
- Custom test data

### Environment Variables

```bash
# DataDog monitoring (optional)
export DATADOG_API_KEY=your_api_key
export DATADOG_APP_KEY=your_app_key
```

## Troubleshooting

### Server Not Responding

```bash
# Check server status
curl http://localhost:3000/api/monitoring/metrics

# Restart server
npm start
```

### High Error Rates

- Check server logs for error details
- Verify database connections
- Monitor system resources (CPU, memory)

### Inconsistent Results

- Ensure clean test environment
- Disable other load on the system
- Run tests multiple times for consistency

## Integration with CI/CD

Add to your CI pipeline:

```yaml
- name: Load Test Agent Messages
  run: npm run test:load
  continue-on-error: true
```

## Performance Optimization

Based on load test results, consider:

- Database query optimization
- Caching layer implementation
- Horizontal scaling configuration
- Message queue tuning
- WebSocket connection pooling
