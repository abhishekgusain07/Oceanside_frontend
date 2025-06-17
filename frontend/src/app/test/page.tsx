'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Enum for WebSocket message types (matching backend)
enum MessageType {
  WEBRTC_OFFER = "webrtc_offer",
  WEBRTC_ANSWER = "webrtc_answer",
  ICE_CANDIDATE = "ice_candidate",
  RECORDING_STATUS = "recording_status",
  PARTICIPANT_JOINED = "participant_joined",
  PARTICIPANT_LEFT = "participant_left",
  HEARTBEAT = "heartbeat",
  ERROR = "error"
}

// Configuration for WebSocket connection
const WS_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8000',
  RECONNECT_INTERVAL: 3000,  // 3 seconds
  MAX_RECONNECT_ATTEMPTS: 5
};

export default function TestPage() {
  const [sessionId, setSessionId] = useState<string>('');
  const [participantId, setParticipantId] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'Disconnected' | 'Connecting' | 'Connected' | 'Error'>('Disconnected');
  const [messages, setMessages] = useState<string[]>([]);
  
  // Refs to maintain state across closures
  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Initialize participant and session IDs on component mount
  useEffect(() => {
    const newParticipantId = uuidv4();
    setParticipantId(newParticipantId);
    
    // Generate or fetch a session ID 
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
  }, []);

  // Add message to UI log
  const addMessage = useCallback((message: string, type: 'info' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setMessages(prev => [...prev, `[${type === 'error' ? 'ERROR' : 'INFO'}] ${timestamp}: ${message}`]);
  }, []);

  // Establish WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (!sessionId || !participantId) {
      addMessage('Session or Participant ID not set', 'error');
      return;
    }

    // Reset connection status and attempts
    setConnectionStatus('Connecting');
    reconnectAttemptsRef.current = 0;

    // Construct WebSocket URL
    const wsUrl = `${WS_CONFIG.BASE_URL}/ws/${sessionId}?participant_id=${participantId}`;
    
    // Close existing connection if any
    if (websocketRef.current) {
      websocketRef.current.close();
    }

    const ws = new WebSocket(wsUrl);

    // WebSocket event handlers
    ws.onopen = () => {
      setConnectionStatus('Connected');
      addMessage('WebSocket connection established');
      reconnectAttemptsRef.current = 0;  // Reset reconnect attempts
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        addMessage(`Error parsing message: ${error}`, 'error');
      }
    };

    ws.onclose = (event) => {
      // Determine if this was an intentional close or unexpected
      const wasConnected = connectionStatus === 'Connected';
      
      setConnectionStatus('Disconnected');
      
      if (wasConnected) {
        addMessage(`WebSocket connection closed: ${event.reason || 'Unknown reason'}`, 'error');
        
        // Attempt reconnection
        if (reconnectAttemptsRef.current < WS_CONFIG.MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current += 1;
          addMessage(`Attempting to reconnect (Attempt ${reconnectAttemptsRef.current})...`);
          
          setTimeout(connectWebSocket, WS_CONFIG.RECONNECT_INTERVAL);
        } else {
          addMessage('Max reconnection attempts reached. Please manually reconnect.', 'error');
        }
      }
    };

    ws.onerror = (error) => {
      setConnectionStatus('Error');
      addMessage(`WebSocket error: ${JSON.stringify(error)}`, 'error');
    };

    // Store reference to WebSocket
    websocketRef.current = ws;
  }, [sessionId, participantId, addMessage]);

  // Handle different types of WebSocket messages
  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case MessageType.PARTICIPANT_JOINED:
        addMessage(`Participant ${message.participant_id} joined`);
        break;
      case MessageType.PARTICIPANT_LEFT:
        addMessage(`Participant ${message.participant_id} left`);
        break;
      case MessageType.ERROR:
        addMessage(`Server Error: ${message.detail}`, 'error');
        break;
      case MessageType.HEARTBEAT:
        addMessage('Received heartbeat from server');
        break;
      default:
        addMessage(`Received unhandled message type: ${message.type}`);
    }
  }, [addMessage]);

  // Send a test heartbeat message
  const sendHeartbeat = useCallback(() => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({
        type: MessageType.HEARTBEAT
      }));
      addMessage('Sent heartbeat');
    } else {
      addMessage('Cannot send heartbeat: WebSocket not connected', 'error');
    }
  }, [addMessage]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">WebSocket Test Page</h1>
      
      <div className="mb-4">
        <p>Session ID: <span className="font-mono">{sessionId}</span></p>
        <p>Participant ID: <span className="font-mono">{participantId}</span></p>
        <p>Connection Status: 
          <span 
            className={`font-bold ml-2 ${
              connectionStatus === 'Connected' 
                ? 'text-green-600' 
                : connectionStatus === 'Connecting'
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}
          >
            {connectionStatus}
          </span>
        </p>
      </div>

      <div className="flex space-x-4 mb-4">
        <button 
          onClick={connectWebSocket}
          className="bg-blue-500 text-white px-4 py-2 rounded"
          disabled={connectionStatus === 'Connected' || connectionStatus === 'Connecting'}
        >
          {connectionStatus === 'Connecting' ? 'Connecting...' : 'Connect WebSocket'}
        </button>
        <button 
          onClick={sendHeartbeat}
          className="bg-green-500 text-white px-4 py-2 rounded"
          disabled={connectionStatus !== 'Connected'}
        >
          Send Heartbeat
        </button>
      </div>

      <div className="border rounded p-4 h-64 overflow-y-auto bg-gray-50">
        <h2 className="font-bold mb-2">Messages:</h2>
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`text-sm mb-1 ${
              msg.includes('[ERROR]') 
                ? 'text-red-600' 
                : msg.includes('[INFO]') 
                ? 'text-gray-800' 
                : ''
            }`}
          >
            {msg}
          </div>
        ))}
      </div>
    </div>
  );
} 