"use client";

import { WebSocketMessage, MessageType } from '@/lib/types';

export interface WebSocketManagerConfig {
  sessionId: string;
  participantId: string;
  onMessage?: (message: WebSocketMessage) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Event) => void;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: WebSocketManagerConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isManualClose = false;

  constructor(config: WebSocketManagerConfig) {
    this.config = config;
  }

  /**
   * Connect to the WebSocket server
   */
  connect(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = (event) => {
          console.log('WebSocket connected:', event);
          this.reconnectAttempts = 0;
          this.config.onConnectionChange?.(true);
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log('WebSocket message received:', message);
            this.config.onMessage?.(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event);
          this.config.onConnectionChange?.(false);
          this.stopHeartbeat();
          
          if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect(wsUrl);
          }
        };

        this.ws.onerror = (event) => {
          console.error('WebSocket error:', event);
          this.config.onError?.(event);
          reject(event);
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.isManualClose = true;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
  }

  /**
   * Send a message through the WebSocket
   */
  sendMessage(message: WebSocketMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send message:', message);
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      return false;
    }
  }

  /**
   * Send WebRTC offer to a specific participant
   */
  sendOffer(offer: RTCSessionDescriptionInit, targetParticipant: string): boolean {
    return this.sendMessage({
      type: MessageType.WEBRTC_OFFER,
      data: { offer, target_participant: targetParticipant },
      participant_id: this.config.participantId
    });
  }

  /**
   * Send WebRTC answer to a specific participant
   */
  sendAnswer(answer: RTCSessionDescriptionInit, targetParticipant: string): boolean {
    return this.sendMessage({
      type: MessageType.WEBRTC_ANSWER,
      data: { answer, target_participant: targetParticipant },
      participant_id: this.config.participantId
    });
  }

  /**
   * Send ICE candidate to a specific participant
   */
  sendIceCandidate(candidate: RTCIceCandidateInit, targetParticipant: string): boolean {
    return this.sendMessage({
      type: MessageType.ICE_CANDIDATE,
      data: { candidate, target_participant: targetParticipant },
      participant_id: this.config.participantId
    });
  }

  /**
   * Send recording status update
   */
  sendRecordingStatus(isRecording: boolean): boolean {
    return this.sendMessage({
      type: MessageType.RECORDING_STATUS,
      data: { is_recording: isRecording },
      participant_id: this.config.participantId
    });
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendMessage({
        type: MessageType.HEARTBEAT,
        participant_id: this.config.participantId,
        timestamp: new Date().toISOString()
      });
    }, 30000); // Send heartbeat every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(wsUrl: string): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
    
    setTimeout(() => {
      if (!this.isManualClose) {
        this.connect(wsUrl).catch(() => {
          // Reconnection failed, will try again if attempts remaining
        });
      }
    }, delay);
  }
} 