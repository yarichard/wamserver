import axios from 'axios';

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

// Construct WebSocket URL (token appended at runtime by WebSocketContext)
config.ws.url = `${config.ws.protocol}//${config.ws.host}/api/ws`;

// Axios interceptor: redirect to /login on 401
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('wam_access_token');
      delete axios.defaults.headers.common['Authorization'];
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default config;
