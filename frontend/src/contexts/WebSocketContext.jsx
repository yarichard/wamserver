import React, { createContext, useContext, useEffect, useState } from 'react';
import config from '../config';

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    // Create WebSocket connection using config
    const wsUrl = config.ws.url;
    
    console.log(`Connecting to WebSocket: ${wsUrl}`);
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
            // Check if message with this ID already exists
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) {
              return prev; // Don't add duplicate message
            }
            // Add new message at the beginning
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

    // Cleanup on unmount
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