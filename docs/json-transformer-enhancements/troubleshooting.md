# JSONTransformer Troubleshooting Guide

## Overview

This guide helps diagnose and resolve common issues with JSONTransformer enhancements. Follow the systematic approach to identify and fix problems.

## Common Issues and Solutions

### 1. Regex Filtering Not Working

**Symptoms**:

- Fields not being removed as expected
- Regex patterns matching unexpected fields

**Diagnosis**:

```javascript
// Test your regex pattern separately
const pattern = /.*_temp$/;
console.log(pattern.test('field_temp')); // Should be true
console.log(pattern.test('field')); // Should be false
```

**Common Causes**:

- Incorrect regex syntax
- Case sensitivity issues
- Anchors not used properly (^ and $)

**Solutions**:

```javascript
// Case-insensitive matching
removeFields(data, [/.*_temp$/i]);

// Exact field name matching
removeFields(data, ['exactFieldName']);

// Multiple patterns
removeFields(data, ['field1', /pattern1/, /pattern2/]);
```

### 2. Type Coercion Failures

**Symptoms**:

- Values not converting as expected
- Console warnings about coercion failures

**Diagnosis**:

```javascript
// Check input data format
console.log(typeof data.field); // Should match expected type
console.log(data.field); // Check actual value
```

**Common Causes**:

- Invalid input format for target type
- Unsupported date formats
- Non-numeric strings for number coercion

**Solutions**:

```javascript
// Validate input before coercion
const validData = {
  age: '25', // Valid for number
  active: 'true', // Valid for boolean
  date: '2023-01-15', // Valid ISO date
};

// Use strict mode for critical validations
globalThis.TRANSFORM_STRICT_MODE = true; // Throws on coercion errors
```

### 3. Caching Not Improving Performance

**Symptoms**:

- No performance improvement with caching enabled
- Cache hit rate remains low

**Diagnosis**:

```javascript
// Monitor cache usage
console.log('Cache size:', transformationCache.size);
console.log('Cache keys:', Array.from(transformationCache.keys()));
```

**Common Causes**:

- Unique data patterns preventing cache hits
- Changing transformation parameters
- Small cache size

**Solutions**:

```javascript
// Ensure consistent parameters
const options = { useCache: true };
normalizeKeys(data1, 'camelCase', options); // Cache miss
normalizeKeys(data2, 'camelCase', options); // Cache hit

// Increase cache size if needed
// Note: Default is 100, increase only if necessary
```

### 4. Memory Issues

**Symptoms**:

- Increasing memory usage over time
- Application slowdowns
- Out of memory errors

**Diagnosis**:

```javascript
// Monitor memory usage
const memUsage = process.memoryUsage();
console.log('Heap used:', Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB');
console.log('Heap total:', Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB');
```

**Common Causes**:

- Large input data
- Excessive caching
- Memory leaks in application code

**Solutions**:

```javascript
// Process large data in chunks
function processLargeData(data) {
  const chunks = splitIntoChunks(data, 1000); // Process 1000 items at a time
  return chunks.map((chunk) => transform(chunk));
}

// Monitor and limit cache size
// Default cache size is appropriate for most use cases
```

### 5. API Integration Problems

**Symptoms**:

- 400 Bad Request errors
- Unexpected response format
- Transform options not applied

**Diagnosis**:

```javascript
// Test API endpoint directly
const response = await fetch('/api/sanitize/json', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: testData,
    transformOptions: testOptions,
  }),
});
console.log('Status:', response.status);
console.log('Response:', await response.json());
```

**Common Causes**:

- Invalid transformOptions format
- Missing required fields
- Incorrect API endpoint

**Solutions**:

```javascript
// Validate transformOptions structure
const validOptions = {
  filters: [{ pattern: 'field', type: 'exclude' }],
  coercion: {
    fieldName: 'type',
  },
  preset: 'presetName',
};

// Check API response for error details
if (response.status === 400) {
  const error = await response.json();
  console.log('API Error:', error.error);
}
```

## Debug Mode

### Enabling Debug Logging

