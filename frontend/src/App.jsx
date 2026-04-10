import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import axios from 'axios';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Button,
} from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import Users from './components/Users';
import Messages from './components/Messages';
import Vehicles from './components/Vehicles';
import LoginPage from './components/LoginPage';
import PrivateRoute from './components/PrivateRoute';

function Navigation() {
  const location = useLocation();
  const { logout } = useAuth();

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
        <Button color="inherit" onClick={logout}>
          Sign out
        </Button>
      </Toolbar>
    </AppBar>
  );
}

function MainApp() {
  const { currentUser } = useAuth();
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

  const updateUser = async (id, name) => {
    await axios.put(`/api/user/${id}`, { name });
    setUsers(users.map(u => u.id === id ? { ...u, name } : u));
  };

  const createUser = async (name, email) => {
    const res = await axios.post('/api/user', { name, email });
    setUsers(prev => [...prev, { id: res.data.id, name, email }]);
    return res.data.password;
  };

  const deleteUser = async (id) => {
    await axios.delete(`/api/user/${id}`);
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const changeUserPassword = async (id, currentPassword, newPassword) => {
    await axios.patch(`/api/user/${id}/password`, { current_password: currentPassword, new_password: newPassword });
  };

  return (
    <WebSocketProvider>
      <Box sx={{ flexGrow: 1 }}>
        <Navigation />
        <Container maxWidth="xl" sx={{ px: 1 }}>
          <Box sx={{ mt: 4 }}>
            <Box sx={{ mt: 4 }}>
              <Routes>
                <Route path="users" element={<Users users={users} onUpdateUser={updateUser} onCreateUser={createUser} onDeleteUser={deleteUser} onChangePassword={changeUserPassword} currentUserId={currentUser?.sub} />} />
                <Route path="messages" element={<Messages messages={messages} />} />
                <Route path="vehicles" element={<Vehicles />} />
              </Routes>
            </Box>
          </Box>
        </Container>
      </Box>
    </WebSocketProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/front/*"
            element={
              <PrivateRoute>
                <MainApp />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/front/users" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
