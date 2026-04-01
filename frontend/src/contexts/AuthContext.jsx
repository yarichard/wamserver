import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext(null);

const TOKEN_KEY = 'wam_access_token';

function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function isTokenValid(token) {
  if (!token) return false;
  try {
    const { exp } = jwtDecode(token);
    return Date.now() / 1000 < exp;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    const stored = getStoredToken();
    return isTokenValid(stored) ? stored : null;
  });

  const currentUser = isTokenValid(token) ? jwtDecode(token) : null;
  const isAuthenticated = currentUser !== null;

  const login = useCallback(async (email, password) => {
    const res = await axios.post('/api/auth/login', { email, password });
    const { access_token } = res.data;
    localStorage.setItem(TOKEN_KEY, access_token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    setToken(access_token);
  }, []);

  const register = useCallback(async (email, name, password) => {
    await axios.post('/api/auth/register', { email, name, password });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
  }, []);

  // Restore axios header on mount if token exists
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  return (
    <AuthContext.Provider value={{ login, register, logout, currentUser, isAuthenticated, token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
