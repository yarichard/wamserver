import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import LoginPage from '../components/LoginPage';
import { AuthProvider } from '../contexts/AuthContext';

vi.mock('axios');

const Wrapper = ({ children }) => (
  <MemoryRouter>
    <AuthProvider>{children}</AuthProvider>
  </MemoryRouter>
);

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders email and password fields', () => {
    render(<LoginPage />, { wrapper: Wrapper });
    expect(screen.getByLabelText(/email/i)).toBeDefined();
    expect(screen.getByLabelText(/password/i)).toBeDefined();
  });

  it('shows error on 401 response', async () => {
    axios.post.mockRejectedValueOnce({ response: { status: 401 } });

    render(<LoginPage />, { wrapper: Wrapper });

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'bad@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeDefined();
    });
  });

  it('calls login with correct credentials', async () => {
    axios.post.mockResolvedValueOnce({ data: { access_token: 'fake.jwt.token' } });

    render(<LoginPage />, { wrapper: Wrapper });

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correctpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/auth/login', {
        email: 'user@example.com',
        password: 'correctpass',
      });
    });
  });
});
