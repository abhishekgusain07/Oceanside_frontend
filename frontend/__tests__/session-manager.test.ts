/**
 * Unit tests for SessionManager
 */
import { SessionManager, SessionState } from '@/lib/session-manager';
import { UploadManager } from '@/lib/upload-manager';
import { Socket } from 'socket.io-client';

// Mock Socket.IO
const mockSocket = {
  connected: true,
  on: jest.fn(),
  emit: jest.fn(),
  off: jest.fn(),
  disconnect: jest.fn(),
} as unknown as jest.Mocked<Socket>;

// Mock UploadManager
const mockUploadManager = {
  getStats: jest.fn().mockReturnValue({
    total: 0,
    uploaded: 0,
    failed: 0,
  }),
  clear: jest.fn(),
} as unknown as jest.Mocked<UploadManager>;

// Mock DOM APIs
Object.defineProperty(document, 'addEventListener', {
  value: jest.fn(),
});

Object.defineProperty(window, 'addEventListener', {
  value: jest.fn(),
});

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockCallbacks: {
    onStateChange: jest.Mock;
    onNetworkIssue: jest.Mock;
    onRecordingComplete: jest.Mock;
    onGuestStateChange: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockCallbacks = {
      onStateChange: jest.fn(),
      onNetworkIssue: jest.fn(),
      onRecordingComplete: jest.fn(),
      onGuestStateChange: jest.fn(),
    };

    sessionManager = new SessionManager(
      'room-123',
      'user-456',
      'host',
      mockCallbacks
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    if (sessionManager) {
      sessionManager.shutdown();
    }
  });

  describe('initialization', () => {
    it('should create session manager with correct initial state', () => {
      const state = sessionManager.getState();

      expect(state.roomId).toBe('room-123');
      expect(state.userId).toBe('user-456');
      expect(state.userType).toBe('host');
      expect(state.isRecording).toBe(false);
      expect(state.connectionStatus).toBe('disconnected');
      expect(state.pendingFinalChunks).toBe(0);
    });

    it('should setup event listeners for browser events', () => {
      expect(window.addEventListener).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );
      expect(window.addEventListener).toHaveBeenCalledWith(
        'pagehide',
        expect.any(Function)
      );
      expect(document.addEventListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );
    });
  });

  describe('initialize', () => {
    it('should initialize with socket and upload manager', () => {
      sessionManager.initialize(mockSocket, mockUploadManager);

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('heartbeat_response', expect.any(Function));
      expect(mockCallbacks.onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionStatus: 'connected',
        })
      );
    });

    it('should start heartbeat when initialized', () => {
      sessionManager.initialize(mockSocket, mockUploadManager);

      // Fast forward past heartbeat interval
      jest.advanceTimersByTime(10000);

      expect(mockSocket.emit).toHaveBeenCalledWith('heartbeat', {
        roomId: 'room-123',
        userId: 'user-456',
        timestamp: expect.any(Number),
        isRecording: false,
      });
    });
  });

  describe('recording management', () => {
    beforeEach(() => {
      sessionManager.initialize(mockSocket, mockUploadManager);
    });

    it('should start recording when socket is connected', () => {
      sessionManager.startRecording();

      const state = sessionManager.getState();
      expect(state.isRecording).toBe(true);
      expect(state.pendingFinalChunks).toBe(0);
      expect(mockCallbacks.onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          isRecording: true,
        })
      );
    });

    it('should not start recording when socket is disconnected', () => {
      // Mock disconnected socket
      (mockSocket as any).connected = false;
      const disconnectedSessionManager = new SessionManager(
        'room-123',
        'user-456',
        'host',
        mockCallbacks
      );
      disconnectedSessionManager.initialize(mockSocket, mockUploadManager);

      disconnectedSessionManager.startRecording();

      const state = disconnectedSessionManager.getState();
      expect(state.isRecording).toBe(false);
    });

    it('should stop recording gracefully', async () => {
      sessionManager.startRecording();
      
      // Mock upload stats
      mockUploadManager.getStats.mockReturnValue({
        total: 5,
        uploaded: 5,
        failed: 0,
      });

      const stopPromise = sessionManager.stopRecording();
      
      // Fast forward to resolve any timeouts
      jest.advanceTimersByTime(11000);
      
      await stopPromise;

      const state = sessionManager.getState();
      expect(state.isRecording).toBe(false);
      expect(mockCallbacks.onRecordingComplete).toHaveBeenCalledWith('room-123', 5);
    });

    it('should handle final chunks during recording stop', async () => {
      sessionManager.startRecording();

      // Add a final chunk
      const finalChunkPromise = Promise.resolve();
      sessionManager.addFinalChunk(finalChunkPromise);

      expect(sessionManager.getState().pendingFinalChunks).toBe(1);

      const stopPromise = sessionManager.stopRecording();
      
      // Fast forward to allow promise resolution
      jest.advanceTimersByTime(100);
      await Promise.resolve(); // Allow microtasks to complete
      
      await stopPromise;

      expect(sessionManager.getState().pendingFinalChunks).toBe(0);
    });

    it('should timeout waiting for final chunks', async () => {
      sessionManager.startRecording();

      // Add a final chunk that never resolves
      const neverResolvingPromise = new Promise(() => {});
      sessionManager.addFinalChunk(neverResolvingPromise);

      const stopPromise = sessionManager.stopRecording();
      
      // Fast forward past the timeout
      jest.advanceTimersByTime(11000);
      
      await stopPromise;

      // Should complete despite the unresolved promise
      expect(sessionManager.getState().isRecording).toBe(false);
    });
  });

  describe('network handling', () => {
    beforeEach(() => {
      sessionManager.initialize(mockSocket, mockUploadManager);
    });

    it('should handle socket connection events', () => {
      // Get the connect event handler
      const connectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];

      expect(connectHandler).toBeDefined();

      // Simulate connection
      connectHandler();

      expect(mockCallbacks.onNetworkIssue).toHaveBeenCalledWith('reconnected');
    });

    it('should handle socket disconnection events', () => {
      // Get the disconnect event handler
      const disconnectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];

      expect(disconnectHandler).toBeDefined();

      // Simulate disconnection
      disconnectHandler('transport close');

      expect(mockCallbacks.onNetworkIssue).toHaveBeenCalledWith('disconnected');
    });

    it('should handle heartbeat responses', () => {
      // Get the heartbeat response handler
      const heartbeatHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'heartbeat_response'
      )?.[1];

      expect(heartbeatHandler).toBeDefined();

      // Simulate heartbeat response
      const timestamp = Date.now();
      heartbeatHandler({ timestamp });

      const state = sessionManager.getState();
      expect(state.lastHeartbeat).toBe(timestamp);
    });

    it('should handle network timeout', () => {
      sessionManager.initialize(mockSocket, mockUploadManager);
      
      // Start heartbeat to trigger timeout timer
      jest.advanceTimersByTime(10000);
      
      // Fast forward past network timeout
      jest.advanceTimersByTime(30000);

      expect(mockCallbacks.onNetworkIssue).toHaveBeenCalledWith('timeout');
    });
  });

  describe('guest management', () => {
    beforeEach(() => {
      sessionManager.initialize(mockSocket, mockUploadManager);
    });

    it('should handle guest joined events', () => {
      // Get the guest_joined event handler
      const guestJoinedHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'guest_joined'
      )?.[1];

      expect(guestJoinedHandler).toBeDefined();

      // Simulate guest joining
      guestJoinedHandler({ guestId: 'guest-123', guestName: 'Test Guest' });

      expect(mockCallbacks.onGuestStateChange).toHaveBeenCalledWith('guest-123', 'joined');
    });

    it('should handle guest left events', () => {
      // Get the guest_left event handler
      const guestLeftHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'guest_left'
      )?.[1];

      expect(guestLeftHandler).toBeDefined();

      // Simulate guest leaving normally
      guestLeftHandler({ guestId: 'guest-123', reason: 'user_exit' });

      expect(mockCallbacks.onGuestStateChange).toHaveBeenCalledWith('guest-123', 'left');

      // Simulate guest network timeout
      guestLeftHandler({ guestId: 'guest-456', reason: 'network_timeout' });

      expect(mockCallbacks.onGuestStateChange).toHaveBeenCalledWith('guest-456', 'disconnected');
    });
  });

  describe('shutdown', () => {
    beforeEach(() => {
      sessionManager.initialize(mockSocket, mockUploadManager);
    });

    it('should shutdown gracefully', async () => {
      const shutdownPromise = sessionManager.shutdown('user_exit');
      
      // Fast forward timers
      jest.advanceTimersByTime(1000);
      
      await shutdownPromise;

      expect(mockUploadManager.clear).toHaveBeenCalled();
      expect(mockCallbacks.onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionStatus: 'disconnected',
        })
      );
    });

    it('should emit host_leaving_room for host users', async () => {
      const shutdownPromise = sessionManager.shutdown('user_exit');
      
      jest.advanceTimersByTime(1000);
      
      await shutdownPromise;

      expect(mockSocket.emit).toHaveBeenCalledWith('host_leaving_room', {
        roomId: 'room-123',
        userId: 'user-456',
        reason: 'user_exit',
      });
    });

    it('should emit guest_leaving_room for guest users', async () => {
      const guestSessionManager = new SessionManager(
        'room-123',
        'guest-789',
        'guest',
        mockCallbacks
      );
      guestSessionManager.initialize(mockSocket, mockUploadManager);

      const shutdownPromise = guestSessionManager.shutdown('user_exit');
      
      jest.advanceTimersByTime(1000);
      
      await shutdownPromise;

      expect(mockSocket.emit).toHaveBeenCalledWith('guest_leaving_room', {
        roomId: 'room-123',
        userId: 'guest-789',
        reason: 'user_exit',
      });
    });

    it('should stop recording before shutting down', async () => {
      sessionManager.startRecording();
      
      const shutdownPromise = sessionManager.shutdown('browser_close');
      
      jest.advanceTimersByTime(11000);
      
      await shutdownPromise;

      expect(sessionManager.getState().isRecording).toBe(false);
    });

    it('should not shutdown twice', async () => {
      const firstShutdown = sessionManager.shutdown('user_exit');
      const secondShutdown = sessionManager.shutdown('user_exit');
      
      jest.advanceTimersByTime(1000);
      
      await Promise.all([firstShutdown, secondShutdown]);

      // Should only call clear once
      expect(mockUploadManager.clear).toHaveBeenCalledTimes(1);
    });
  });

  describe('health check', () => {
    beforeEach(() => {
      sessionManager.initialize(mockSocket, mockUploadManager);
    });

    it('should report healthy when connected and recent heartbeat', () => {
      // Simulate recent heartbeat
      const state = sessionManager.getState();
      (state as any).lastHeartbeat = Date.now() - 5000; // 5 seconds ago

      expect(sessionManager.isHealthy()).toBe(true);
    });

    it('should report unhealthy when disconnected', () => {
      sessionManager.getState().connectionStatus = 'disconnected';

      expect(sessionManager.isHealthy()).toBe(false);
    });

    it('should report unhealthy when heartbeat is too old', () => {
      const state = sessionManager.getState();
      (state as any).lastHeartbeat = Date.now() - 60000; // 1 minute ago

      expect(sessionManager.isHealthy()).toBe(false);
    });
  });
});