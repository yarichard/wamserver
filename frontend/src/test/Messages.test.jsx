import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Messages from '../components/Messages';
import * as WebSocketContext from '../contexts/WebSocketContext';

// Mock the WebSocket context
vi.mock('../contexts/WebSocketContext', () => ({
  useWebSocket: vi.fn()
}));

// Mock the DataGrid component from MUI to avoid CSS import issues
vi.mock('@mui/x-data-grid', () => ({
  DataGrid: ({ rows }) => (
    <div data-testid="data-grid">
      {rows.map(row => (
        <div key={row.id} data-testid={`row-${row.id}`}>
          <span>{row.text}</span>
        </div>
      ))}
    </div>
  )
}));

describe('Messages Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders messages from context', () => {
    const mockMessages = [
      { id: 1, text: 'Hello World', user_id: 1 },
      { id: 2, text: 'Test Message', user_id: 2 }
    ];

    WebSocketContext.useWebSocket.mockReturnValue({
      messages: mockMessages,
      setMessages: vi.fn()
    });

    render(<Messages />);

    expect(screen.getByText('Hello World')).toBeInTheDocument();
    expect(screen.getByText('Test Message')).toBeInTheDocument();
  });

  it('renders empty grid when no messages', () => {
    WebSocketContext.useWebSocket.mockReturnValue({
      messages: [],
      setMessages: vi.fn()
    });

    render(<Messages />);

    const dataGrid = screen.getByTestId('data-grid');
    expect(dataGrid).toBeInTheDocument();
    expect(dataGrid.children.length).toBe(0);
  });

  it('initializes with messages from props when context is empty', () => {
    const setMessagesMock = vi.fn();
    const initialMessages = [
      { id: 1, text: 'Initial Message', user_id: 1 }
    ];

    WebSocketContext.useWebSocket.mockReturnValue({
      messages: [],
      setMessages: setMessagesMock
    });

    render(<Messages messages={initialMessages} />);

    // Check that setMessages was called with initial messages
    expect(setMessagesMock).toHaveBeenCalledWith(initialMessages);
  });

  it('does not override context messages when they exist', () => {
    const setMessagesMock = vi.fn();
    const contextMessages = [
      { id: 1, text: 'Context Message', user_id: 1 }
    ];
    const propMessages = [
      { id: 2, text: 'Prop Message', user_id: 2 }
    ];

    WebSocketContext.useWebSocket.mockReturnValue({
      messages: contextMessages,
      setMessages: setMessagesMock
    });

    render(<Messages messages={propMessages} />);

    // Should not call setMessages when context already has messages
    expect(setMessagesMock).not.toHaveBeenCalled();
    expect(screen.getByText('Context Message')).toBeInTheDocument();
  });

  it('renders multiple messages correctly', () => {
    const mockMessages = [
      { id: 1, text: 'Message 1', user_id: 1 },
      { id: 2, text: 'Message 2', user_id: 2 },
      { id: 3, text: 'Message 3', user_id: 3 }
    ];

    WebSocketContext.useWebSocket.mockReturnValue({
      messages: mockMessages,
      setMessages: vi.fn()
    });

    render(<Messages />);

    expect(screen.getByText('Message 1')).toBeInTheDocument();
    expect(screen.getByText('Message 2')).toBeInTheDocument();
    expect(screen.getByText('Message 3')).toBeInTheDocument();
  });
});
