import React, { createContext, useContext, useEffect, useState } from 'react';
import config from '../config';

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('wam_access_token');
    // Append JWT token as query param for WebSocket auth
    const wsUrl = token
      ? `${config.ws.url}?token=${encodeURIComponent(token)}`
      : config.ws.url;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket Connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.msg_type === 'message') {
          setMessages(prev => {
            const newMessage = data.message;
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) return prev;
            return [newMessage, ...prev];
          });
        } else if (data.msg_type === 'sytral') {
          setVehicles(data.message.vehicles);
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  const value = {
    socket,
    messages,
    setMessages,
    vehicles,
    setVehicles
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}
