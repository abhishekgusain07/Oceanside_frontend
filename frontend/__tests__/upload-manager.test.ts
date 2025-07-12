/**
 * Unit tests for UploadManager
 */
import { UploadManager, ChunkUpload, UploadProgress } from '@/lib/upload-manager';
import { RecordingAPI } from '@/lib/api';

// Mock the RecordingAPI
jest.mock('@/lib/api', () => ({
  RecordingAPI: {
    generateUploadUrl: jest.fn(),
    uploadChunkToCloud: jest.fn(),
    confirmUpload: jest.fn(),
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('UploadManager', () => {
  let uploadManager: UploadManager;
  let mockProgressCallback: jest.Mock;
  let mockRecordingAPI: jest.Mocked<typeof RecordingAPI>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockProgressCallback = jest.fn();
    mockRecordingAPI = RecordingAPI as jest.Mocked<typeof RecordingAPI>;

    // Clear localStorage mock
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockImplementation(() => {});
    localStorageMock.removeItem.mockImplementation(() => {});

    uploadManager = new UploadManager(mockProgressCallback);
  });

  afterEach(() => {
    uploadManager.clear();
  });

  describe('addChunk', () => {
    it('should add a chunk to the upload queue', () => {
      const mockBlob = new Blob(['test data'], { type: 'video/webm' });

      const chunkId = uploadManager.addChunk(
        'room-123',
        1,
        mockBlob,
        0,
        5000,
        'host',
        'video/webm'
      );

      expect(chunkId).toBeDefined();
      expect(chunkId).toContain('room-123_1_');
      expect(mockProgressCallback).toHaveBeenCalled();

      const stats = uploadManager.getStats();
      expect(stats.total).toBe(1);
      expect(stats.pending).toBe(1);
    });

    it('should save chunk metadata to localStorage', () => {
      const mockBlob = new Blob(['test data'], { type: 'video/webm' });

      uploadManager.addChunk(
        'room-123',
        1,
        mockBlob,
        0,
        5000,
        'host',
        'video/webm'
      );

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'riverside_upload_queue',
        expect.stringContaining('room-123')
      );
    });
  });

  describe('processQueue', () => {
    it('should process chunks with successful upload flow', async () => {
      // Mock successful API responses
      mockRecordingAPI.generateUploadUrl.mockResolvedValue({
        pre_signed_url: 'https://r2.example.com/upload',
        file_path: 'uploads/room-123/host_chunk_1.webm',
        expires_in: 900,
        expires_at: '2025-01-01T01:00:00Z',
      });

      mockRecordingAPI.uploadChunkToCloud.mockResolvedValue('etag-123');

      mockRecordingAPI.confirmUpload.mockResolvedValue({
        success: true,
        message: 'Upload confirmed',
      });

      const mockBlob = new Blob(['test data'], { type: 'video/webm' });
      uploadManager.addChunk('room-123', 1, mockBlob, 0, 5000, 'host', 'video/webm');

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify API calls were made
      expect(mockRecordingAPI.generateUploadUrl).toHaveBeenCalledWith({
        recording_id: 'room-123',
        chunk_index: 1,
        content_type: 'video/webm',
        user_type: 'host',
      });

      expect(mockRecordingAPI.uploadChunkToCloud).toHaveBeenCalledWith(
        'https://r2.example.com/upload',
        mockBlob,
        'video/webm'
      );

      expect(mockRecordingAPI.confirmUpload).toHaveBeenCalledWith({
        recording_id: 'room-123',
        chunk_index: 1,
        file_path: 'uploads/room-123/host_chunk_1.webm',
        etag: 'etag-123',
        user_type: 'host',
      });

      // Check final stats
      const stats = uploadManager.getStats();
      expect(stats.uploaded).toBe(1);
      expect(stats.failed).toBe(0);
    });

    it('should retry failed uploads with exponential backoff', async () => {
      // Mock failed API call followed by success
      mockRecordingAPI.generateUploadUrl
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          pre_signed_url: 'https://r2.example.com/upload',
          file_path: 'uploads/room-123/host_chunk_1.webm',
          expires_in: 900,
          expires_at: '2025-01-01T01:00:00Z',
        });

      mockRecordingAPI.uploadChunkToCloud.mockResolvedValue('etag-123');
      mockRecordingAPI.confirmUpload.mockResolvedValue({
        success: true,
        message: 'Upload confirmed',
      });

      const mockBlob = new Blob(['test data'], { type: 'video/webm' });
      uploadManager.addChunk('room-123', 1, mockBlob, 0, 5000, 'host', 'video/webm');

      // Wait for processing to complete (including retry delay)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Should have retried and eventually succeeded
      expect(mockRecordingAPI.generateUploadUrl).toHaveBeenCalledTimes(2);
      
      const stats = uploadManager.getStats();
      expect(stats.uploaded).toBe(1);
    });

    it('should mark chunks as permanently failed after max retries', async () => {
      // Mock API call to always fail
      mockRecordingAPI.generateUploadUrl.mockRejectedValue(new Error('Network error'));

      const mockBlob = new Blob(['test data'], { type: 'video/webm' });
      uploadManager.addChunk('room-123', 1, mockBlob, 0, 5000, 'host', 'video/webm');

      // Wait for all retries to complete
      await new Promise(resolve => setTimeout(resolve, 10000));

      const stats = uploadManager.getStats();
      expect(stats.failed).toBe(1);
      expect(stats.uploaded).toBe(0);
    });
  });

  describe('progress tracking', () => {
    it('should call progress callback with correct data', () => {
      const mockBlob1 = new Blob(['test data 1'], { type: 'video/webm' });
      const mockBlob2 = new Blob(['test data 2'], { type: 'video/webm' });

      uploadManager.addChunk('room-123', 1, mockBlob1, 0, 5000, 'host', 'video/webm');
      uploadManager.addChunk('room-123', 2, mockBlob2, 5000, 10000, 'host', 'video/webm');

      expect(mockProgressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          totalChunks: 2,
          chunksUploaded: 0,
          failedChunks: 0,
          percentage: 0,
        })
      );
    });

    it('should update progress as chunks complete', async () => {
      // Mock successful upload
      mockRecordingAPI.generateUploadUrl.mockResolvedValue({
        pre_signed_url: 'https://r2.example.com/upload',
        file_path: 'uploads/room-123/host_chunk_1.webm',
        expires_in: 900,
        expires_at: '2025-01-01T01:00:00Z',
      });
      mockRecordingAPI.uploadChunkToCloud.mockResolvedValue('etag-123');
      mockRecordingAPI.confirmUpload.mockResolvedValue({
        success: true,
        message: 'Upload confirmed',
      });

      const mockBlob = new Blob(['test data'], { type: 'video/webm' });
      uploadManager.addChunk('room-123', 1, mockBlob, 0, 5000, 'host', 'video/webm');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have called progress callback with completion
      expect(mockProgressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          totalChunks: 1,
          chunksUploaded: 1,
          percentage: 100,
          status: 'Upload complete',
        })
      );
    });
  });

  describe('retry functionality', () => {
    it('should retry failed chunks when retryFailed is called', async () => {
      // Mock initial failure
      mockRecordingAPI.generateUploadUrl.mockRejectedValue(new Error('Network error'));

      const mockBlob = new Blob(['test data'], { type: 'video/webm' });
      uploadManager.addChunk('room-123', 1, mockBlob, 0, 5000, 'host', 'video/webm');

      // Wait for failure
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Now mock success for retry
      mockRecordingAPI.generateUploadUrl.mockResolvedValue({
        pre_signed_url: 'https://r2.example.com/upload',
        file_path: 'uploads/room-123/host_chunk_1.webm',
        expires_in: 900,
        expires_at: '2025-01-01T01:00:00Z',
      });
      mockRecordingAPI.uploadChunkToCloud.mockResolvedValue('etag-123');
      mockRecordingAPI.confirmUpload.mockResolvedValue({
        success: true,
        message: 'Upload confirmed',
      });

      // Retry failed uploads
      uploadManager.retryFailed();

      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = uploadManager.getStats();
      expect(stats.uploaded).toBe(1);
      expect(stats.failed).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should clear all data when clear is called', () => {
      const mockBlob = new Blob(['test data'], { type: 'video/webm' });
      uploadManager.addChunk('room-123', 1, mockBlob, 0, 5000, 'host', 'video/webm');

      uploadManager.clear();

      const stats = uploadManager.getStats();
      expect(stats.total).toBe(0);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('riverside_upload_queue');
    });

    it('should clear only completed uploads when clearCompleted is called', () => {
      // Add a completed chunk (would need to mock the completion process)
      const mockBlob = new Blob(['test data'], { type: 'video/webm' });
      uploadManager.addChunk('room-123', 1, mockBlob, 0, 5000, 'host', 'video/webm');

      // Manually mark as completed for testing
      const queue = (uploadManager as any).uploadQueue as Map<string, ChunkUpload>;
      for (const chunk of queue.values()) {
        chunk.status = 'confirmed';
      }

      uploadManager.clearCompleted();

      const stats = uploadManager.getStats();
      expect(stats.total).toBe(0);
    });
  });

  describe('localStorage persistence', () => {
    it('should restore chunks from localStorage on initialization', () => {
      const mockStoredData = JSON.stringify([
        [
          'chunk-1',
          {
            id: 'chunk-1',
            recordingId: 'room-123',
            chunkIndex: 1,
            startTime: 0,
            endTime: 5000,
            userType: 'host',
            contentType: 'video/webm',
            status: 'pending',
            attempts: 0,
            maxRetries: 5,
            createdAt: Date.now(),
            blobSize: 1000,
            blobType: 'video/webm',
          },
        ],
      ]);

      localStorageMock.getItem.mockReturnValue(mockStoredData);

      const newUploadManager = new UploadManager(mockProgressCallback);
      const stats = newUploadManager.getStats();

      expect(stats.total).toBe(1);
    });

    it('should not restore old chunks from localStorage', () => {
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const mockStoredData = JSON.stringify([
        [
          'chunk-1',
          {
            id: 'chunk-1',
            recordingId: 'room-123',
            chunkIndex: 1,
            startTime: 0,
            endTime: 5000,
            userType: 'host',
            contentType: 'video/webm',
            status: 'pending',
            attempts: 0,
            maxRetries: 5,
            createdAt: oldTimestamp,
            blobSize: 1000,
            blobType: 'video/webm',
          },
        ],
      ]);

      localStorageMock.getItem.mockReturnValue(mockStoredData);

      const newUploadManager = new UploadManager(mockProgressCallback);
      const stats = newUploadManager.getStats();

      expect(stats.total).toBe(0);
    });
  });
});