# Trust Token Cache Integration

## Cache Key Format

Cache keys now include trust token information for proper isolation:

```json
{
  "method": "POST",
  "path": "/api/process-pdf",
  "body": {
    /* request body */
  },
  "trustToken": "{format}_{hash}"
}
```

### Trust Token Component

- **Format**: `custom`, `jwt`, `uuid`, or `no_token` for invalid/missing tokens
- **Hash**: First 16 characters of SHA-256 hash of the token (for valid tokens)
- **Example**: `custom_a1b2c3d4e5f6789a`

### Security

- Original trust tokens are never stored in cache keys
- SHA-256 hashing prevents token exposure
- Invalid tokens use consistent `no_token` key

## Cache Invalidation

### By Trust Token

```javascript
// Invalidate all cache entries for a specific trust token
const clearedCount = invalidateCacheByTrustToken(trustToken, validation);
```

### API Endpoint

```bash
# POST /api/cache/invalidate-trust-token
curl -X POST http://localhost:3001/api/cache/invalidate-trust-token \
  -H "Content-Type: application/json" \
  -d '{"trustToken": "your-trust-token-here"}'
```

### Automatic Invalidation

Cache entries are automatically invalidated when:

- Trust token becomes invalid
- Token validation fails
- Manual invalidation is triggered

## Cache Statistics

Enhanced status endpoint includes trust token breakdown:

```json
{
  "cache": {
    "keys": 150,
    "hits": 1200,
    "misses": 300,
    "trustTokenBreakdown": {
      "custom_a1b2c3d4": 45,
      "jwt_b2c3d4e5": 32,
      "no_token": 73
    }
  }
}
```

## Cache Verification Patterns

### Verification Workflow

Cache verification ensures cached content validity before serving:

1. **Cache Hit Detection**: Check if request matches cached entry
2. **Trust Token Validation**: Call backend validation API for trust token
3. **Decision Logic**:
   - ✅ **Valid Token**: Serve cached content immediately
   - ❌ **Invalid Token**: Invalidate all related cache entries, proxy to backend
   - ⚠️ **Validation Error**: Invalidate all related cache entries, proxy to backend

### Verification Performance

- **Validation Cache**: 15-minute TTL reduces API calls
- **Async Processing**: Non-blocking validation calls
- **Error Resilience**: Fallback to fresh processing on failures
- **Audit Logging**: Comprehensive event tracking for compliance

### Security Patterns

- **Zero-Trust Approach**: Every cache hit requires active validation
- **Fail-Safe Design**: Invalid tokens trigger cache clearing
- **Comprehensive Logging**: All verification events are audited
- **Error Isolation**: Validation failures don't expose cached content

## Performance Considerations

- Cache key generation: <1ms overhead
- SHA-256 hashing ensures uniqueness
- Token-based isolation prevents cross-user pollution
- Invalidation operations are optimized for performance
- Cache verification: <10ms overhead with validation caching
