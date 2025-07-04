/**
 * Comprehensive Session Manager for Riverside Recording Platform
 * Handles network interruptions, graceful shutdowns, heartbeats, and recording completion
 */

import { Socket } from 'socket.io-client';
import { UploadManager } from './upload-manager';

export interface SessionState {
  roomId: string;
  userId: string;
  userType: 'host' | 'guest';
  isRecording: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting' | 'failed';
  lastHeartbeat: number;
  pendingFinalChunks: number;
}

export interface SessionConfig {
  heartbeatInterval: number; // ms
  networkTimeout: number; // ms
  maxReconnectAttempts: number;
  finalChunkTimeout: number; // ms
}

export class SessionManager {
  private config: SessionConfig = {
    heartbeatInterval: 10000, // 10 seconds
    networkTimeout: 30000, // 30 seconds
    maxReconnectAttempts: 3,
    finalChunkTimeout: 10000, // 10 seconds for final chunks
  };

  private state: SessionState;
  private socket: Socket | null = null;
  private uploadManager: UploadManager | null = null;
  
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private networkTimeoutTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isShuttingDown = false;
  private finalChunkPromises: Promise<void>[] = [];

  // Callbacks
  private onStateChange?: (state: SessionState) => void;
  private onNetworkIssue?: (issue: 'timeout' | 'disconnected' | 'reconnected') => void;
  private onRecordingComplete?: (roomId: string, totalChunks: number) => void;
  private onGuestStateChange?: (guestId: string, action: 'joined' | 'left' | 'disconnected') => void;

  constructor(
    roomId: string,
    userId: string,
    userType: 'host' | 'guest',
    callbacks?: {
      onStateChange?: (state: SessionState) => void;
      onNetworkIssue?: (issue: string) => void;
      onRecordingComplete?: (roomId: string, totalChunks: number) => void;
      onGuestStateChange?: (guestId: string, action: string) => void;
    }
  ) {
    this.state = {
      roomId,
      userId,
      userType,
      isRecording: false,
      connectionStatus: 'disconnected',
      lastHeartbeat: Date.now(),
      pendingFinalChunks: 0,
    };

    this.onStateChange = callbacks?.onStateChange;
    this.onNetworkIssue = callbacks?.onNetworkIssue;
    this.onRecordingComplete = callbacks?.onRecordingComplete;
    this.onGuestStateChange = callbacks?.onGuestStateChange;

    this.setupBeforeUnloadHandler();
    this.setupVisibilityChangeHandler();
  }

  /**
   * Initialize session with socket and upload manager
   */
  initialize(socket: Socket, uploadManager: UploadManager): void {
    this.socket = socket;
    this.uploadManager = uploadManager;
    
    this.setupSocketListeners();
    this.startHeartbeat();
    this.updateConnectionStatus('connected');
    
    console.log(`🎯 Session manager initialized for ${this.state.userType} in room ${this.state.roomId}`);
  }

  /**
   * Start recording with proper state management
   */
  startRecording(): void {
    if (!this.socket || this.state.connectionStatus !== 'connected') {
      console.error('❌ Cannot start recording - no connection');
      return;
    }

    this.state.isRecording = true;
    this.state.pendingFinalChunks = 0;
    this.notifyStateChange();
    
    console.log('🎬 Session manager: Recording started');
  }

  /**
   * Stop recording with graceful final chunk handling
   */
  async stopRecording(): Promise<void> {
    if (!this.state.isRecording) return;

    console.log('🛑 Session manager: Stopping recording gracefully...');
    this.state.isRecording = false;
    
    // Wait for any pending final chunks with timeout
    if (this.finalChunkPromises.length > 0) {
      console.log(`⏳ Waiting for ${this.finalChunkPromises.length} final chunks...`);
      
      try {
        await Promise.race([
          Promise.all(this.finalChunkPromises),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Final chunk timeout')), this.config.finalChunkTimeout)
          )
        ]);
        console.log('✅ All final chunks processed');
      } catch (error) {
        console.warn('⚠️ Final chunk timeout - proceeding with shutdown:', error);
      }
    }

    // Notify recording completion
    if (this.uploadManager) {
      const stats = this.uploadManager.getStats();
      this.onRecordingComplete?.(this.state.roomId, stats.total);
    }

