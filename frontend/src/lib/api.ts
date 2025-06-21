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
  baseURL: config.api.baseUrl + config.api.endpoints.sessions,
  timeout: 30000,
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

  /**
   * Delete a session (only by host)
   */
  static async deleteSession(sessionId: string, userId: string): Promise<void> {
    const response = await fetch(`${config.api.baseUrl}/sessions/${sessionId}?user_id=${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Session not found or access denied');
      }
      if (response.status === 403) {
        throw new Error('Only the host can delete the session');
      }
      throw new Error(`Failed to delete session: ${response.statusText}`);
    }
  }

  /**
   * Cleanup old sessions
   */
  static async cleanupOldSessions(daysOld: number = 7): Promise<{
    message: string;
    sessions_cleaned: number;
    days_threshold: number;
  }> {
    const response = await fetch(`${config.api.baseUrl + config.api.endpoints.sessions}/cleanup?days_old=${daysOld}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to cleanup sessions: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get user's sessions
   */
  static async getUserSessions(userId: string, limit: number = 50): Promise<SessionDetailResponse[]> {
    const response = await fetch(`${config.api.baseUrl + config.api.endpoints.sessions}/user/${userId}?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user sessions: ${response.statusText}`);
    }

    return response.json();
  }
}

export default api; 