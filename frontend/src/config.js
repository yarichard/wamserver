// Environment configuration
const config = {
  // WebSocket configuration
  ws: {
    // In production, use the actual domain. In development, use localhost
    host: import.meta.env.VITE_WS_HOST || window.location.host,
    // Auto-detect protocol based on current page protocol
    protocol: window.location.protocol === 'https:' ? 'wss:' : 'ws:',
  },
  // API configuration
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || '',
  }
};

// Construct WebSocket URL
config.ws.url = `${config.ws.protocol}//${config.ws.host}/api/ws`;

export default config;