```javascript
// Enable detailed logging
process.env.DEBUG_TRANSFORM = 'true';
process.env.TRANSFORM_LOG_LEVEL = 'debug';

// This will log:
// - Cache hits/misses
// - Transformation steps
// - Performance metrics
// - Warning messages
```

### Debug Output Example

```
[DEBUG] Cache miss for normalizeKeys_camelCase_1234
[DEBUG] Applying camelCase transformation
[DEBUG] Transformation completed in 0.15ms
[WARN] Type coercion warning: Cannot coerce 'invalid' to number
```

## Performance Troubleshooting

### Slow Response Times

**Check List**:

1. Is caching enabled? `{ useCache: true }`
2. Are regex patterns overly complex?
3. Is input data excessively large?
4. Are there nested object performance issues?

**Quick Fixes**:

```javascript
// Enable caching
transform(data, options, { useCache: true });

// Simplify patterns
removeFields(data, ['simpleField']); // Instead of complex regex

// Process in chunks for large data
const chunks = splitArray(data, 100);
const results = chunks.map((chunk) => transform(chunk));
```

### High CPU Usage

**Symptoms**: CPU spikes during transformation

**Causes**:

- Complex regex patterns
- Deep recursion on nested objects
- Large dataset processing

**Solutions**:

```javascript
// Use simpler patterns
removeFields(data, ['field1', 'field2']); // Exact matches

// Limit recursion depth
function safeTransform(data, maxDepth = 10) {
  // Implementation with depth checking
}
```

## Error Messages Reference

### Common Error Messages

| Error Message                                     | Cause                   | Solution                                                    |
| ------------------------------------------------- | ----------------------- | ----------------------------------------------------------- |
| `normalizeKeys: targetCase parameter is required` | Missing case parameter  | Provide valid case: 'camelCase', 'snake_case', etc.         |
| `removeFields: patterns must be an array`         | Invalid patterns format | Pass array of strings/regex                                 |
| `coerceTypes: typeMap must be an object`          | Invalid type mapping    | Provide object with field->type mapping                     |
| `Unknown preset 'name'`                           | Invalid preset name     | Use: aiProcessing, apiResponse, dataExport, databaseStorage |

### Warning Messages

| Warning                                   | Meaning                | Action                                            |
| ----------------------------------------- | ---------------------- | ------------------------------------------------- |
| `Type coercion warning: Cannot coerce...` | Invalid value for type | Check input data format                           |
| `Cache full, evicting oldest entry`       | Cache limit reached    | Consider increasing cache size or reviewing usage |

## Testing Your Fixes

### Unit Testing

```javascript
// Test your transformations
const { expect } = require('chai');
const { removeFields, coerceTypes } = require('./utils/jsonTransformer');

describe('My Transformations', () => {
  it('should remove temp fields', () => {
    const result = removeFields(testData, [/.*_temp$/]);
    expect(result).to.not.have.property('field_temp');
  });

  it('should coerce types correctly', () => {
    const result = coerceTypes(testData, { age: 'number' });
    expect(typeof result.age).to.equal('number');
  });
});
```

### Integration Testing

```javascript
// Test API integration
const request = require('supertest');
const app = require('./app');

describe('API Integration', () => {
  it('should transform data correctly', async () => {
    const response = await request(app)
      .post('/api/sanitize/json')
      .send({
        data: testData,
        transformOptions: testOptions,
      })
      .expect(200);

    expect(response.body.transformed).to.deep.equal(expectedResult);
  });
});
```

## Getting Help

If you continue to experience issues:

1. **Check Documentation**: Review this troubleshooting guide and API documentation
2. **Enable Debug Mode**: Get detailed logging information
3. **Test Incrementally**: Isolate the problematic transformation
4. **Review Input Data**: Ensure data format matches expectations
5. **Contact Support**: Provide debug logs and test cases

## Prevention Best Practices

- **Validate Input**: Always validate data before transformation
- **Test Transformations**: Unit test your transformation logic
- **Monitor Performance**: Track metrics in production
- **Use Appropriate Patterns**: Choose the right tool for the job
- **Keep Updated**: Use latest version for bug fixes and improvements
