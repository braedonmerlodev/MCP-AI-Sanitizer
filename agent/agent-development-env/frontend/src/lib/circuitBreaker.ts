export const CircuitState = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half-open',
} as const

export type CircuitState = (typeof CircuitState)[keyof typeof CircuitState]

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount = 0
  private nextAttemptTime = 0

  private readonly failureThreshold = 5
  private readonly timeout = 60000 // 60 seconds

  isOpen(): boolean {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() > this.nextAttemptTime) {
        this.state = CircuitState.HALF_OPEN
        return false
      }
      return true
    }
    return false
  }

  recordSuccess(): void {
    this.failureCount = 0
    this.state = CircuitState.CLOSED
  }

  recordFailure(): void {
    this.failureCount++

    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN
      this.nextAttemptTime = Date.now() + this.timeout
    }
  }

  getState(): CircuitState {
    return this.state
  }
}

// Global circuit breaker instance
export const globalCircuitBreaker = new CircuitBreaker()
