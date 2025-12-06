# Async Processing Concurrency Benchmark Report

Generated: 2025-12-06T01:11:12.131Z

## Executive Summary

This report presents comprehensive concurrency benchmarking results for the reordered pipeline under various load conditions.

**Key Findings:**
- Maximum Throughput: 9848.6 jobs/second
- Optimal Concurrency: 5 concurrent operations
- Efficiency Range: 100.0% - 12158.8%
- Error Rate Range: 0.0% - 0.0%

## Test Configuration

- Concurrency levels tested: 5
- Operations per concurrency level: 25
- Data sets tested: light, medium, heavy
- Total operations: 75

## Concurrency Performance Results

### Throughput by Concurrency Level

| Concurrency | Light Data | Medium Data | Heavy Data | Avg Efficiency |
|-------------|------------|-------------|------------|----------------|
| 5 | 9848.6 | 9230.7 | 3509.1 | NaN% |


## Data Set Performance Analysis

### Throughput by Data Set

| Data Set | 1 Conc | 5 Conc | 10 Conc | 20 Conc | 50 Conc | Avg Efficiency |
|----------|--------|--------|---------|---------|---------|----------------|
| light | 9848.6 | 12158.8% |
| medium | 9230.7 | 11935.9% |
| heavy | 3509.1 | 11658.6% |


## Performance Analysis

### Scalability Assessment
**Excellent Scalability**: System maintains high efficiency under concurrent load.


### Bottleneck Analysis
- **Optimal Performance**: 5 concurrent operations
- **Throughput Peak**: 9848.6 operations/second
- **Efficiency Range**: 100.0% to 12158.8%

### Error Analysis
- **Error Rate Range**: 0.00% to 0.00%
**Low Error Rates**: System handles concurrent load reliably.


## Recommendations
- Optimal concurrency level identified: 5 concurrent operations
- High concurrency efficiency achieved - async processing well optimized

## Test Environment

- Node.js version: v22.21.0
- Platform: linux x64
- Memory: 65MB heap used
- CPU: 16 cores

## Raw Data

Complete benchmark results are available in the accompanying JSON file.
