import axios from 'axios';
import config from '@/config';
import { 
  SessionCreateRequest, 
  SessionCreateResponse, 
  SessionJoinRequest, 
  SessionJoinResponse, 
  SessionDetailResponse 
} from '@/lib/types';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: config.api.baseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth headers if needed
api.interceptors.request.use(
  (config) => {
    // Add authentication token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling common errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export class SessionAPI {
  /**
   * Create a new recording session
   */
  static async createSession(sessionData: SessionCreateRequest): Promise<SessionCreateResponse> {
    try {
      const response = await api.post<SessionCreateResponse>(
        config.api.endpoints.createSession,
        sessionData
      );
      return response.data;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Get session details by ID
   */
  static async getSession(sessionId: string): Promise<SessionDetailResponse> {
    try {
      const response = await api.get<SessionDetailResponse>(
        config.api.endpoints.getSession(sessionId)
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get session:', error);
      throw error;
    }
  }

  /**
   * Join an existing session
   */
  static async joinSession(sessionId: string, joinData: SessionJoinRequest): Promise<SessionJoinResponse> {
    try {
      const response = await api.post<SessionJoinResponse>(
        config.api.endpoints.joinSession(sessionId),
        joinData
      );
      return response.data;
    } catch (error) {
      console.error('Failed to join session:', error);
      throw error;
    }
  }

  /**
   * Build WebSocket URL for a session
   */
  static getWebSocketUrl(sessionId: string, participantId: string): string {
    const wsUrl = `${config.websocket.baseUrl}${config.websocket.endpoint(sessionId)}?participant_id=${participantId}`;
    return wsUrl;
  }
}

export default api; 