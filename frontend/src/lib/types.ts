// Session types
export interface SessionCreateRequest {
  user_id: string;
  title: string;
  description?: string;
  max_participants?: number;
}

export interface SessionCreateResponse {
  session_id: string;
  title: string;
  description?: string;
  host_user_id: string;
  status: string;
  max_participants: number;
  created_at: string;
  join_url: string;
  participants: ParticipantResponse[];
}

export interface SessionDetailResponse {
  session_id: string;
  title: string;
  description?: string;
  host_user_id: string;
  status: string;
  max_participants: number;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  participants: ParticipantResponse[];
  participant_count: number;
}

export interface SessionJoinRequest {
  user_id: string;
  display_name: string;
}

export interface SessionJoinResponse {
  session_id: string;
  participant_id: string;
  display_name: string;
  websocket_url: string;
  participants: ParticipantResponse[];
}

export interface ParticipantResponse {
  id: string;
  user_id: string;
  display_name: string;
  is_host: boolean;
  status: string;
  joined_at: string;
}

// WebSocket message types
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

// WebRTC types
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
  timestamp: string;
}

export interface ParticipantLeftMessage {
  type: MessageType.PARTICIPANT_LEFT;
  participant_id: string;
  timestamp: string;
} 