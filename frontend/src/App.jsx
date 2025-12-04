import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Button,
} from '@mui/material';
import { WebSocketProvider } from './contexts/WebSocketContext';
import Users from './components/Users';
import Messages from './components/Messages';
import Vehicles from './components/Vehicles';

function Navigation() {
  const location = useLocation();
  
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          WAM Server
        </Typography>
        <Button
          color="inherit"
          component={Link}
          to="/front/users"
          sx={{ 
            textDecoration: 'none',
            backgroundColor: location.pathname === '/front/users' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
          }}
        >
          Users
        </Button>
        <Button
          color="inherit"
          component={Link}
          to="/front/messages"
          sx={{ 
            textDecoration: 'none',
            backgroundColor: location.pathname === '/front/messages' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
          }}
        >
          Messages
        </Button>
        <Button
          color="inherit"
          component={Link}
          to="/front/vehicles"
          sx={{ 
            textDecoration: 'none',
            backgroundColor: location.pathname === '/front/vehicles' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
          }}
        >
          Vehicles
        </Button>
      </Toolbar>
    </AppBar>
  );
}

function App() {
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersResponse, messagesResponse] = await Promise.all([
          axios.get('/api/user'),
          axios.get('/api/message')
        ]);
        setUsers(usersResponse.data);
        setMessages(messagesResponse.data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <BrowserRouter>
      <WebSocketProvider>
        <Box sx={{ flexGrow: 1 }}>
          <Navigation />
        <Container maxWidth="xl" sx={{ px: 1 }}>
            <Box sx={{ mt: 4 }}>

              <Box sx={{ mt: 4 }}>
                <Routes>
                  <Route path="/front/users" element={<Users users={users} />} />
                  <Route path="/front/messages" element={<Messages messages={messages} />} />
                  <Route path="/front/vehicles" element={<Vehicles />} />
                </Routes>
              </Box>
            </Box>
          </Container>
        </Box>
      </WebSocketProvider>
    </BrowserRouter>
  );
}

export default App;