"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { RecordingAPI, type GuestTokenResponse } from '@/lib/api';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import config from '@/config';

interface UploadProgress {
  percentage: number;
  chunkInfo: string;
  status: string;
}

export default function StudioRoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;
  const { user, isAuthenticated, isLoading } = useUser();
  
  // State management
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
  const [roomReady, setRoomReady] = useState(false);
  
  // Refs for video elements and recording
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  
  // Recording state tracking (like your other project)
  const chunkIndexRef = useRef(0);
  const recordingStartTimeRef = useRef<number | null>(null);
  const currentChunkStartTimeRef = useRef(0);
  const chunkRecordingStartTimeRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize room on component mount
  useEffect(() => {
    if (isAuthenticated && user && roomId) {
      initializeRoom();
    }
  }, [isAuthenticated, user, roomId]);

  // Ensure video element gets the stream when it's available
  useEffect(() => {
    if (localStreamRef.current && localVideoRef.current && !localVideoRef.current.srcObject) {
      console.log('Assigning stream to video element in effect');
      localVideoRef.current.srcObject = localStreamRef.current;
      
      // Try to play the video
      localVideoRef.current.play().catch(error => {
        console.warn('Video autoplay failed in effect:', error);
      });
    }
  }, [roomReady]);

  // Additional effect to ensure video connection when both stream and video ref are ready
  useEffect(() => {
    const checkAndSetVideo = () => {
      if (localStreamRef.current && localVideoRef.current && !localVideoRef.current.srcObject) {
        console.log('Setting video source in additional effect');
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(error => {
          console.warn('Video autoplay failed in additional effect:', error);
        });
      }
    };
    
    // Check immediately
    checkAndSetVideo();
    
    // Also check after a short delay to handle timing issues
    const timeout = setTimeout(checkAndSetVideo, 200);
    
    return () => clearTimeout(timeout);
  }, [localStreamRef.current, roomReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('Cleaning up room resources...');
      
      // Clear recording timer
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
      }
      
      // Stop recording if active
      if (isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      
      if (socketRef.current) {
        socketRef.current.disconnect();
        console.log('Disconnected from Socket.IO');
      }
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`Stopped ${track.kind} track:`, track.label);
        });
        localStreamRef.current = null;
        console.log('Stopped all media tracks');
      }
      
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        console.log('Closed peer connection');
      }
    };
  }, [isRecording]);

  const initializeRoom = async () => {
    try {
      // Validate user data
      if (!user?.id) {
        toast.error('User not found. Please sign in again.');
        router.push('/sign-in');
        return;
      }

      if (!roomId) {
        toast.error('Invalid room ID.');
        router.push('/studio');
        return;
      }

      // Fetch recording details to get title
      try {
        const recording = await RecordingAPI.getRecording(roomId);
        setRecordingTitle(recording.title || 'Untitled Recording');
      } catch (error) {
        console.error('Failed to fetch recording details:', error);
        // Continue anyway, might be a newly created room
      }
      
      // Initialize media stream
      await initializeMedia();
      
      // Initialize Socket.IO connection
      initializeSocket(roomId);
      
      setRoomReady(true);
      
    } catch (error) {
      console.error('Failed to initialize room:', error);
      toast.error('Failed to initialize recording session');
      router.push('/studio');
    }
  };

  const initializeMedia = async () => {
    try {
      console.log('Requesting camera and microphone access for room...');
      
      // Wait a bit to ensure previous streams are fully released
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      console.log('Successfully got media stream with tracks:', 
        stream.getTracks().map(track => `${track.kind}: ${track.label}`));
      
      localStreamRef.current = stream;
      
      // Try to set video source with retry mechanism
      const setVideoSource = async (retryCount = 0) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          console.log('Set video source object');
          
          // Force video to load and play
          try {
            await localVideoRef.current.load();
            await localVideoRef.current.play();
            console.log('Video playing successfully');
          } catch (playError) {
            console.warn('Video autoplay failed (this is normal in some browsers):', playError);
          }
        } else if (retryCount < 3) {
          console.warn(`localVideoRef.current is null, retrying in 100ms (attempt ${retryCount + 1}/3)`);
          setTimeout(() => setVideoSource(retryCount + 1), 100);
        } else {
          console.error('localVideoRef.current is still null after 3 retries - video element may not be mounted');
        }
      };
      
      await setVideoSource();
      
    } catch (error) {
      console.error('Failed to access media devices:', error);
      
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          toast.error('Camera and microphone access denied. Please check your browser permissions.');
        } else if (error.name === 'NotFoundError') {
          toast.error('No camera or microphone found. Please check your devices.');
        } else if (error.name === 'NotReadableError') {
          toast.error('Camera or microphone is already in use by another application.');
        } else {
          toast.error('Failed to access camera and microphone');
        }
      } else {
        toast.error('Failed to access camera and microphone');
      }
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
      socket.emit('join_room', roomId);
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
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: 'turn:relay1.expressturn.com:3480',
          username: '000000002066064322',
          credential: 'WmntrHEmhe1gxXsKPOygktWz3+s='
        }
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
        socketRef.current.emit('ice_candidate', {
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
    console.log('startRecording called, socketRef exists:', !!socketRef.current);
    if (socketRef.current) {
      console.log('Emitting start_recording_request for room:', roomId);
      socketRef.current.emit('start_recording_request', roomId);
    } else {
      console.error('No socket connection available for starting recording');
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
    if (!localStreamRef.current) return;

    // Initialize recording session state
    chunkIndexRef.current = 0;
    recordingStartTimeRef.current = Date.now();
    currentChunkStartTimeRef.current = 0;
    
    console.log('🎬 Starting new recording session at:', recordingStartTimeRef.current);
    
    // Start the first chunk recorder
    startNewRecorder();
  };

  const startNewRecorder = () => {
    // Don't start if recording has been stopped or no stream available
    if (!isRecording || !localStreamRef.current) {
      console.log('❌ Cannot start recorder - isRecording:', isRecording, 'hasStream:', !!localStreamRef.current);
      return;
    }

    console.log('🔴 Starting new chunk recorder...');
    console.log('📹 Using stream with tracks:', localStreamRef.current.getTracks().map(t => `${t.kind}: ${t.label}`));

    // Recording configuration (like your other project)
    const options: any = {
      audioBitsPerSecond: 128000,
      videoBitsPerSecond: 4000000,
    };

    // Try different mimeTypes in order of preference
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus', 
      'video/webm',
      'video/mp4;codecs=h264,aac',
      'video/mp4'
    ];
    
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        options.mimeType = mimeType;
        console.log('✅ Using mimeType:', mimeType);
        break;
      }
    }

    // IMPORTANT: Make sure the video element still has the stream
    if (localVideoRef.current && !localVideoRef.current.srcObject) {
      console.log('🔧 Re-assigning stream to video element before recording...');
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(e => console.warn('Video play failed:', e));
    }

    // Create new MediaRecorder instance for this chunk
    const mediaRecorder = new MediaRecorder(localStreamRef.current, options);
    mediaRecorderRef.current = mediaRecorder;

    // This fires when chunk data becomes available
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && recordingStartTimeRef.current && chunkRecordingStartTimeRef.current) {
        chunkIndexRef.current++;

        // Calculate actual chunk duration
        const chunkEndTime = Date.now();
        const actualChunkDuration = chunkEndTime - chunkRecordingStartTimeRef.current;
        
        // Calculate timestamps relative to recording start
        const startTime = currentChunkStartTimeRef.current;
        const endTime = startTime + actualChunkDuration;
        
        // Update for next chunk
        currentChunkStartTimeRef.current = endTime;

        const chunkBlob = event.data;
        
        console.log(`📦 Chunk ${chunkIndexRef.current} ready: ${startTime}ms - ${endTime}ms (${actualChunkDuration}ms duration)`);
        
        // IMMEDIATE UPLOAD - No waiting!
        uploadChunkImmediately(chunkBlob, startTime, endTime);
      }
    };

    // When this recorder stops, automatically start the next one
    mediaRecorder.onstop = () => {
      if (isRecording) {
        console.log('⏭️  Chunk finished, starting next recorder in 300ms...');
        setTimeout(() => {
          startNewRecorder(); // Recursive call creates continuous loop
        }, 300); // RESTART_DELAY_MS = 300
      }
    };

    // Start recording THIS chunk
    mediaRecorder.start();
    chunkRecordingStartTimeRef.current = Date.now();
    console.log('🔴 Chunk recorder started');

    // Auto-stop this chunk after 5 seconds to trigger next chunk
    recordingTimerRef.current = setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === "recording" && isRecording) {
        console.log('⏰ 5 seconds up, stopping chunk recorder...');
        mediaRecorder.stop(); // This triggers ondataavailable
      }
    }, 5000); // CHUNK_DURATION_MS = 5000
  };

  const uploadChunkImmediately = async (chunkBlob: Blob, startTime: number, endTime: number) => {
    console.log(`🚀 Uploading chunk ${chunkIndexRef.current} immediately...`);
    
    // Show upload status to user (update the existing upload progress)
    setUploadProgress({
      percentage: 0,
      chunkInfo: `Uploading chunk ${chunkIndexRef.current}...`,
      status: 'Uploading to cloud…'
    });

    // Prepare form data for upload
    const formData = new FormData();
    formData.append("file", chunkBlob, `chunk-${chunkIndexRef.current}.webm`);
    formData.append("room_id", roomId);
    formData.append("user_type", "host");
    formData.append("start_time", (startTime / 1000).toString()); // Convert to seconds
    formData.append("end_time", (endTime / 1000).toString());     // Convert to seconds
    formData.append("chunk_index", chunkIndexRef.current.toString());

    try {
      // Upload immediately - no batching or waiting
      await RecordingAPI.uploadChunk(formData);
      console.log(`✅ Chunk ${chunkIndexRef.current} uploaded successfully`);
    } catch (err) {
      console.error("Upload failed", err);
      toast.error(`Failed to upload chunk ${chunkIndexRef.current}`);
    }
  };

  const stopRecording = () => {
    console.log('🛑 stopRecording called, isRecording:', isRecording, 'mediaRecorder exists:', !!mediaRecorderRef.current);
    
    // Set recording state to false to stop the recursive chunk creation
    setIsRecording(false);
    
    // Clear any pending timer
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    // Stop current chunk recorder if it's recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      console.log('🛑 Stopping current chunk recorder...');
      mediaRecorderRef.current.stop();
    }
    
    // Emit socket event
    if (socketRef.current) {
      console.log('📡 Emitting recording_stopped event...');
      socketRef.current.emit('recording_stopped', {
        roomId: roomId,
        userId: user?.id
      });
    }

    console.log(`🏁 Recording session complete. Total chunks: ${chunkIndexRef.current}`);
    
    // Update recording title one final time
    RecordingAPI.updateTitle(roomId, recordingTitle).catch(err => 
      console.error('Failed to update final title:', err)
    );

    // Clear upload progress UI
    setUploadProgress({
      percentage: 100,
      chunkInfo: '',
      status: 'Recording completed'
    });

    // Just show completion message - DON'T redirect to dashboard
    // User should stay in the room until they click "Leave"
    setTimeout(() => {
      toast.success('Recording completed! All chunks uploaded successfully.');
      // Clear the upload progress after showing success
      setTimeout(() => {
        setUploadProgress({
          percentage: 0,
          chunkInfo: '',
          status: ''
        });
      }, 3000);
    }, 1000);
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

  const retryVideoConnection = async () => {
    console.log('Retrying video connection...');
    
    // Stop existing stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Clear video element
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    // Reinitialize media
    await initializeMedia();
    
    toast.success('Video connection retried');
  };

  const leaveRoom = () => {
    console.log('🚪 Leaving room...');
    
    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }
    
    // Stop all media tracks to turn off camera/mic
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`🔴 Stopped ${track.kind} track:`, track.label);
      });
      localStreamRef.current = null;
    }
    
    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Clear any recording timers
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    toast.success('Left the room');
    
    // Now redirect to dashboard
    router.push('/dashboard');
  };

  if (isLoading || !roomReady) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <div>Setting up recording session...</div>
        </div>
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
          onClick={() => router.push('/studio')}
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
          {/* Upload Progress - Now shows during recording when chunks upload */}
          {(isUploading || (isRecording && uploadProgress.chunkInfo)) && (
            <div className="flex items-center gap-3 bg-gray-800 px-4 py-2 rounded-lg">
              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-sm">
                <div className="text-white">
                  {isRecording ? 'Live Upload' : 'Uploading Recording'}
                </div>
                <div className="text-gray-400 text-xs">{uploadProgress.chunkInfo}</div>
              </div>
              {uploadProgress.percentage > 0 && (
                <div className="text-purple-400 text-sm">{uploadProgress.percentage}%</div>
              )}
            </div>
          )}

          {/* Recording Indicator */}
          {isRecording && (
            <div className="flex items-center gap-2 bg-red-600 px-3 py-2 rounded-lg">
              <div className="w-3 h-3 bg-red-300 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Recording</span>
            </div>
          )}

          {/* Retry Video Button (shown when no video) */}
          {localStreamRef.current && !localVideoRef.current?.srcObject && (
            <button
              onClick={retryVideoConnection}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors text-sm"
            >
              Retry Video
            </button>
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
              onLoadedMetadata={() => console.log('📺 Video metadata loaded')}
              onCanPlay={() => console.log('📺 Video can play')}
              onPlay={() => console.log('📺 Video started playing')}
              onPause={() => console.log('⏸️ Video paused')}
              onEnded={() => console.log('🔚 Video ended')}
              onError={(e) => console.error('❌ Video error:', e)}
              onLoadStart={() => console.log('📺 Video load start')}
              onWaiting={() => console.log('⏳ Video waiting')}
            />
            <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-lg">
              <span className="text-sm font-medium">{user?.name || 'You'}</span>
            </div>
            {/* Debug info */}
            {localStreamRef.current && (
              <div className="absolute top-4 left-4 bg-green-600/80 px-2 py-1 rounded text-xs">
                Stream Active: {localStreamRef.current.getTracks().length} tracks
                {isRecording && ' (Recording)'}
              </div>
            )}
            {!localVideoRef.current?.srcObject && localStreamRef.current && (
              <div className="absolute top-4 right-4 bg-red-600/80 px-2 py-1 rounded text-xs">
                No Video Source - Stream Available
              </div>
            )}
            {!localStreamRef.current && (
              <div className="absolute top-4 right-4 bg-red-600/80 px-2 py-1 rounded text-xs">
                No Stream Available
              </div>
            )}
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
                  <p className="text-sm text-gray-500 mt-2">Room ID: {roomId}</p>
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
            onClick={() => {
              console.log('Record button clicked, isRecording:', isRecording, 'isUploading:', isUploading);
              if (isRecording) {
                stopRecording();
              } else {
                startRecording();
              }
            }}
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
            onClick={leaveRoom}
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