# JobStatusController Uncovered Lines Detailed Identification

## Executive Summary

This report provides detailed identification and analysis of uncovered lines in `src/controllers/jobStatusController.js`, building on the coverage analysis from substory 1.12.3.3.4.2.3.1. Current coverage: **76%** (76/100 lines).

Analysis completed on: 2025-11-22

## State Transition Analysis

### Valid State Machine

**States**: `queued` → `processing` → `completed` | `failed` | `cancelled`

**State Definitions**:

- `queued`: Job submitted but not yet started
- `processing`: Job actively being processed
- `completed`: Job finished successfully
- `failed`: Job encountered an error
- `cancelled`: Job was cancelled or deleted

**Valid Transitions**:

1. `queued` → `processing` (job starts)
2. `processing` → `completed` (successful completion)
3. `processing` → `failed` (error during processing)
4. `queued` → `cancelled` (cancelled before processing)
5. `processing` → `cancelled` (cancelled during processing)
6. `completed` → `cancelled` (marked as deleted)
7. `failed` → `cancelled` (marked as deleted)
8. `cancelled` → `cancelled` (already cancelled, treated as deletion)

**Invalid Transitions**:

- `completed` → `processing`
- `failed` → `processing`
- `cancelled` → `processing`
- Any transition to unknown states

### Concurrent Update Scenarios

**Race Conditions**:

1. Multiple status updates to same job
2. Status check during transition
3. Result retrieval during status update
4. Cancellation during result caching

## Detailed Uncovered Lines Analysis

### 1. Status Message Generation (getStatus method)

#### Lines 46-47: Queued Status Message

```javascript
case 'queued': {
  message = 'Queued for processing...';
  break;
}
```

**Coverage**: Covered in existing tests
**Risk Level**: Low
**Functional Area**: UI/UX - Status display

#### Lines 50-53: Processing Status Message

```javascript
case 'processing': {
  message = jobStatus.currentStep
    ? `Processing: ${jobStatus.currentStep}...`
    : 'Processing...';
  break;
}
```

**Coverage**: Partially covered (line 52 not covered)
**Risk Level**: Low
**Functional Area**: UI/UX - Status display with step information

#### Lines 56-57: Completed Status Message

```javascript
case 'completed': {
  message = 'Completed successfully';
  break;
}
```

**Coverage**: Covered
**Risk Level**: Low
**Functional Area**: UI/UX - Success confirmation

#### Lines 60-61: Failed Status Message

```javascript
case 'failed': {
  message = jobStatus.errorMessage || 'Processing failed';
  break;
}
```

**Coverage**: Covered (line 61 not covered - fallback message)
**Risk Level**: Medium
**Functional Area**: Error handling - User-friendly error messages

#### Lines 64-65: Cancelled Status Message

```javascript
case 'cancelled': {
  message = 'Job cancelled';
  break;
}
```

**Coverage**: Not covered
**Risk Level**: Medium
**Functional Area**: UI/UX - Cancellation confirmation

#### Lines 67-69: Unknown Status Default Case

```javascript
default: {
  message = 'Unknown status';
}
```

**Coverage**: Not covered
**Risk Level**: High
**Functional Area**: Data integrity - Invalid state handling

### 2. Error Handling Paths

#### Lines 105-106: getStatus Error Handler

```javascript
} catch (err) {
  logger.error('Error retrieving job status', { taskId, error: err.message });
  res.status(500).json({ error: 'Failed to retrieve job status' });
}
```

**Coverage**: Not covered
**Risk Level**: High
**Functional Area**: Error handling - Database failures

#### Lines 121-122: getResult Job Not Found

```javascript
logger.warn('Job status not found', { taskId });
return res.status(404).json({
```

**Coverage**: Covered in existing tests
**Risk Level**: Low
**Functional Area**: Error handling - Missing job detection

#### Lines 131: getResult Status Loaded Log

```javascript
logger.info('Job status loaded', { taskId, status: jobStatus.status });
```

**Coverage**: Covered
**Risk Level**: Low
**Functional Area**: Logging - Debug information

#### Lines 157-163: Job Result Fallback Logic

```javascript
} else if (jobStatus.result) {
  // Fallback to job status result and cache it
  resultData = jobStatus.result;
  jobResult = new JobResult({
    jobId: taskId,
    result: resultData,
  });
  await jobResult.save();
  logger.info('Job result cached', { taskId });
}
```

**Coverage**: Not covered (lines 157, 158, 162, 163)
**Risk Level**: Medium
**Functional Area**: Data recovery - Result caching fallback

#### Line 184: Result Size Calculation Error

```javascript
resultSize = 0;
```

**Coverage**: Not covered
**Risk Level**: Low
**Functional Area**: Error handling - JSON serialization failures

#### Lines 195-196: getResult Error Handler

