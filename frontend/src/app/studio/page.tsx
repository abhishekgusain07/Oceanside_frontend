"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { RecordingAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function StudioPreSessionPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useUser();
  
  // State management
  const [recordingTitle, setRecordingTitle] = useState('Untitled Recording');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  
  // Refs for media testing
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Initialize media on component mount
  useEffect(() => {
    if (isAuthenticated) {
      initializeMedia();
    }
  }, [isAuthenticated]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        console.log('Cleaning up media streams on unmount');
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`Stopped ${track.kind} track on unmount:`, track.label);
        });
        localStreamRef.current = null;
      }
    };
  }, []);

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
      
      setMediaReady(true);
      
    } catch (error) {
      console.error('Failed to access media devices:', error);
      toast.error('Failed to access camera and microphone. Please check your permissions.');
    }
  };

  const toggleMicrophone = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !micEnabled;
      });
      setMicEnabled(!micEnabled);
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !cameraEnabled;
      });
      setCameraEnabled(!cameraEnabled);
    }
  };

  const createRoom = async () => {
    if (!user?.id) {
      toast.error('User not found. Please sign in again.');
      router.push('/sign-in');
      return;
    }

    setIsCreatingRoom(true);
    
    try {
      // Create a new recording session
      const recording = await RecordingAPI.createRecording({
        user_id: user.id,
        title: recordingTitle.trim() || undefined,
        max_participants: 10
      });
      
      // Stop the media stream since we'll reinitialize it in the room
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`Stopped ${track.kind} track:`, track.label);
        });
        localStreamRef.current = null;
      }
      
      // Clear the video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      
      // Wait a moment for cleanup, then redirect
      setTimeout(() => {
        router.push(`/studio/${recording.room_id}`);
      }, 100);
      
    } catch (error) {
      console.error('Failed to create room:', error);
      toast.error('Failed to create recording session');
    } finally {
      setIsCreatingRoom(false);
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
          <span>Back to Dashboard</span>
        </button>

        <h1 className="text-xl font-semibold">Create New Recording Session</h1>
        <div className="w-32"></div> {/* Spacer for layout balance */}
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Setup Steps */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2">Setup Your Recording</h2>
            <p className="text-gray-400">Test your camera and microphone before creating your recording room.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Video Preview */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Camera Preview</h3>
              <div className="relative bg-gray-800 rounded-xl overflow-hidden border-2 border-gray-600">
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
                {!cameraEnabled && (
                  <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <div className="w-16 h-16 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          <line x1="2" y1="2" x2="22" y2="22" />
                        </svg>
                      </div>
                      <p>Camera is disabled</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Device Controls */}
              <div className="flex gap-4">
                <button
                  onClick={toggleMicrophone}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    micEnabled 
                      ? 'bg-gray-800 hover:bg-gray-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {micEnabled ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    ) : (
                      <>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        <line x1="2" y1="2" x2="22" y2="22" />
                      </>
                    )}
                  </svg>
                  {micEnabled ? 'Microphone On' : 'Microphone Off'}
                </button>

                <button
                  onClick={toggleCamera}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    cameraEnabled 
                      ? 'bg-gray-800 hover:bg-gray-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {cameraEnabled ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    ) : (
                      <>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        <line x1="2" y1="2" x2="22" y2="22" />
                      </>
                    )}
                  </svg>
                  {cameraEnabled ? 'Camera On' : 'Camera Off'}
                </button>
              </div>

              {!mediaReady && (
                <div className="bg-yellow-600/20 border border-yellow-600 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.3c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <p className="text-yellow-300 font-medium">Camera/Microphone Access Required</p>
                      <p className="text-yellow-200 text-sm">Please allow camera and microphone access to continue.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Session Configuration */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Session Details</h3>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
                      Recording Title
                    </label>
                    <input
                      id="title"
                      type="text"
                      value={recordingTitle}
                      onChange={(e) => setRecordingTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter recording title..."
                    />
                  </div>

                  <div className="bg-gray-800 rounded-lg p-4">
                    <h4 className="font-medium mb-3">Session Features</h4>
                    <ul className="space-y-2 text-sm text-gray-300">
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Up to 10 participants
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        High-quality video recording
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Real-time collaboration
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Cloud storage and processing
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Create Room Button */}
              <div className="pt-4">
                <button
                  onClick={createRoom}
                  disabled={!mediaReady || isCreatingRoom}
                  className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all ${
                    !mediaReady || isCreatingRoom
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-purple-500/25'
                  }`}
                >
                  {isCreatingRoom ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating Room...
                    </div>
                  ) : (
                    'Create Recording Room'
                  )}
                </button>
                
                {!mediaReady && (
                  <p className="text-gray-400 text-sm text-center mt-2">
                    Please enable camera and microphone access to continue
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 