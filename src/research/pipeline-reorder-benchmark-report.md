# Pipeline Reorder Performance Benchmark Report

Generated: 2025-12-05T22:41:10.849Z

## Executive Summary

This report presents comprehensive performance benchmarking results comparing the baseline pipeline (AI → Sanitization) with the reordered pipeline (Sanitization → AI).

**Key Findings:**

- Overall Performance Impact: +1.1%
- Maximum Concurrency Throughput Improvement: 10.2%
- Average Response Time Improvement: 1.9%

## Test Configuration

- Iterations per benchmark: 100
- Concurrency levels tested: 1, 5, 10
- Data sets tested: 6 (ranging from 49 to 51750 characters)

## Performance Results by Data Set

| Data Set         | Description                                   | Performance Change | P95 Change | Assessment             |
| ---------------- | --------------------------------------------- | ------------------ | ---------- | ---------------------- |
| small-clean      | Small clean HTML content                      | 0.3%               | 3.2%       | neutral                |
| small-malicious  | Small content with script injection           | 1.5%               | 13.0%      | significant regression |
| medium-clean     | Medium clean HTML content                     | 1.5%               | 1.8%       | neutral                |
| medium-malicious | Medium content with multiple threats          | 0.3%               | 0.1%       | neutral                |
| large-clean      | Large clean HTML content (50KB)               | -0.1%              | -0.5%      | neutral                |
| large-malicious  | Large content with distributed threats (25KB) | -6.7%              | -6.3%      | moderate improvement   |

## Concurrency Performance Results

| Concurrency | Baseline Throughput | Reordered Throughput | Improvement |
| ----------- | ------------------- | -------------------- | ----------- |
| 1           | 8724 ops/sec        | 8756 ops/sec         | 0.4%        |
| 5           | 36610 ops/sec       | 40356 ops/sec        | 10.2%       |
| 10          | 76806 ops/sec       | 73816 ops/sec        | -3.9%       |

## Detailed Analysis

### Performance Impact Assessment

**Neutral Impact**: Pipeline reordering has minimal performance impact.

### Recommendations

- Pipeline reordering has neutral performance impact - evaluate based on security benefits
- Performance regression detected for: small-malicious - investigate optimization opportunities

## Test Environment

- Node.js version: v22.21.0
- Platform: linux x64
- Memory: 50MB heap used
- CPU: 16 cores

## Raw Data

Complete benchmark results are available in the accompanying JSON file.
