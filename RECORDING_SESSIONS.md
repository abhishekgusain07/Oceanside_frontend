# Multi-Track Recording Sessions

This application includes a complete multi-track audio/video recording platform built with Next.js frontend and FastAPI backend.

## Architecture Overview

The recording platform follows a dual-track approach:
- **Live Communication**: Real-time WebRTC peer-to-peer connections for low-latency video calls
- **High-Quality Recording**: Local MediaRecorder API captures pristine audio/video, uploaded to cloud storage

## Key Components

### Backend (FastAPI)
- **Session Management**: RESTful APIs for creating and managing recording sessions
- **WebSocket Signaling**: Real-time communication for WebRTC handshaking
- **Database**: PostgreSQL with session and participant tracking
- **Cloud Integration**: Pre-signed URLs for direct client-to-cloud uploads

### Frontend (Next.js)
- **Session Creation**: `/createsession` page for hosts to create new sessions
- **Session Joining**: `/session/[sessionId]` page for participants to join
- **WebRTC Manager**: Handles peer-to-peer video connections
- **WebSocket Manager**: Manages real-time signaling
- **Media Controls**: Audio/video toggle, connection status monitoring

## Getting Started

### 1. Environment Setup

Copy the environment files and configure the URLs:

```bash
# Frontend
cp frontend/env.example frontend/.env.local

# Backend  
cp backend/env.example backend/.env
```

Configure the following variables:
```env
# Frontend (.env.local)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:8000

# Backend (.env)
DATABASE_URL=your_postgresql_url
FRONTEND_URL=http://localhost:3000
```

### 2. Start the Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Test the Platform

1. Open [http://localhost:3000](http://localhost:3000)
2. Click "Create Recording Session" 
3. Fill in the session details and create a session
4. Copy the join URL and open it in another browser/tab
5. Join the session from both browsers
6. Grant camera/microphone permissions
7. Test the video call functionality

## API Endpoints

### Sessions
- `POST /api/v1/sessions/create` - Create a new session
- `GET /api/v1/sessions/{session_id}` - Get session details
- `POST /api/v1/sessions/{session_id}/join` - Join a session

### WebSocket
- `WS /ws/{session_id}?participant_id={participant_id}` - Real-time signaling

## WebSocket Message Types

```typescript
enum MessageType {
  WEBRTC_OFFER = "webrtc_offer",
  WEBRTC_ANSWER = "webrtc_answer", 
  ICE_CANDIDATE = "ice_candidate",
  PARTICIPANT_JOINED = "participant_joined",
  PARTICIPANT_LEFT = "participant_left",
  RECORDING_STATUS = "recording_status",
  HEARTBEAT = "heartbeat"
}
```

## Browser Requirements

- **Chrome**: Full support for WebRTC and MediaRecorder
- **Firefox**: Full support for WebRTC and MediaRecorder  
- **Safari**: WebRTC supported, MediaRecorder with limitations
- **Edge**: Full support for WebRTC and MediaRecorder

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check if backend is running on port 8000
   - Verify CORS settings in backend
   - Check firewall/network restrictions

2. **Camera/Microphone Access Denied**
   - Ensure HTTPS in production (WebRTC requires secure context)
   - Check browser permissions
   - Try refreshing the page

3. **Peer Connection Failed**
   - Check STUN/TURN server configuration
   - Verify network connectivity between peers
   - Check firewall settings for WebRTC ports

### Debug Mode

Enable detailed logging by opening browser console. All WebRTC and WebSocket events are logged for debugging.

## Production Deployment

### Backend
- Deploy FastAPI backend to your preferred platform (AWS, GCP, Heroku)
- Configure proper CORS origins
- Set up PostgreSQL database
- Configure cloud storage for recordings

### Frontend  
- Deploy Next.js frontend to Vercel/Netlify
- Update API URLs in environment variables
- Ensure HTTPS for WebRTC functionality

### Additional Considerations
- **STUN/TURN Servers**: Configure for NAT traversal in production
- **Load Balancing**: Use sticky sessions for WebSocket connections
- **Recording Storage**: Set up automated cloud storage with proper access controls
- **Monitoring**: Implement connection quality monitoring and error tracking

## Security Notes

- Sessions are protected by unique IDs
- WebRTC connections are encrypted by default
- Implement proper authentication in production
- Validate all user inputs on the backend
- Use HTTPS in production for secure WebRTC connections

## Future Enhancements

- [ ] Recording playback and management
- [ ] Screen sharing capability
- [ ] Chat messaging during sessions
- [ ] Session recording transcription
- [ ] Advanced audio processing (noise cancellation)
- [ ] Mobile app support
- [ ] Session scheduling and calendar integration 