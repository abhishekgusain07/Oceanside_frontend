"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RecordingAPI } from '@/lib/api';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import config from '@/config';

interface GuestJoinPageProps {
  params: { token: string };
}

export default function GuestJoinPage({ params }: GuestJoinPageProps) {
  const router = useRouter();
  const { token } = params;
  
  // State management
  const [roomId, setRoomId] = useState<string>('');
  const [guestName, setGuestName] = useState('Guest User');
  const [isJoining, setIsJoining] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showCountdown, setShowCountdown] = useState(false);
  
  // Refs for video elements and recording
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Validate token and join session
  const joinSession = async () => {
    if (!guestName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    setIsJoining(true);
    
    try {
      // Validate the token (this would call an API to validate the token and get room info)
      // For now, we'll extract room ID from token or make an API call
      
      // Initialize media stream
      await initializeMedia();
      
      // Initialize Socket.IO connection
      initializeSocket(roomId || 'default-room'); // TODO: Get actual room ID from token validation
      
      setIsConnected(true);
      toast.success('Joined session successfully!');
      
    } catch (error) {
      console.error('Failed to join session:', error);
      toast.error('Failed to join session. Please check your link.');
      setIsJoining(false);
    }
  };

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
      
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
    } catch (error) {
      console.error('Failed to access media devices:', error);
      toast.error('Failed to access camera and microphone');
    }
  };

  const initializeSocket = (roomId: string) => {
    // Connect to Socket.IO server
    const socket = io(config.socketio.baseUrl, {
      path: '/socket.io/'
    });
    
    socketRef.current = socket;

    // Socket event handlers
    socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      socket.emit('join-room', roomId);
    });

    socket.on('room-joined', () => {
      console.log('Joined room as guest');
      socket.emit('ready'); // Signal ready for WebRTC
    });

    socket.on('user-joined', () => {
      console.log('Another user joined');
    });

    socket.on('ready', () => {
      console.log('Host is ready for WebRTC negotiation');
    });

    socket.on('offer', async (data: { offer: RTCSessionDescriptionInit }) => {
      console.log('Received offer:', data);
      await handleOffer(data.offer);
    });

    socket.on('answer', async (data: { answer: RTCSessionDescriptionInit }) => {
      console.log('Received answer:', data);
      await handleAnswer(data.answer);
    });

    socket.on('ice-candidate', async (data: { candidate: RTCIceCandidateInit }) => {
      console.log('Received ICE candidate:', data);
      await handleIceCandidate(data.candidate);
    });

    socket.on('start-recording', (data: { startTime: number }) => {
      console.log('Start recording countdown:', data);
      startRecordingCountdown(data.startTime);
    });

    socket.on('stop-rec', () => {
      console.log('Stop recording signal received');
      stopRecording();
    });

    // Initialize WebRTC
    initializeWebRTC();
  };

  const initializeWebRTC = () => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    };

    const peerConnection = new RTCPeerConnection(configuration);
    peerConnectionRef.current = peerConnection;

    // Add local stream to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('Received remote stream');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          roomId: roomId,
          candidate: event.candidate
        });
      }
    };
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      await peerConnectionRef.current!.setRemoteDescription(offer);
      const answer = await peerConnectionRef.current!.createAnswer();
      await peerConnectionRef.current!.setLocalDescription(answer);
      
      socketRef.current!.emit('answer', {
        roomId: roomId,
        answer: answer
      });
    } catch (error) {
      console.error('Failed to handle offer:', error);
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    try {
      await peerConnectionRef.current!.setRemoteDescription(answer);
    } catch (error) {
      console.error('Failed to handle answer:', error);
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    try {
      await peerConnectionRef.current!.addIceCandidate(candidate);
    } catch (error) {
      console.error('Failed to handle ICE candidate:', error);
    }
  };

  const startRecordingCountdown = (startTime: number) => {
    setShowCountdown(true);
    const now = Date.now();
    const delay = startTime - now;
    
    if (delay > 0) {
      let timeLeft = Math.ceil(delay / 1000);
      setCountdown(timeLeft);
      
      const countdownInterval = setInterval(() => {
        timeLeft--;
        setCountdown(timeLeft);
        
        if (timeLeft <= 0) {
          clearInterval(countdownInterval);
          setShowCountdown(false);
          setIsRecording(true);
          startLocalRecording();
        }
      }, 1000);
    } else {
      setShowCountdown(false);
      setIsRecording(true);
      startLocalRecording();
    }
  };

  const startLocalRecording = () => {
    if (localStreamRef.current) {
      recordingChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(localStreamRef.current, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        uploadRecordingChunks();
      };
      
      mediaRecorder.start(1000); // Record in 1-second chunks
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadRecordingChunks = async () => {
    try {
      const chunks = recordingChunksRef.current;
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const formData = new FormData();
        formData.append('chunk', chunk, `chunk_${i}.webm`);
        formData.append('room_id', roomId);
        formData.append('user_type', 'guest');
        formData.append('chunk_index', i.toString());
        
        await RecordingAPI.uploadChunk(formData);
      }
      
      toast.success('Recording uploaded successfully!');
      
    } catch (error) {
      console.error('Failed to upload recording:', error);
      toast.error('Failed to upload recording');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-gray-800 rounded-xl p-8 shadow-xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold mb-2">Join Recording Session</h1>
              <p className="text-gray-400">You've been invited to join a recording session</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                  placeholder="Enter your name"
                />
              </div>
              
              <button
                onClick={joinSession}
                disabled={isJoining}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                {isJoining ? 'Joining...' : 'Join Session'}
              </button>
            </div>
            
            <div className="mt-6 pt-6 border-t border-gray-700">
              <div className="flex items-center justify-center text-sm text-gray-400">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                End-to-end encrypted
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="font-medium">Recording Session</span>
        </div>

        {/* Recording Indicator */}
        {isRecording && (
          <div className="flex items-center gap-2 bg-red-600 px-3 py-2 rounded-lg">
            <div className="w-3 h-3 bg-red-300 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Recording</span>
          </div>
        )}

        <div className="text-sm text-gray-400">
          Guest: {guestName}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6">
        <div className="grid grid-cols-2 gap-6 max-w-6xl mx-auto">
          {/* Host Video */}
          <div className="relative bg-gray-800 rounded-xl overflow-hidden">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover aspect-video"
            />
            <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-lg">
              <span className="text-sm font-medium">Host</span>
            </div>
            {!remoteVideoRef.current?.srcObject && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p>Waiting for host...</p>
                </div>
              </div>
            )}
          </div>

          {/* Guest Video (You) */}
          <div className="relative bg-gray-800 rounded-xl overflow-hidden border-2 border-green-500">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover aspect-video"
            />
            <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-lg">
              <span className="text-sm font-medium">{guestName} (You)</span>
            </div>
          </div>
        </div>
      </main>

      {/* Controls */}
      <footer className="p-6">
        <div className="flex items-center justify-center gap-6">
          <button className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors">
            <div className="w-12 h-12 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <span className="text-sm font-medium">Mic</span>
          </button>

          <button className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors">
            <div className="w-12 h-12 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-sm font-medium">Cam</span>
          </button>

          <button 
            onClick={() => window.close()}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-red-600 hover:bg-red-700 transition-colors"
          >
            <div className="w-12 h-12 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
              </svg>
            </div>
            <span className="text-sm font-medium">Leave</span>
          </button>
        </div>
      </footer>

      {/* Countdown Overlay */}
      {showCountdown && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-white text-xl mb-4">Recording will start in</div>
            <div className="text-white text-8xl font-bold mb-4">{countdown}</div>
            {countdown === 0 && (
              <div className="text-white text-xl flex items-center gap-2">
                Recording <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 