    this.notifyStateChange();
  }

  /**
   * Add final chunk with promise tracking
   */
  addFinalChunk(chunkPromise: Promise<void>): void {
    this.state.pendingFinalChunks++;
    
    const trackedPromise = chunkPromise
      .finally(() => {
        this.state.pendingFinalChunks = Math.max(0, this.state.pendingFinalChunks - 1);
        this.notifyStateChange();
      });
    
    this.finalChunkPromises.push(trackedPromise);
    
    // Clean up resolved promises
    setTimeout(() => {
      this.finalChunkPromises = this.finalChunkPromises.filter(p => p !== trackedPromise);
    }, this.config.finalChunkTimeout);
  }

  /**
   * Graceful session shutdown
   */
  async shutdown(reason: 'user_exit' | 'network_failure' | 'browser_close' = 'user_exit'): Promise<void> {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    console.log(`🚪 Session manager: Shutting down (${reason})`);

    // Stop heartbeat
    this.stopHeartbeat();

    // Stop recording gracefully if active
    if (this.state.isRecording) {
      await this.stopRecording();
    }

    // Notify other participants
    if (this.socket?.connected) {
      if (this.state.userType === 'host') {
        this.socket.emit('host_leaving_room', {
          roomId: this.state.roomId,
          userId: this.state.userId,
          reason
        });
      } else {
        this.socket.emit('guest_leaving_room', {
          roomId: this.state.roomId,
          userId: this.state.userId,
          reason
        });
      }
    }

    // Clear upload manager
    if (this.uploadManager) {
      this.uploadManager.clear();
    }

    // Update state
    this.updateConnectionStatus('disconnected');
    
    console.log('✅ Session shutdown complete');
  }

  /**
   * Handle network reconnection
   */
  private async handleReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.updateConnectionStatus('failed');
      this.onNetworkIssue?.('timeout');
      return;
    }

    this.reconnectAttempts++;
    this.updateConnectionStatus('reconnecting');
    
    console.log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}`);

    // If recording was active, we need to handle the interruption
    if (this.state.isRecording) {
      console.log('⚠️ Recording was active during disconnection - handling gracefully');
      
      // If host, stop recording and notify
      if (this.state.userType === 'host') {
        await this.stopRecording();
      }
    }
  }

  /**
   * Setup socket event listeners for robust connection handling
   */
  private setupSocketListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('🔗 Socket connected');
      this.reconnectAttempts = 0;
      this.updateConnectionStatus('connected');
      this.onNetworkIssue?.('reconnected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('💔 Socket disconnected:', reason);
      this.updateConnectionStatus('disconnected');
      
      // Don't try to reconnect if it was intentional
      if (reason !== 'io client disconnect' && !this.isShuttingDown) {
        this.handleReconnection();
      }
      
      this.onNetworkIssue?.('disconnected');
    });

    // Heartbeat response
    this.socket.on('heartbeat_response', (data: { timestamp: number }) => {
      this.state.lastHeartbeat = data.timestamp;
      this.resetNetworkTimeout();
    });

    // Guest management events
    this.socket.on('guest_joined', (data: { guestId: string, guestName: string }) => {
      console.log(`👥 Guest joined: ${data.guestName} (${data.guestId})`);
      this.onGuestStateChange?.(data.guestId, 'joined');
    });

    this.socket.on('guest_left', (data: { guestId: string, reason: string }) => {
      console.log(`👋 Guest left: ${data.guestId} (${data.reason})`);
      this.onGuestStateChange?.(data.guestId, data.reason === 'network_timeout' ? 'disconnected' : 'left');
    });

    this.socket.on('host_disconnected', () => {
      console.log('🚨 Host disconnected - ending session');
      if (this.state.userType === 'guest') {
        this.shutdown('network_failure');
      }
    });

    // Recording completion verification
    this.socket.on('recording_verification_request', async (data: { expectedChunks: number }) => {
      if (this.uploadManager && this.state.userType === 'host') {
        const stats = this.uploadManager.getStats();
        this.socket?.emit('recording_verification_response', {
          roomId: this.state.roomId,
          actualChunks: stats.total,
          uploadedChunks: stats.uploaded,
          failedChunks: stats.failed,
          expectedChunks: data.expectedChunks
        });
      }
    });
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected && !this.isShuttingDown) {
        this.socket.emit('heartbeat', {
          roomId: this.state.roomId,
          userId: this.state.userId,
          timestamp: Date.now(),
          isRecording: this.state.isRecording
        });
        
        this.setNetworkTimeout();
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.resetNetworkTimeout();
  }

  /**
   * Set network timeout for heartbeat response
   */
  private setNetworkTimeout(): void {
    this.resetNetworkTimeout();
    this.networkTimeoutTimer = setTimeout(() => {
      console.warn('⚠️ Network timeout - no heartbeat response');
      this.onNetworkIssue?.('timeout');
      this.handleReconnection();
    }, this.config.networkTimeout);
  }

  /**
   * Reset network timeout
   */
  private resetNetworkTimeout(): void {
    if (this.networkTimeoutTimer) {
      clearTimeout(this.networkTimeoutTimer);
      this.networkTimeoutTimer = null;
    }
  }

  /**
   * Setup beforeunload handler for graceful browser close
   */
  private setupBeforeUnloadHandler(): void {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (this.state.isRecording || this.state.pendingFinalChunks > 0) {
        // Show confirmation dialog
        const message = 'Recording is in progress. Are you sure you want to leave?';
        event.preventDefault();
        event.returnValue = message;
        
        // Attempt graceful shutdown
        this.shutdown('browser_close');
        
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Cleanup on page hide (mobile browsers)
    window.addEventListener('pagehide', () => {
      this.shutdown('browser_close');
    });
  }

  /**
   * Setup visibility change handler
   */
  private setupVisibilityChangeHandler(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Page is hidden - reduce heartbeat frequency
        console.log('📱 Page hidden - reducing heartbeat frequency');
      } else {
        // Page is visible - resume normal heartbeat
        console.log('📱 Page visible - resuming normal heartbeat');
        
        // Send immediate heartbeat to check connection
        if (this.socket?.connected && !this.isShuttingDown) {
          this.socket.emit('heartbeat', {
            roomId: this.state.roomId,
            userId: this.state.userId,
            timestamp: Date.now(),
            isRecording: this.state.isRecording
          });
        }
      }
    });
  }

  /**
   * Update connection status and notify
   */
  private updateConnectionStatus(status: SessionState['connectionStatus']): void {
    if (this.state.connectionStatus !== status) {
      this.state.connectionStatus = status;
      this.notifyStateChange();
    }
  }

  /**
   * Notify state change to callback
   */
  private notifyStateChange(): void {
    this.onStateChange?.(this.state);
  }

  /**
   * Get current session state
   */
  getState(): SessionState {
    return { ...this.state };
  }

  /**
   * Check if session is healthy
   */
  isHealthy(): boolean {
    const now = Date.now();
    const heartbeatAge = now - this.state.lastHeartbeat;
    
    return this.state.connectionStatus === 'connected' && 
           heartbeatAge < this.config.networkTimeout &&
           !this.isShuttingDown;
  }
} 