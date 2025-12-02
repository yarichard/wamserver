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
  Paper,
  Grid,
} from '@mui/material';
import { WebSocketProvider } from './contexts/WebSocketContext';
import Users from './components/Users';
import Messages from './components/Messages';
import Gatling from './components/Gatling';
import MessageRateChart from './components/MessageRateChart';

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
      </Toolbar>
    </AppBar>
  );
}

function App() {
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [kafkaParams, setKafkaParams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersResponse, messagesResponse, paramsResponse] = await Promise.all([
          axios.get('/api/user'),
          axios.get('/api/message'),
          axios.get('/api/parameters')
        ]);
        setUsers(usersResponse.data);
        setMessages(messagesResponse.data);
        setKafkaParams(paramsResponse.data);
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
        <Container maxWidth="lg">
            <Box sx={{ mt: 4 }}>
              <Grid container spacing={3} sx={{ alignItems: 'stretch' }}>
                <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
                  {kafkaParams ? (
                    <Paper elevation={2} sx={{ p: 3, flex: 1 }}>
                      <Typography variant="h5" gutterBottom>
                        Kafka Configuration
                      </Typography>
                      <Typography><strong>URL:</strong> {kafkaParams.kafka_url}</Typography>
                      <Typography><strong>Topic:</strong> {kafkaParams.kafka_topic}</Typography>
                      <Typography><strong>Group:</strong> {kafkaParams.kafka_group}</Typography>
                    </Paper>
                  ) : (
                    <Paper elevation={2} sx={{ p: 3, flex: 1 }}>
                      <Typography variant="h5" gutterBottom>
                        Kafka Configuration
                      </Typography>
                      <Typography color="text.secondary">Loading configuration...</Typography>
                    </Paper>
                  )}
                </Grid>
                
                <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
                  <Gatling />
                </Grid>
              </Grid>

              <Box sx={{ mt: 3 }}>
                <MessageRateChart />
              </Box>

              <Box sx={{ mt: 4 }}>
                <Routes>
                  <Route path="/front/users" element={<Users users={users} />} />
                  <Route path="/front/messages" element={<Messages messages={messages} />} />
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