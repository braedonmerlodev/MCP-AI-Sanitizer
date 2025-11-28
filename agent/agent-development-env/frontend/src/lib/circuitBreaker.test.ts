import { CircuitBreaker, CircuitState } from './circuitBreaker'

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker

  beforeEach(() => {
    cb = new CircuitBreaker()
  })

  it('starts in closed state', () => {
    expect(cb.getState()).toBe(CircuitState.CLOSED)
    expect(cb.isOpen()).toBe(false)
  })

  it('records success and stays closed', () => {
    cb.recordSuccess()
    expect(cb.getState()).toBe(CircuitState.CLOSED)
  })

  it('opens after failure threshold', () => {
    for (let i = 0; i < 5; i++) {
      cb.recordFailure()
    }
    expect(cb.getState()).toBe(CircuitState.OPEN)
    expect(cb.isOpen()).toBe(true)
  })

  it('transitions to half-open after timeout', () => {
    for (let i = 0; i < 5; i++) {
      cb.recordFailure()
    }
    expect(cb.isOpen()).toBe(true)

    // Mock time passing
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000)
    expect(cb.isOpen()).toBe(false)
    expect(cb.getState()).toBe(CircuitState.HALF_OPEN)
  })

  it('closes on success in half-open', () => {
    for (let i = 0; i < 5; i++) {
      cb.recordFailure()
    }
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000)
    cb.recordSuccess()
    expect(cb.getState()).toBe(CircuitState.CLOSED)
  })

  it('re-opens on failure in half-open', () => {
    for (let i = 0; i < 5; i++) {
      cb.recordFailure()
    }
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000)
    cb.recordFailure()
    expect(cb.getState()).toBe(CircuitState.OPEN)
  })
})
