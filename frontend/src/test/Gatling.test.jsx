import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Gatling from '../components/Gatling';

// Mock the WASM module
vi.mock('@yarichard/wam_message_gatling', () => ({
  gatling_execute_standalone: vi.fn()
}));

import * as wasm from '@yarichard/wam_message_gatling';

describe('Gatling Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the component with default values', () => {
    render(<Gatling />);

    expect(screen.getByText('Gatling Load Test (WASM)')).toBeInTheDocument();
    expect(screen.getByLabelText('Number of Messages')).toHaveValue(10);
    expect(screen.getByLabelText('Messages per Second')).toHaveValue(5);
    expect(screen.getByLabelText('Server URL')).toHaveValue(window.location.origin);
  });

  it('updates input values when user types', async () => {
    const user = userEvent.setup();
    render(<Gatling />);

    const messagesInput = screen.getByLabelText('Number of Messages');
    const msgSecInput = screen.getByLabelText('Messages per Second');
    const urlInput = screen.getByLabelText('Server URL');

    await user.clear(messagesInput);
    await user.type(messagesInput, '20');
    expect(messagesInput).toHaveValue(20);

    await user.clear(msgSecInput);
    await user.type(msgSecInput, '10');
    expect(msgSecInput).toHaveValue(10);

    await user.clear(urlInput);
    await user.type(urlInput, 'http://test.com');
    expect(urlInput).toHaveValue('http://test.com');
  });

  it('disables button when required fields are zero', () => {
    render(<Gatling />);

    const messagesInput = screen.getByLabelText('Number of Messages');
    fireEvent.change(messagesInput, { target: { value: '0' } });

    const button = screen.getByRole('button', { name: /Run Gatling Test/i });
    expect(button).toBeDisabled();
  });

  it('executes gatling test on button click', async () => {
    wasm.gatling_execute_standalone.mockResolvedValue('Test completed successfully');
    
    const user = userEvent.setup();
    render(<Gatling />);

    const button = screen.getByRole('button', { name: /Run Gatling Test/i });
    await user.click(button);

    expect(wasm.gatling_execute_standalone).toHaveBeenCalledWith(10, 5, window.location.origin);
    
    await waitFor(() => {
      expect(screen.getByText('Test completed successfully')).toBeInTheDocument();
    });
  });

  it('displays error message when test fails', async () => {
    wasm.gatling_execute_standalone.mockRejectedValue(new Error('Connection failed'));
    
    const user = userEvent.setup();
    render(<Gatling />);

    const button = screen.getByRole('button', { name: /Run Gatling Test/i });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });
  });

  it('shows loading state during execution', async () => {
    wasm.gatling_execute_standalone.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve('Done'), 100))
    );
    
    const user = userEvent.setup();
    render(<Gatling />);

    const button = screen.getByRole('button', { name: /Run Gatling Test/i });
    await user.click(button);

    // Check loading state
    expect(screen.getByText('Running...')).toBeInTheDocument();
    expect(button).toBeDisabled();

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText('Run Gatling Test')).toBeInTheDocument();
    });
  });

  it('clears previous results when starting new test', async () => {
    wasm.gatling_execute_standalone
      .mockResolvedValueOnce('First result')
      .mockResolvedValueOnce('Second result');
    
    const user = userEvent.setup();
    render(<Gatling />);

    const button = screen.getByRole('button', { name: /Run Gatling Test/i });
    
    // First execution
    await user.click(button);
    await waitFor(() => {
      expect(screen.getByText('First result')).toBeInTheDocument();
    });

    // Second execution
    await user.click(button);
    await waitFor(() => {
      expect(screen.queryByText('First result')).not.toBeInTheDocument();
      expect(screen.getByText('Second result')).toBeInTheDocument();
    });
  });
});
