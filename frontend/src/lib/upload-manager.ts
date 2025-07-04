import { RecordingAPI, GenerateUploadUrlRequest, ConfirmUploadRequest } from './api';

export interface ChunkUpload {
  id: string; // Unique identifier for this chunk
  recordingId: string;
  chunkIndex: number;
  chunkBlob: Blob;
  startTime: number;
  endTime: number;
  userType: 'host' | 'guest';
  contentType: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'confirmed' | 'failed';
  attempts: number;
  maxRetries: number;
  createdAt: number;
  lastAttemptAt?: number;
  error?: string;
  filePath?: string;
  etag?: string;
}

export interface UploadProgress {
  percentage: number;
  chunkInfo: string;
  status: string;
  chunksUploaded: number;
  totalChunks: number;
  failedChunks: number;
}

export type UploadProgressCallback = (progress: UploadProgress) => void;

/**
 * Robust upload manager with retry logic, exponential backoff, and localStorage persistence
 * Implements Step 2 of the reliable upload architecture
 */
export class UploadManager {
  private readonly STORAGE_KEY = 'riverside_upload_queue';
  private readonly MAX_RETRIES = 5;
  private readonly INITIAL_RETRY_DELAY = 2000; // 2 seconds
  private readonly MAX_RETRY_DELAY = 30000; // 30 seconds
  private readonly CONCURRENT_UPLOADS = 3; // Max parallel uploads

  private uploadQueue: Map<string, ChunkUpload> = new Map();
  private activeUploads = 0;
  private progressCallback?: UploadProgressCallback;
  private isProcessing = false;

  constructor(progressCallback?: UploadProgressCallback) {
    this.progressCallback = progressCallback;
    this.loadFromStorage();
    
    // Resume any pending uploads on initialization
    if (this.uploadQueue.size > 0) {
      console.log(`📦 Upload manager initialized with ${this.uploadQueue.size} pending chunks`);
      this.processQueue();
    }
  }

  /**
   * Add a new chunk to the upload queue
   */
  addChunk(
    recordingId: string,
    chunkIndex: number,
    chunkBlob: Blob,
    startTime: number,
    endTime: number,
    userType: 'host' | 'guest' = 'host',
    contentType: string = 'video/webm'
  ): string {
    const chunkId = `${recordingId}_${chunkIndex}_${Date.now()}`;
    
    const chunk: ChunkUpload = {
      id: chunkId,
      recordingId,
      chunkIndex,
      chunkBlob,
      startTime,
      endTime,
      userType,
      contentType,
      status: 'pending',
      attempts: 0,
      maxRetries: this.MAX_RETRIES,
      createdAt: Date.now(),
    };

    this.uploadQueue.set(chunkId, chunk);
    this.saveToStorage();
    
    console.log(`📝 Added chunk ${chunkIndex} to upload queue (ID: ${chunkId})`);
    this.updateProgress();
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return chunkId;
  }

