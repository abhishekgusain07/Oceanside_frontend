"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { SessionAPI } from '@/lib/api';
import { WebSocketManager } from '@/lib/websocket';
import { WebRTCManager } from '@/lib/webrtc';
import { 
  SessionDetailResponse, 
  SessionJoinRequest, 
  WebSocketMessage, 
  MessageType,
  ParticipantResponse 
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Users, 
  Loader,
  Phone,
  PhoneOff,
  Circle
} from 'lucide-react';
import { toast } from 'sonner';

interface JoinFormData {
  userId: string;
  displayName: string;
}

export default function SessionPage() {
  const params = useParams();
  const sessionId = params?.sessionId as string;

  // State management
  const [session, setSession] = useState<SessionDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [participants, setParticipants] = useState<ParticipantResponse[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [connectionStates, setConnectionStates] = useState<Map<string, RTCPeerConnectionState>>(new Map());
  
  // Join form state
  const [joinForm, setJoinForm] = useState<JoinFormData>({
    userId: '',
    displayName: ''
  });
  
  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const wsManager = useRef<WebSocketManager | null>(null);
  const rtcManager = useRef<WebRTCManager | null>(null);
  const participantId = useRef<string>('');

  // Load session data
  useEffect(() => {
    if (!sessionId) return;

    const loadSession = async () => {
      try {
        setIsLoading(true);
        const sessionData = await SessionAPI.getSession(sessionId);
        setSession(sessionData);
        setParticipants(sessionData.participants);
      } catch (err: any) {
        const errorMessage = err.response?.data?.detail || 'Failed to load session';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, [sessionId]);

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    console.log('Received WebSocket message:', message);

    switch (message.type) {
      case MessageType.PARTICIPANT_JOINED:
        toast.success(`${message.participant_id} joined the session`);
        if (rtcManager.current && message.participant_id !== participantId.current) {
          // Initiate connection to new participant
          rtcManager.current.connectToParticipant(message.participant_id!);
        }
        break;

      case MessageType.PARTICIPANT_LEFT:
        toast.info(`${message.participant_id} left the session`);
        if (rtcManager.current) {
          rtcManager.current.disconnectFromParticipant(message.participant_id!);
        }
        break;

      case MessageType.WEBRTC_OFFER:
        if (rtcManager.current && message.data?.offer) {
          rtcManager.current.handleOffer(message.data.offer, message.participant_id!);
        }
        break;

      case MessageType.WEBRTC_ANSWER:
        if (rtcManager.current && message.data?.answer) {
          rtcManager.current.handleAnswer(message.data.answer, message.participant_id!);
        }
        break;

      case MessageType.ICE_CANDIDATE:
        if (rtcManager.current && message.data?.candidate) {
          rtcManager.current.handleIceCandidate(message.data.candidate, message.participant_id!);
        }
        break;

      case MessageType.RECORDING_STATUS:
        console.log('Recording status:', message.data);
        break;
    }
  }, []);

  // Join session
  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!joinForm.userId.trim() || !joinForm.displayName.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setIsLoading(true);
      
      // Join the session via API
      const joinData: SessionJoinRequest = {
        user_id: joinForm.userId,
        display_name: joinForm.displayName
      };
      
      const joinResponse = await SessionAPI.joinSession(sessionId, joinData);
      participantId.current = joinResponse.participant_id;
      
      // Initialize WebSocket connection
      wsManager.current = new WebSocketManager({
        sessionId,
        participantId: participantId.current,
        onMessage: handleWebSocketMessage,
        onConnectionChange: setIsWebSocketConnected,
        onError: (error) => {
          console.error('WebSocket error:', error);
          toast.error('WebSocket connection failed');
        }
      });

      const wsUrl = SessionAPI.getWebSocketUrl(sessionId, participantId.current);
      await wsManager.current.connect(wsUrl);

      // Initialize WebRTC
      rtcManager.current = new WebRTCManager({
        websocketManager: wsManager.current,
        onRemoteStream: (stream, participantId) => {
          console.log('Received remote stream from:', participantId);
          setRemoteStreams(prev => new Map(prev.set(participantId, stream)));
          
          // Set stream to video element
          const videoElement = remoteVideoRefs.current.get(participantId);
          if (videoElement) {
            videoElement.srcObject = stream;
          }
        },
        onRemoteStreamEnded: (participantId) => {
          console.log('Remote stream ended from:', participantId);
          setRemoteStreams(prev => {
            const newMap = new Map(prev);
            newMap.delete(participantId);
            return newMap;
          });
        },
        onConnectionStateChange: (participantId, state) => {
          setConnectionStates(prev => new Map(prev.set(participantId, state)));
        }
      }, participantId.current);

      // Get user media
      console.log('Attempting to get user media...');
      const stream = await rtcManager.current.initializeLocalStream();
      console.log('Got media stream:', stream);
      console.log('Video tracks:', stream.getVideoTracks());
      console.log('Audio tracks:', stream.getAudioTracks());
      
      setLocalStream(stream);

      setIsJoined(true);
      toast.success('Successfully joined the session!');
      
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to join session';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Leave session
  const handleLeaveSession = () => {
    // Cleanup WebRTC
    if (rtcManager.current) {
      rtcManager.current.cleanup();
    }

    // Cleanup WebSocket
    if (wsManager.current) {
      wsManager.current.disconnect();
    }

    // Reset state
    setIsJoined(false);
    setLocalStream(null);
    setRemoteStreams(new Map());
    setIsWebSocketConnected(false);
    
    toast.info('Left the session');
  };

  // Toggle video
  const toggleVideo = () => {
    if (rtcManager.current) {
      const enabled = rtcManager.current.toggleVideo();
      setIsVideoEnabled(enabled);
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (rtcManager.current) {
      const enabled = rtcManager.current.toggleAudio();
      setIsAudioEnabled(enabled);
    }
  };

  // Set local stream to video element when available
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      console.log('Setting local stream to video element');
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rtcManager.current) {
        rtcManager.current.cleanup();
      }
      if (wsManager.current) {
        wsManager.current.disconnect();
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-2xl mx-auto pt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertDescription>
                  {error || 'Session not found'}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{session.title}</h1>
              <p className="text-gray-600">{session.description}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Circle 
                  className={`h-3 w-3 ${isWebSocketConnected ? 'text-green-500 fill-current' : 'text-red-500 fill-current'}`} 
                />
                <span className="text-sm text-gray-600">
                  {isWebSocketConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-gray-600">
                <Users className="h-4 w-4" />
                <span>{participants.length}/{session.max_participants}</span>
              </div>
            </div>
          </div>
        </div>

        {!isJoined ? (
          // Join Form
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Join Session</CardTitle>
                <CardDescription>
                  Enter your details to join the recording session
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleJoinSession} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="userId">User ID</Label>
                    <Input
                      id="userId"
                      placeholder="Enter your user ID"
                      value={joinForm.userId}
                      onChange={(e) => setJoinForm(prev => ({...prev, userId: e.target.value}))}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      placeholder="Enter your display name"
                      value={joinForm.displayName}
                      onChange={(e) => setJoinForm(prev => ({...prev, displayName: e.target.value}))}
                      required
                    />
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Joining...' : 'Join Session'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : (
          // Video Call Interface
          <div className="space-y-6">
            {/* Local Video */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>You ({joinForm.displayName})</span>
                  <div className="flex gap-2">
                    <Button
                      variant={isVideoEnabled ? "default" : "destructive"}
                      size="sm"
                      onClick={toggleVideo}
                    >
                      {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant={isAudioEnabled ? "default" : "destructive"}
                      size="sm"
                      onClick={toggleAudio}
                    >
                      {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleLeaveSession}
                    >
                      <PhoneOff className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-64 bg-gray-900 rounded-lg"
                />
              </CardContent>
            </Card>

            {/* Remote Videos */}
            {Array.from(remoteStreams.entries()).map(([participantId, stream]) => (
              <Card key={participantId}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Participant: {participantId}</span>
                    <div className="flex items-center gap-2">
                      <Circle 
                        className={`h-3 w-3 ${
                          connectionStates.get(participantId) === 'connected' 
                            ? 'text-green-500 fill-current' 
                            : 'text-yellow-500 fill-current'
                        }`} 
                      />
                      <span className="text-sm text-gray-600">
                        {connectionStates.get(participantId) || 'connecting'}
                      </span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <video
                    ref={(el) => {
                      if (el) {
                        remoteVideoRefs.current.set(participantId, el);
                        el.srcObject = stream;
                      }
                    }}
                    autoPlay
                    playsInline
                    className="w-full h-64 bg-gray-900 rounded-lg"
                  />
                </CardContent>
              </Card>
            ))}

            {remoteStreams.size === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Waiting for other participants to join...</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 