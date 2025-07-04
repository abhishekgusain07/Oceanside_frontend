# Reliable Upload Architecture Plan

This document outlines a robust and scalable architecture for handling user-generated recording uploads directly from the client to cloud storage.

The primary goal is to ensure **100% reliability**: if a recording session is completed successfully, the media is guaranteed to be processed and available. This architecture is designed to be scalable, cost-effective, and resilient to network interruptions.

## Core Concept: Backend-Orchestrated, Client-Direct Upload

Instead of the client sending large media files to our backend (which then uploads them to the cloud), the client will upload them directly to the cloud. The backend's role shifts from being a data proxy to a secure orchestrator.

**The flow is as follows:**
1.  **Client:** A recording chunk is ready for upload.
2.  **Client -> Backend:** The client requests a secure, one-time upload URL from the backend.
3.  **Backend -> Client:** The backend authenticates the request, generates a temporary **pre-signed URL** for the specific cloud storage path, and sends it back to the client.
4.  **Client -> Cloud Storage:** The client uses this pre-signed URL to upload the chunk directly to the cloud storage bucket. This uses the user's bandwidth and bypasses our backend server for the heavy lifting.
5.  **Client -> Backend:** Upon a successful upload, the client notifies the backend that the chunk is ready.
6.  **Backend:** The backend verifies that the file exists in cloud storage and marks the chunk as "uploaded" in its database. Once all chunks for a recording are verified, it enqueues the final video stitching job for Celery.

---

## Detailed Implementation Steps

### 1. Pre-signed URL Generation (Backend)

This is the security cornerstone of the architecture.

-   Create a new backend endpoint, e.g., `POST /api/v1/recordings/generate-upload-url`.
-   This endpoint requires authentication to ensure only the correct user can get an upload link for their own recording.
-   The request body from the client should include:
    -   `recording_id`: The ID of the overall recording session.
    -   `chunk_index`: The sequential number of the chunk (e.g., 1, 2, 3...).
    -   `content_type`: The MIME type of the file (e.g., `video/webm`).
-   On the backend, use the cloud storage provider's SDK (e.g., `boto3` for R2/S3) to generate a pre-signed URL for a `PUT` operation.
-   The object key (the file path in the bucket) should be structured and unique, for example: `uploads/{recording_id}/user_{user_id}_chunk_{chunk_index}.webm`.
-   The pre-signed URL should have a short expiration time (e.g., 5-15 minutes) to limit its exposure.
-   The backend returns the `preSignedUrl` and the `filePath` to the client.

### 2. Client-Side Upload Logic

-   When a recording chunk is available, the client first calls the `generate-upload-url` endpoint described above.
-   Using the received `preSignedUrl`, the client performs a `PUT` request directly to that URL with the video chunk data as the request body and the correct `Content-Type` header.

### 3. Reliability: Error Handling and Retries (Client-Side)

This is critical for achieving the 100% reliability goal.

-   **Implement a Retry Mechanism:** Network requests can fail. The client-side upload logic *must* include a retry mechanism with exponential backoff. If an upload fails, wait 2 seconds, retry. If it fails again, wait 4 seconds, then 8, and so on, up to a maximum number of retries.
-   **Resume on Refresh:** Store the upload queue and the status of each chunk in the browser's `localStorage`. If the user accidentally refreshes the page, the application can read from `localStorage` and resume uploading any chunks that weren't confirmed as uploaded.

### 4. Upload Confirmation and Verification (Client -> Backend)

Trust but verify.

-   Create a new backend endpoint, e.g., `POST /api/v1/recordings/confirm-upload`.
-   After the client gets a successful (e.g., 200 OK) response from the cloud storage after its `PUT` request, it **must** call this new endpoint.
-   The request body should include:
    -   `recording_id`
    -   `chunk_index`
    -   `filePath`: The path of the file in the bucket.
    -   `eTag`: The ETag (a checksum of the file) returned by the cloud storage provider in the response headers of the successful upload.
-   The backend receives this confirmation and, as a final verification step, can use the cloud storage SDK to perform a `head_object` request on the `filePath`. This is a lightweight operation to confirm the object exists and its ETag matches before marking the chunk as successfully uploaded in the database.

### 5. Triggering the Final Job (Backend)

-   After a chunk is confirmed, the backend should check if all expected chunks for that `recording_id` have now been successfully uploaded.
-   If and only if all chunks are present and verified, the backend enqueues the video stitching task to Celery, passing the list of file paths for the chunks.

---

## Advantages of this Architecture

1.  **Scalability:** Your backend is no longer a bottleneck. It only handles lightweight JSON requests, allowing you to serve a massive number of concurrent uploads without scaling your server resources proportionally.
2.  **Reliability & Consistency:** The "confirm and verify" loop ensures that a chunk is never considered complete until the backend has proof it exists in the cloud. The client-side retry logic handles transient network failures.
3.  **Cost-Effectiveness:** You significantly reduce your server's bandwidth costs, as the data is transferred on the user's bandwidth.
4.  **Security:** At no point are your permanent cloud storage credentials exposed to the client. Pre-signed URLs provide secure, temporary, and narrowly-scoped access.