```javascript
} catch (err) {
  logger.error('Error retrieving job result', { taskId, error: err.message });
  res.status(500).json({ error: 'Failed to retrieve job result' });
}
```

**Coverage**: Not covered
**Risk Level**: High
**Functional Area**: Error handling - Result retrieval failures

#### Line 210: No Result Available

```javascript
return res.status(404).json({
  error: 'No result available',
  taskId,
});
```

**Coverage**: Covered
**Risk Level**: Low
**Functional Area**: Error handling - Missing results

#### Line 218: Job Action Logging

```javascript
logger.info(`Job ${action}`, { taskId, previousStatus: jobStatus.status });
```

**Coverage**: Covered
**Risk Level**: Low
**Functional Area**: Logging - Action confirmation

#### Lines 244-245: Job Result Expiration

```javascript
jobResult.expiresAt = new Date().toISOString();
await jobResult.save();
```

**Coverage**: Not covered
**Risk Level**: Medium
**Functional Area**: Data cleanup - Result deletion

#### Line 249: Result Deletion Error Handling

```javascript
logger.warn('Could not delete job result', { taskId, error: resultError.message });
```

**Coverage**: Not covered
**Risk Level**: Low
**Functional Area**: Error handling - Cleanup failures

#### Lines 261-262: cancelJob Error Handler

```javascript
} catch (err) {
  logger.error('Error cancelling/deleting job', { taskId, error: err.message });
  res.status(500).json({ error: 'Failed to cancel/delete job' });
}
```

**Coverage**: Not covered
**Risk Level**: High
**Functional Area**: Error handling - Cancellation failures

## Risk Assessment Matrix

### High Risk (Security/Critical Reliability)

1. **Unknown Status Default Case** (Lines 67-69)
   - **Business Impact**: Data corruption could expose "Unknown status" to users
   - **Security Impact**: Indicates potential database integrity issues
   - **Test Complexity**: Medium (requires invalid status injection)

2. **Error Handlers** (Lines 105-106, 195-196, 261-262)
   - **Business Impact**: Unhandled exceptions could crash API
   - **Security Impact**: Information disclosure through uncaught errors
   - **Test Complexity**: High (requires error simulation)

### Medium Risk (Functional Reliability)

3. **Job Result Fallback** (Lines 157-163)
   - **Business Impact**: Results might not be cached in failure scenarios
   - **Security Impact**: Potential data loss
   - **Test Complexity**: Medium (mock JobResult.load failure)

4. **Cancelled Status Message** (Lines 64-65)
   - **Business Impact**: Incorrect user feedback for cancellations
   - **Security Impact**: None
   - **Test Complexity**: Low (standard status test)

5. **Job Result Cleanup** (Lines 244-245)
   - **Business Impact**: Orphaned result data accumulation
   - **Security Impact**: Potential data leakage
   - **Test Complexity**: Medium (mock result deletion)

### Low Risk (Edge Cases)

6. **Processing Step Display** (Line 52)
   - **Business Impact**: Less detailed progress information
   - **Security Impact**: None
   - **Test Complexity**: Low (null currentStep test)

7. **Failed Status Fallback Message** (Line 61)
   - **Business Impact**: Generic error message instead of specific
   - **Security Impact**: None
   - **Test Complexity**: Low (null errorMessage test)

8. **Result Size Error Handling** (Line 184)
   - **Business Impact**: Incorrect size reporting for complex objects
   - **Security Impact**: None
   - **Test Complexity**: Low (circular reference test)

## Prioritized Test Implementation Roadmap

### Phase 1: High Risk (Immediate Priority)

1. Unknown status handling test
2. Comprehensive error handler tests (all 3 methods)
3. Total estimated effort: 4-6 hours

### Phase 2: Medium Risk (Week 1)

4. Job result fallback caching test
5. Cancelled status message test
6. Job result cleanup test
7. Total estimated effort: 3-4 hours

### Phase 3: Low Risk (Week 2)

8. Processing step display test
9. Failed status fallback message test
10. Result size error handling test
11. Total estimated effort: 2-3 hours

## Integration with Existing Test Suite

**Test Patterns to Follow**:

- Use existing Jest/supertest patterns from `src/tests/unit/jobStatusApi.test.js`
- Mock JobStatus and JobResult using existing mocking strategies
- Follow error simulation patterns (e.g., JobResult.load.rejects())

**Expected Coverage Improvement**:

- Phase 1: +8-10% coverage (24 additional lines)
- Phase 2: +4-6% coverage (12 additional lines)
- Phase 3: +2-3% coverage (6 additional lines)
- **Total Target**: 90%+ coverage with comprehensive error and edge case handling

## Conclusion

This detailed identification provides a clear roadmap for achieving the 5% minimum coverage improvement required by the parent story. The analysis prioritizes security and reliability concerns while maintaining the brownfield context of preserving existing functionality.
