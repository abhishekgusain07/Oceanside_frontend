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
              endpoints: {
          sessions: '/api/sessions',
          createSession: '/api/sessions/create',
          joinSession: (sessionId: string) => `/api/sessions/${sessionId}/join`,
          getSession: (sessionId: string) => `/api/sessions/${sessionId}`,
        }
    },
    websocket: {
      baseUrl: process.env.NEXT_PUBLIC_WS_BASE_URL || 'ws://localhost:8000',
      endpoint: (sessionId: string) => `/ws/${sessionId}`,
    }
  };
  
  export default config;