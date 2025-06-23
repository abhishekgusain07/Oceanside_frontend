"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { RecordingAPI, type RecordingCreateResponse, type GuestTokenResponse } from '@/lib/api';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import config from '@/config';

interface UploadProgress {
  percentage: number;
  chunkInfo: string;
  status: string;
}

export default function StudioPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useUser();
  
  // State management
  const [roomId, setRoomId] = useState<string>('');
  const [recordingTitle, setRecordingTitle] = useState('Untitled Recording');
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    percentage: 0,
    chunkInfo: '',
    status: 'Uploading to cloud…'
  });
  const [countdown, setCountdown] = useState(0);
  const [showCountdown, setShowCountdown] = useState(false);
  const [guestToken, setGuestToken] = useState<string>('');
  
  // Refs for video elements and recording
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Initialize room on component mount
  useEffect(() => {
    if (isAuthenticated && user) {
      initializeRoom();
    }
  }, [isAuthenticated, user]);

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

  const initializeRoom = async () => {
    try {
      // Validate user data
      if (!user?.id) {
        toast.error('User not found. Please sign in again.');
        router.push('/sign-in');
        return;
      }

      // Create a new recording session
      const recording = await RecordingAPI.createRecording({
        user_id: user.id, // Fixed: changed from host_user_id to user_id
        title: recordingTitle.trim() || undefined, // Optional field, undefined if empty
        max_participants: 10 // Optional: set reasonable default
      });
      
      setRoomId(recording.room_id);
      
      // Initialize media stream
      await initializeMedia();
      
      // Initialize Socket.IO connection
      initializeSocket(recording.room_id);
      
    } catch (error) {
      console.error('Failed to initialize room:', error);
      toast.error('Failed to create recording session');
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

    socket.on('room-created', () => {
      console.log('Room created successfully');
    });

    socket.on('room-joined', () => {
      console.log('Joined room successfully');
    });

    socket.on('user-joined', (socketId: string) => {
      console.log('Guest user joined:', socketId);
      toast.success('Guest joined the session');
    });

    socket.on('ready', () => {
      console.log('Ready for WebRTC negotiation');
      if (peerConnectionRef.current && localStreamRef.current) {
        createOffer();
      }
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

    socket.on('participant_left', () => {
      toast.info('Guest left the session');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
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

  const createOffer = async () => {
    try {
      const offer = await peerConnectionRef.current!.createOffer();
      await peerConnectionRef.current!.setLocalDescription(offer);
      
      socketRef.current!.emit('offer', {
        roomId: roomId,
        offer: offer
      });
    } catch (error) {
      console.error('Failed to create offer:', error);
    }
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

  const generateGuestToken = async () => {
    try {
      const tokenData = await RecordingAPI.generateGuestToken(roomId);
      setGuestToken(tokenData.token);
      
      const inviteUrl = `${window.location.origin}/join/${tokenData.token}`;
      await navigator.clipboard.writeText(inviteUrl);
      toast.success('Invite link copied to clipboard!');
    } catch (error) {
      console.error('Failed to generate guest token:', error);
      toast.error('Failed to generate invite link');
    }
  };

  const startRecording = () => {
    if (socketRef.current) {
      socketRef.current.emit('start-recording-request', roomId);
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
      
      if (socketRef.current) {
        socketRef.current.emit('recording-stopped', {
          roomId: roomId,
          userId: user?.id
        });
      }
    }
  };

  const uploadRecordingChunks = async () => {
    setIsUploading(true);
    
    try {
      const chunks = recordingChunksRef.current;
      const totalChunks = chunks.length;
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const formData = new FormData();
        formData.append('chunk', chunk, `chunk_${i}.webm`);
        formData.append('room_id', roomId);
        formData.append('user_type', 'host');
        formData.append('chunk_index', i.toString());
        
        await RecordingAPI.uploadChunk(formData);
        
        const progress = Math.round(((i + 1) / totalChunks) * 100);
        setUploadProgress({
          percentage: progress,
          chunkInfo: `${i + 1} / ${totalChunks} chunks`,
          status: 'Uploading to cloud…'
        });
      }
      
      // Update recording title
      await RecordingAPI.updateTitle(roomId, recordingTitle);
      
      setUploadProgress({
        percentage: 100,
        chunkInfo: `${totalChunks} / ${totalChunks} chunks`,
        status: 'Processing video…'
      });
      
      toast.success('Recording uploaded successfully! Processing video...');
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
      
    } catch (error) {
      console.error('Failed to upload recording:', error);
      toast.error('Failed to upload recording');
      setIsUploading(false);
    }
  };

  const updateRecordingTitle = async (newTitle: string) => {
    setRecordingTitle(newTitle);
    if (roomId) {
      try {
        await RecordingAPI.updateTitle(roomId, newTitle);
      } catch (error) {
        console.error('Failed to update title:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push('/sign-in');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-black/20 backdrop-blur-sm border-b border-white/10">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          
          <div className="flex items-center gap-2">
            <span>{user?.name || 'Guest'} Studio</span>
            <input
              type="text"
              value={recordingTitle}
              onChange={(e) => updateRecordingTitle(e.target.value)}
              className="bg-transparent border-none text-white focus:outline-none focus:border-b border-gray-500 max-w-xs"
              placeholder="Enter recording title"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Upload Progress */}
          {isUploading && (
            <div className="flex items-center gap-3 bg-gray-800 px-4 py-2 rounded-lg">
              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-sm">
                <div className="text-white">Uploading Recording</div>
                <div className="text-gray-400 text-xs">{uploadProgress.chunkInfo}</div>
              </div>
              <div className="text-purple-400 text-sm">{uploadProgress.percentage}%</div>
            </div>
          )}

          {/* Recording Indicator */}
          {isRecording && (
            <div className="flex items-center gap-2 bg-red-600 px-3 py-2 rounded-lg">
              <div className="w-3 h-3 bg-red-300 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Recording</span>
            </div>
          )}

          {/* Invite Button */}
          <button
            onClick={generateGuestToken}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            Invite Guest
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6">
        <div className="grid grid-cols-2 gap-6 max-w-6xl mx-auto">
          {/* Local Video */}
          <div className="relative bg-gray-800 rounded-xl overflow-hidden border-2 border-purple-500">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover aspect-video"
            />
            <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-lg">
              <span className="text-sm font-medium">{user?.name || 'You'}</span>
            </div>
          </div>

          {/* Remote Video */}
          <div className="relative bg-gray-800 rounded-xl overflow-hidden">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover aspect-video"
            />
            <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-lg">
              <span className="text-sm font-medium">Guest user</span>
            </div>
            {!remoteVideoRef.current?.srcObject && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p>Waiting for guest to join...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Controls */}
      <footer className="p-6">
        <div className="flex items-center justify-center gap-6">
          {/* Record Button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isUploading}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${
              isRecording 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-gray-800 hover:bg-gray-700'
            } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="w-12 h-12 flex items-center justify-center">
              {isRecording ? (
                <div className="w-6 h-6 bg-white rounded-sm" />
              ) : (
                <div className="w-8 h-8 bg-red-500 rounded-full" />
              )}
            </div>
            <span className="text-sm font-medium">
              {isRecording ? 'Stop' : 'Record'}
            </span>
          </button>

          {/* Other Controls */}
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
            onClick={() => router.push('/dashboard')}
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