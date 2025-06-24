import axios from 'axios';
import config from '@/config';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: config.api.baseUrl,
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
    // Log the attempted URL for debugging
    if (error.config?.url) {
      console.error('Failed URL:', `${error.config.baseURL}${error.config.url}`);
    }
    
    // Special handling for validation errors (422)
    if (error.response?.status === 422) {
      console.error('🚨 Validation Error (422 Unprocessable Content):');
      console.error('Request data:', error.config?.data);
      console.error('Validation details:', error.response.data);
      
      // Show user-friendly error message
      const validationErrors = error.response.data?.detail || error.response.data?.errors || error.response.data;
      if (Array.isArray(validationErrors)) {
        validationErrors.forEach((err, index) => {
          console.error(`Validation Error ${index + 1}:`, err);
        });
      }
    }
    
    return Promise.reject(error);
  }
);

// Types for better type safety - Updated to match backend schemas
export interface CreateRecordingRequest {
  user_id: string; // Changed from host_user_id to user_id
  title?: string; // Optional, matches backend
  description?: string; // Optional, matches backend  
  max_participants?: number; // Optional, defaults to 10 on backend
}

export interface UpdateTitleRequest {
  room_id: string;
  title: string;
}

export interface GenerateTokenRequest {
  room_id: string;
}

export interface GuestTokenCreateRequest {
  guest_name?: string;
  hours_valid?: number; // 1-168 hours
  uses_remaining?: number; // 1-10 uses
}

export interface RecordingUploadUrlRequest {
  room_id: string;
  participant_id: string;
  filename: string;
  media_type: string; // "video" or "audio"
  chunk_index: number;
  content_type?: string; // defaults to "video/webm"
}

// Response types matching backend
export interface RecordingCreateResponse {
  room_id: string;
  recording_id: string;
  join_url: string;
  created_at: string;
}

export interface RecordingResponse {
  id: string;
  room_id: string;
  host_user_id: string;
  title?: string;
  description?: string;
  status: string;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  processed_at?: string;
  video_url?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  max_participants: number;
  processing_attempts: number;
}

export interface GuestTokenResponse {
  token: string;
  expires_at: string;
  join_url: string;
  uses_remaining: number;
}

/**
 * Recording API for the new architecture - uses configured endpoints
 * All endpoints are centrally managed in config.ts to ensure /api prefix is always used
 */
export class RecordingAPI {
  /**
   * Create a new recording session
   * @param data - Recording creation data including user_id and optional title
   * @returns Promise<RecordingCreateResponse> - Recording session data including room_id
   */
  static async createRecording(data: CreateRecordingRequest): Promise<RecordingCreateResponse> {
    try {
      const response = await api.post(config.api.endpoints.createRecording, data);
      return response.data;
    } catch (error) {
      console.error('Failed to create recording:', error);
      throw error;
    }
  }

  /**
   * Get a specific recording by room ID
   * @param roomId - The room ID of the recording
   * @returns Promise<RecordingResponse> - Recording details
   */
  static async getRecording(roomId: string): Promise<RecordingResponse> {
    try {
      const endpoint = config.api.endpoints.getRecording(roomId);
      const response = await api.get(endpoint);
      return response.data;
    } catch (error) {
      console.error('Failed to get recording:', error);
      throw error;
    }
  }

  /**
   * Get all recordings for the current user
   * @returns Promise<any[]> - Array of user's recordings
   */
  static async getUserRecordings() {
    try {
      const response = await api.get(config.api.endpoints.getUserRecordings);
      return response.data;
    } catch (error) {
      console.error('Failed to get user recordings:', error);
      throw error;
    }
  }

  /**
   * Generate a guest token for a specific room
   * @param roomId - The room ID to generate token for
   * @returns Promise<GuestTokenResponse> - Guest token data with expiration and join URL
   */
  static async generateGuestToken(roomId: string): Promise<GuestTokenResponse> {
    try {
      const endpoint = config.api.endpoints.generateGuestToken(roomId);
      const response = await api.post(endpoint);
      return response.data;
    } catch (error) {
      console.error('Failed to generate guest token:', error);
      throw error;
    }
  }

  /**
   * Get upload URL for file uploads
   * @returns Promise<{upload_url: string}> - Upload URL data
   */
  static async getUploadUrl() {
    try {
      const response = await api.get(config.api.endpoints.uploadUrl);
      return response.data;
    } catch (error) {
      console.error('Failed to get upload URL:', error);
      throw error;
    }
  }

  /**
   * Upload a video chunk
   * @param formData - FormData containing chunk file and metadata
   * @returns Promise<any> - Upload response
   */
  static async uploadChunk(formData: FormData) {
    try {
      const response = await api.post(config.api.endpoints.uploadChunk, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // Longer timeout for file uploads
      });
      return response.data;
    } catch (error) {
      console.error('Failed to upload chunk:', error);
      throw error;
    }
  }

  /**
   * Update the title of a recording
   * @param roomId - The room ID of the recording
   * @param title - New title for the recording
   * @returns Promise<any> - Update response
   */
  static async updateTitle(roomId: string, title: string) {
    try {
      const data: UpdateTitleRequest = {
        room_id: roomId,
        title: title,
      };
      const response = await api.post(config.api.endpoints.updateTitle, data);
      return response.data;
    } catch (error) {
      console.error('Failed to update title:', error);
      throw error;
    }
  }

  /**
   * Get TURN credentials for WebRTC
   * @returns Promise<any> - TURN server credentials
   */
  static async getTurnCredentials() {
    try {
      const response = await api.get(config.api.endpoints.turnCredentials);
      return response.data;
    } catch (error) {
      console.error('Failed to get TURN credentials:', error);
      throw error;
    }
  }

  /**
   * Generate a token for a room (alternative endpoint)
   * @param roomId - The room ID to generate token for
   * @returns Promise<{token: string}> - Token data
   */
  static async generateToken(roomId: string) {
    try {
      const data: GenerateTokenRequest = {
        room_id: roomId,
      };
      const response = await api.post(config.api.endpoints.generateToken, data);
      return response.data;
    } catch (error) {
      console.error('Failed to generate token:', error);
      throw error;
    }
  }

  /**
   * Health check endpoint
   * @returns Promise<any> - Health status
   */
  static async healthCheck() {
    try {
      const response = await api.get(config.api.endpoints.health);
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }
}

export default api; 