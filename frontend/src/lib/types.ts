// TODO: Add new recording types here to match the new backend architecture
// These will replace the old session types

// WebSocket message types (keeping for WebRTC compatibility)
export enum MessageType {
  WEBRTC_OFFER = "webrtc_offer",
  WEBRTC_ANSWER = "webrtc_answer", 
  ICE_CANDIDATE = "ice_candidate",
  RECORDING_STATUS = "recording_status",
  PARTICIPANT_JOINED = "participant_joined",
  PARTICIPANT_LEFT = "participant_left",
  HEARTBEAT = "heartbeat",
  ERROR = "error"
}

export interface WebSocketMessage {
  type: MessageType;
  data?: any;
  target_participant?: string;
  timestamp?: string;
  participant_id?: string;
}

// WebRTC types (keeping for compatibility)
export interface RTCOfferMessage {
  type: MessageType.WEBRTC_OFFER;
  offer: RTCSessionDescriptionInit;
  target_participant: string;
}

export interface RTCAnswerMessage {
  type: MessageType.WEBRTC_ANSWER;
  answer: RTCSessionDescriptionInit;
  target_participant: string;
}

export interface RTCIceCandidateMessage {
  type: MessageType.ICE_CANDIDATE;
  candidate: RTCIceCandidateInit;
  target_participant: string;
}

export interface ParticipantJoinedMessage {
  type: MessageType.PARTICIPANT_JOINED;
  participant_id: string;
  session_participants: string[];
  timestamp: string;
}

export interface ParticipantLeftMessage {
  type: MessageType.PARTICIPANT_LEFT;
  participant_id: string;
  session_participants: string[];
  timestamp: string;
} 