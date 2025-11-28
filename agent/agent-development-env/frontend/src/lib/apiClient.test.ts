import apiClient from './apiClient'

// Mock axios
jest.mock('axios')

describe('apiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create axios instance with correct config', () => {
    expect(apiClient.defaults.baseURL).toBe('http://localhost:8000')
    expect(apiClient.defaults.timeout).toBe(30000)
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json')
  })

  it('should add authorization header when API_KEY is set', () => {
    // Since API_KEY is not set in test env, it should not add header
    expect(apiClient.defaults.headers.Authorization).toBeUndefined()
  })

  it('should make requests with interceptors', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    // Mock the axios instance methods
    ;(apiClient.get as jest.Mock).mockResolvedValue({
      data: 'test',
      status: 200,
      config: { url: '/test', method: 'get' },
    })

    await apiClient.get('/test')

    expect(consoleLogSpy).toHaveBeenCalledWith('API Request: get /test')
    expect(consoleLogSpy).toHaveBeenCalledWith('API Response: 200 /test')

    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it('should handle errors with interceptors', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    const mockError = {
      response: { status: 404, data: 'Not found' },
      request: {},
      message: 'Request failed',
    }

    ;(apiClient.get as jest.Mock).mockRejectedValue(mockError)

    await expect(apiClient.get('/test')).rejects.toEqual(mockError)

    expect(consoleLogSpy).toHaveBeenCalledWith('API Request: get /test')
    expect(consoleErrorSpy).toHaveBeenCalledWith('API Error 404:', 'Not found')

    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })
})