  /**
   * Process the upload queue with concurrent uploads and retry logic
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    console.log('🚀 Starting upload queue processing...');

    try {
      while (this.hasWorkToProcess()) {
        const pendingChunks = Array.from(this.uploadQueue.values()).filter(
          chunk => chunk.status === 'pending' || 
          (chunk.status === 'failed' && chunk.attempts < chunk.maxRetries)
        );

        // Process chunks in parallel up to the concurrent limit
        const uploadsToStart = pendingChunks
          .slice(0, this.CONCURRENT_UPLOADS - this.activeUploads)
          .filter(() => this.activeUploads < this.CONCURRENT_UPLOADS);

        if (uploadsToStart.length === 0) {
          // Wait a bit before checking again
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // Start uploads in parallel
        const uploadPromises = uploadsToStart.map(chunk => this.uploadChunkWithRetry(chunk));
        await Promise.allSettled(uploadPromises);
      }
    } finally {
      this.isProcessing = false;
      console.log('✅ Upload queue processing completed');
      this.updateProgress();
    }
  }

  /**
   * Upload a single chunk with retry logic and exponential backoff
   */
  private async uploadChunkWithRetry(chunk: ChunkUpload): Promise<void> {
    this.activeUploads++;
    
    try {
      while (chunk.attempts < chunk.maxRetries) {
        try {
          chunk.attempts++;
          chunk.lastAttemptAt = Date.now();
          chunk.status = 'uploading';
          this.updateChunk(chunk);

          console.log(`🔄 Uploading chunk ${chunk.chunkIndex}, attempt ${chunk.attempts}/${chunk.maxRetries}`);

          // Step 1: Generate pre-signed URL
          const uploadUrlRequest: GenerateUploadUrlRequest = {
            recording_id: chunk.recordingId,
            chunk_index: chunk.chunkIndex,
            content_type: chunk.contentType,
            user_type: chunk.userType,
          };

          const uploadUrlResponse = await RecordingAPI.generateUploadUrl(uploadUrlRequest);
          console.log(`📡 Generated pre-signed URL for chunk ${chunk.chunkIndex}`);

          // Step 2: Upload directly to cloud storage
          const etag = await RecordingAPI.uploadChunkToCloud(
            uploadUrlResponse.pre_signed_url,
            chunk.chunkBlob,
            chunk.contentType
          );

          console.log(`☁️ Successfully uploaded chunk ${chunk.chunkIndex} to cloud (ETag: ${etag})`);

          // Step 3: Confirm upload with backend
          const confirmRequest: ConfirmUploadRequest = {
            recording_id: chunk.recordingId,
            chunk_index: chunk.chunkIndex,
            file_path: uploadUrlResponse.file_path,
            etag: etag,
            user_type: chunk.userType,
          };

          await RecordingAPI.confirmUpload(confirmRequest);
          
          // Success!
          chunk.status = 'confirmed';
          chunk.filePath = uploadUrlResponse.file_path;
          chunk.etag = etag;
          chunk.error = undefined;
          
          console.log(`✅ Chunk ${chunk.chunkIndex} upload confirmed by backend`);
          this.updateChunk(chunk);
          break; // Exit retry loop on success

        } catch (error) {
          console.error(`❌ Upload attempt ${chunk.attempts} failed for chunk ${chunk.chunkIndex}:`, error);
          
          chunk.error = error instanceof Error ? error.message : String(error);
          
          if (chunk.attempts >= chunk.maxRetries) {
            chunk.status = 'failed';
            console.error(`💀 Chunk ${chunk.chunkIndex} failed permanently after ${chunk.attempts} attempts`);
          } else {
            chunk.status = 'failed'; // Will be retried
            
            // Exponential backoff with jitter
            const baseDelay = Math.min(
              this.INITIAL_RETRY_DELAY * Math.pow(2, chunk.attempts - 1),
              this.MAX_RETRY_DELAY
            );
            const jitter = Math.random() * 1000; // Add up to 1 second of jitter
            const retryDelay = baseDelay + jitter;
            
            console.log(`⏳ Retrying chunk ${chunk.chunkIndex} in ${Math.round(retryDelay)}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
          
          this.updateChunk(chunk);
        }
      }
    } finally {
      this.activeUploads--;
    }
  }

  /**
   * Check if there's work to process in the queue
   */
  private hasWorkToProcess(): boolean {
    return Array.from(this.uploadQueue.values()).some(
      chunk => chunk.status === 'pending' || 
      (chunk.status === 'failed' && chunk.attempts < chunk.maxRetries)
    );
  }

  /**
   * Update a chunk in the queue and save to storage
   */
  private updateChunk(chunk: ChunkUpload): void {
    this.uploadQueue.set(chunk.id, chunk);
    this.saveToStorage();
    this.updateProgress();
  }

  /**
   * Update progress and notify callback
   */
  private updateProgress(): void {
    const chunks = Array.from(this.uploadQueue.values());
    const totalChunks = chunks.length;
    const uploadedChunks = chunks.filter(c => c.status === 'confirmed').length;
    const failedChunks = chunks.filter(c => c.status === 'failed' && c.attempts >= c.maxRetries).length;
    
    const percentage = totalChunks > 0 ? Math.round((uploadedChunks / totalChunks) * 100) : 0;
    
    const currentlyUploading = chunks.filter(c => c.status === 'uploading');
    const chunkInfo = currentlyUploading.length > 0 
      ? `Uploading ${currentlyUploading.length} chunks...`
      : uploadedChunks === totalChunks && totalChunks > 0
      ? 'All chunks uploaded!'
      : failedChunks > 0
      ? `${failedChunks} chunks failed`
      : '';

    const status = totalChunks === 0 
      ? ''
      : uploadedChunks === totalChunks 
      ? 'Upload complete'
      : failedChunks > 0
      ? 'Some uploads failed'
      : 'Uploading to cloud…';

    const progress: UploadProgress = {
      percentage,
      chunkInfo,
      status,
      chunksUploaded: uploadedChunks,
      totalChunks,
      failedChunks,
    };

    this.progressCallback?.(progress);
  }

  /**
   * Get upload statistics
   */
  getStats() {
    const chunks = Array.from(this.uploadQueue.values());
    return {
      total: chunks.length,
      pending: chunks.filter(c => c.status === 'pending').length,
      uploading: chunks.filter(c => c.status === 'uploading').length,
      uploaded: chunks.filter(c => c.status === 'confirmed').length,
      failed: chunks.filter(c => c.status === 'failed' && c.attempts >= c.maxRetries).length,
      activeUploads: this.activeUploads,
    };
  }

  /**
   * Clear completed uploads from the queue
   */
  clearCompleted(): void {
    const before = this.uploadQueue.size;
    
    for (const [id, chunk] of this.uploadQueue.entries()) {
      if (chunk.status === 'confirmed') {
        this.uploadQueue.delete(id);
      }
    }
    
    const after = this.uploadQueue.size;
    if (before !== after) {
      console.log(`🧹 Cleared ${before - after} completed uploads from queue`);
      this.saveToStorage();
      this.updateProgress();
    }
  }

  /**
   * Retry failed uploads
   */
  retryFailed(): void {
    const failedChunks = Array.from(this.uploadQueue.values()).filter(
      c => c.status === 'failed' && c.attempts >= c.maxRetries
    );
    
    if (failedChunks.length === 0) {
      console.log('📝 No failed uploads to retry');
      return;
    }

    console.log(`🔄 Retrying ${failedChunks.length} failed uploads...`);
    
    for (const chunk of failedChunks) {
      chunk.status = 'pending';
      chunk.attempts = 0;
      chunk.error = undefined;
      this.updateChunk(chunk);
    }

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Save upload queue to localStorage for persistence
   */
  private saveToStorage(): void {
    try {
      // Only save metadata, not the actual Blob data
      const serializable = Array.from(this.uploadQueue.entries()).map(([id, chunk]) => [
        id,
        {
          ...chunk,
          chunkBlob: undefined, // Don't store Blob in localStorage
          blobSize: chunk.chunkBlob.size,
          blobType: chunk.chunkBlob.type,
        }
      ]);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(serializable));
    } catch (error) {
      console.warn('Failed to save upload queue to localStorage:', error);
    }
  }

  /**
   * Load upload queue from localStorage (metadata only)
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const data = JSON.parse(stored);
      
      // Only load uploads from the last 24 hours to avoid stale data
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      
      for (const [id, chunkData] of data) {
        if (chunkData.createdAt > oneDayAgo) {
          // Create a placeholder Blob since we can't restore the actual data
          const placeholderBlob = new Blob([''], { type: chunkData.blobType || 'video/webm' });
          
          const chunk: ChunkUpload = {
            ...chunkData,
            chunkBlob: placeholderBlob,
          };
          
          // Only restore chunks that weren't confirmed
          if (chunk.status !== 'confirmed') {
            chunk.status = 'failed'; // Mark for potential cleanup
            this.uploadQueue.set(id, chunk);
          }
        }
      }
      
      if (this.uploadQueue.size > 0) {
        console.log(`📦 Restored ${this.uploadQueue.size} upload entries from localStorage`);
      }
    } catch (error) {
      console.warn('Failed to load upload queue from localStorage:', error);
    }
  }

  /**
   * Clear all data (useful for cleanup)
   */
  clear(): void {
    // Stop any ongoing processing
    this.isProcessing = false;
    
    // Clear the upload queue
    this.uploadQueue.clear();
    
    // Remove from localStorage
    localStorage.removeItem(this.STORAGE_KEY);
    
    // Reset counters
    this.activeUploads = 0;
    
    // Update progress to reflect empty state
    this.updateProgress();
    
    console.log('🧹 Upload queue completely cleared - session ended');
  }
} 