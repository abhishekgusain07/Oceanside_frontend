"use client";

import { WebSocketManager } from '@/lib/websocket';

export interface WebRTCManagerConfig {
  websocketManager: WebSocketManager;
  onRemoteStream?: (stream: MediaStream, participantId: string) => void;
  onRemoteStreamEnded?: (participantId: string) => void;
  onConnectionStateChange?: (participantId: string, state: RTCPeerConnectionState) => void;
}

export class WebRTCManager {
  private config: WebRTCManagerConfig;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private participantId: string;

  // ICE servers configuration
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  constructor(config: WebRTCManagerConfig, participantId: string) {
    this.config = config;
    this.participantId = participantId;
  }

  /**
   * Initialize WebRTC by getting user media
   */
  async initializeLocalStream(constraints: MediaStreamConstraints = {
    video: true,
    audio: true
  }): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Local stream initialized:', this.localStream);
      return this.localStream;
    } catch (error) {
      console.error('Failed to get user media:', error);
      throw error;
    }
  }

  /**
   * Create a peer connection for a specific participant
   */
  private createPeerConnection(participantId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate to:', participantId);
        this.config.websocketManager.sendIceCandidate(
          event.candidate.toJSON(),
          participantId
        );
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track from:', participantId);
      const [stream] = event.streams;
      this.config.onRemoteStream?.(stream, participantId);
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${participantId}:`, pc.connectionState);
      this.config.onConnectionStateChange?.(participantId, pc.connectionState);
      
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.config.onRemoteStreamEnded?.(participantId);
      }
    };

    // Add local stream tracks to the peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    this.peerConnections.set(participantId, pc);
    return pc;
  }

  /**
   * Create and send an offer to a participant
   */
  async createOffer(participantId: string): Promise<void> {
    try {
      const pc = this.createPeerConnection(participantId);
      
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      
      await pc.setLocalDescription(offer);
      
      console.log('Sending offer to:', participantId);
      this.config.websocketManager.sendOffer(offer, participantId);
    } catch (error) {
      console.error('Failed to create offer for:', participantId, error);
      throw error;
    }
  }

  /**
   * Handle incoming offer from a participant
   */
  async handleOffer(offer: RTCSessionDescriptionInit, participantId: string): Promise<void> {
    try {
      const pc = this.createPeerConnection(participantId);
      
      await pc.setRemoteDescription(offer);
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      console.log('Sending answer to:', participantId);
      this.config.websocketManager.sendAnswer(answer, participantId);
    } catch (error) {
      console.error('Failed to handle offer from:', participantId, error);
      throw error;
    }
  }

  /**
   * Handle incoming answer from a participant
   */
  async handleAnswer(answer: RTCSessionDescriptionInit, participantId: string): Promise<void> {
    try {
      const pc = this.peerConnections.get(participantId);
      if (!pc) {
        console.error('No peer connection found for participant:', participantId);
        return;
      }
      
      await pc.setRemoteDescription(answer);
      console.log('Set remote description for:', participantId);
    } catch (error) {
      console.error('Failed to handle answer from:', participantId, error);
      throw error;
    }
  }

  /**
   * Handle incoming ICE candidate from a participant
   */
  async handleIceCandidate(candidate: RTCIceCandidateInit, participantId: string): Promise<void> {
    try {
      const pc = this.peerConnections.get(participantId);
      if (!pc) {
        console.error('No peer connection found for participant:', participantId);
        return;
      }
      
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('Added ICE candidate from:', participantId);
    } catch (error) {
      console.error('Failed to handle ICE candidate from:', participantId, error);
    }
  }

  /**
   * Connect to a new participant
   */
  async connectToParticipant(participantId: string): Promise<void> {
    if (this.peerConnections.has(participantId)) {
      console.log('Already connected to participant:', participantId);
      return;
    }
    
    console.log('Connecting to participant:', participantId);
    await this.createOffer(participantId);
  }

  /**
   * Disconnect from a participant
   */
  disconnectFromParticipant(participantId: string): void {
    const pc = this.peerConnections.get(participantId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(participantId);
      console.log('Disconnected from participant:', participantId);
      this.config.onRemoteStreamEnded?.(participantId);
    }
  }

  /**
   * Toggle local video
   */
  toggleVideo(): boolean {
    if (!this.localStream) {
      return false;
    }
    
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return videoTrack.enabled;
    }
    return false;
  }

  /**
   * Toggle local audio
   */
  toggleAudio(): boolean {
    if (!this.localStream) {
      return false;
    }
    
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return audioTrack.enabled;
    }
    return false;
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get connection stats for a participant
   */
  async getConnectionStats(participantId: string): Promise<RTCStatsReport | null> {
    const pc = this.peerConnections.get(participantId);
    if (!pc) {
      return null;
    }
    
    try {
      return await pc.getStats();
    } catch (error) {
      console.error('Failed to get stats for:', participantId, error);
      return null;
    }
  }

  /**
   * Clean up all connections
   */
  cleanup(): void {
    console.log('🧹 WebRTC cleanup called');
    
    // Close all peer connections
    this.peerConnections.forEach((pc, participantId) => {
      pc.close();
      console.log('Closed connection to:', participantId);
    });
    this.peerConnections.clear();

    // Stop local stream
    if (this.localStream) {
      console.log('🛑 Stopping media tracks...');
      this.localStream.getTracks().forEach((track, index) => {
        console.log(`Stopping ${track.kind} track ${index}:`, track.id);
        track.stop();
      });
      this.localStream = null;
      console.log('✅ All media tracks stopped and stream cleared');
    } else {
      console.log('No local stream to cleanup');
    }
  }

  /**
   * Get list of connected participants
   */
  getConnectedParticipants(): string[] {
    return Array.from(this.peerConnections.keys());
  }

  /**
   * Check if connected to a specific participant
   */
  isConnectedTo(participantId: string): boolean {
    const pc = this.peerConnections.get(participantId);
    return pc ? pc.connectionState === 'connected' : false;
  }
} 