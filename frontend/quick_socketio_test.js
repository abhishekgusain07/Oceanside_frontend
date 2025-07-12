#!/usr/bin/env node

// Quick Socket.IO test using JavaScript
const io = require('socket.io-client');

console.log('🧪 Testing Socket.IO connection from frontend perspective...');

const socket = io('http://localhost:8000', {
  path: '/socket.io/',
  transports: ['websocket', 'polling'],
  timeout: 20000,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  forceNew: true,
  autoConnect: true
});

let connected = false;

socket.on('connect', () => {
  connected = true;
  console.log('✅ Socket.IO connected successfully!');
  console.log(`📡 Socket ID: ${socket.id}`);
  console.log('🔗 Connected status:', socket.connected);
  
  // Test room joining
  console.log('🏠 Testing room join...');
  socket.emit('join_room', 'test-room-123');
  
  // Test recording start request
  console.log('🎬 Testing recording start request...');
  socket.emit('start_recording_request', 'test-room-123');
  
  setTimeout(() => {
    console.log('✅ Basic Socket.IO connection test completed successfully!');
    console.log('💡 Frontend should be able to connect to the backend now.');
    process.exit(0);
  }, 2000);
});

socket.on('connect_error', (error) => {
  console.error('❌ Socket.IO connection error:', error);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.warn('💔 Socket.IO disconnected:', reason);
});

socket.on('room_joined', (data) => {
  console.log('🏠 Room joined successfully:', data);
});

socket.on('start_recording', (data) => {
  console.log('🎬 Recording start signal received:', data);
});

// Timeout after 10 seconds
setTimeout(() => {
  if (!connected) {
    console.error('❌ Socket.IO connection test FAILED - timeout after 10 seconds');
    process.exit(1);
  }
}, 10000);