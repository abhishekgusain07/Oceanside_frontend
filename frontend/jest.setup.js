import '@testing-library/jest-dom'

// Mock Socket.IO client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    off: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    connected: true,
  })),
  Socket: jest.fn(),
}))

// Mock fetch API
global.fetch = jest.fn()

// Mock MediaRecorder
global.MediaRecorder = jest.fn().mockImplementation(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  addEventListener: jest.fn(),
  ondataavailable: null,
  onstop: null,
  state: 'inactive',
}))

// Mock MediaRecorder.isTypeSupported
global.MediaRecorder.isTypeSupported = jest.fn().mockReturnValue(true)

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [
        { kind: 'video', label: 'Mock Camera', stop: jest.fn() },
        { kind: 'audio', label: 'Mock Microphone', stop: jest.fn() },
      ],
    }),
  },
})

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
})

// Mock window.location
delete window.location
window.location = {
  href: 'http://localhost:3000',
  origin: 'http://localhost:3000',
  reload: jest.fn(),
}

// Suppress console warnings during tests
const originalConsoleWarn = console.warn
console.warn = (...args) => {
  // Suppress specific warnings that are expected during testing
  if (
    args[0]?.includes?.('Warning: ReactDOM.render is no longer supported') ||
    args[0]?.includes?.('Warning: useLayoutEffect does nothing on the server')
  ) {
    return
  }
  originalConsoleWarn(...args)
}