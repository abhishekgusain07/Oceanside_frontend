const config = {
    auth: {
      enabled: true,
    },
    payments: {
      enabled: true,
    },
    analytics: {
      posthog: {
        enabled: process.env.NEXT_PUBLIC_POSTHOG_KEY ? true : false,
        apiKey: process.env.NEXT_PUBLIC_POSTHOG_KEY,
        apiHost: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      },
    },
    monitoring: {
      sentry: {
        enabled: process.env.NEXT_PUBLIC_SENTRY_DSN ? true : false,
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        // Optional configuration
        tracesSampleRate: 1.0, // Capture 100% of transactions for performance monitoring
        profilesSampleRate: 1.0, // Capture 100% of profiles for performance monitoring
      },
    },
    api: {
      baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
      // All recording endpoints with proper /api prefix
      endpoints: {
        // Recording CRUD operations
        recordings: '/api/recordings',
        createRecording: '/api/recordings',
        getRecording: (roomId: string) => `/api/recordings/${roomId}`,
        getUserRecordings: '/api/recordings',
        
        // Guest token operations
        generateGuestToken: (roomId: string) => `/api/recordings/${roomId}/guest-token`,
        generateToken: '/api/recordings/generatetoken',
        
        // Upload operations
        uploadUrl: '/api/recordings/upload-url',
        uploadChunk: '/api/recordings/upload-chunk',
        
        // Recording management
        updateTitle: '/api/recordings/update-title',
        turnCredentials: '/api/recordings/turn-credentials',
        
        // Health check
        health: '/api/health',
      }
    },
    socketio: {
      baseUrl: process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
    },
    
    // Utility function to construct full API URLs
    getApiUrl: (endpoint: string) => {
      const baseUrl = config.api.baseUrl;
      // Ensure endpoint starts with /api
      const normalizedEndpoint = endpoint.startsWith('/api') ? endpoint : `/api${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
      return `${baseUrl}${normalizedEndpoint}`;
    }
  };
  
  export default config;