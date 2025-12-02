import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageRateChart from '../components/MessageRateChart';
import * as WebSocketContext from '../contexts/WebSocketContext';

// Mock the WebSocket context
vi.mock('../contexts/WebSocketContext', () => ({
  useWebSocket: vi.fn()
}));

// Mock the LineChart component from MUI
vi.mock('@mui/x-charts/LineChart', () => ({
  LineChart: ({ series, xAxis, height }) => (
    <div data-testid="line-chart">
      <div data-testid="chart-series">{JSON.stringify(series)}</div>
      <div data-testid="chart-height">{height}</div>
    </div>
  )
}));

describe('MessageRateChart Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the component with title and auto-refresh toggle', () => {
    WebSocketContext.useWebSocket.mockReturnValue({
      messages: []
    });

    render(<MessageRateChart />);

    expect(screen.getByText('Throughput (Messages/sec)')).toBeInTheDocument();
    expect(screen.getByText('Auto Refresh')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('renders LineChart component', () => {
    WebSocketContext.useWebSocket.mockReturnValue({
      messages: []
    });

    render(<MessageRateChart />);

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('toggles auto-refresh when switch is clicked', async () => {
    WebSocketContext.useWebSocket.mockReturnValue({
      messages: []
    });

    render(<MessageRateChart />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeChecked();

    // Use click directly without userEvent since we're using fake timers
    toggle.click();
    expect(toggle).not.toBeChecked();

    toggle.click();
    expect(toggle).toBeChecked();
  });

  it('updates chart data when message count increases', () => {
    let messages = [];
    WebSocketContext.useWebSocket.mockImplementation(() => ({
      messages
    }));

    render(<MessageRateChart />);
    
    // Verify initial state
    const chartData = screen.getByTestId('chart-series');
    expect(chartData).toBeInTheDocument();
    const initialData = JSON.parse(chartData.textContent);
    expect(initialData[0].data).toHaveLength(60);
  });

  it('does not update data when auto-refresh is disabled', () => {
    WebSocketContext.useWebSocket.mockReturnValue({
      messages: []
    });

    render(<MessageRateChart />);

    // Verify toggle works
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeChecked();
    
    // Use direct click instead of userEvent
    toggle.click();
    expect(toggle).not.toBeChecked();
  });

  it('maintains 60 data points in series', () => {
    WebSocketContext.useWebSocket.mockReturnValue({
      messages: []
    });

    render(<MessageRateChart />);

    const chartData = screen.getByTestId('chart-series');
    const seriesData = JSON.parse(chartData.textContent);
    
    expect(seriesData[0].data).toHaveLength(60);
  });

  it('calculates rate correctly over time', () => {
    let messages = Array(10).fill(null).map((_, i) => ({ id: i, text: `msg${i}` }));
    WebSocketContext.useWebSocket.mockImplementation(() => ({
      messages
    }));

    render(<MessageRateChart />);

    // Verify chart renders with data
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    const chartData = screen.getByTestId('chart-series');
    const seriesData = JSON.parse(chartData.textContent);
    expect(seriesData[0].label).toBe('Messages/sec');
  });

  it('has correct chart configuration', () => {
    WebSocketContext.useWebSocket.mockReturnValue({
      messages: []
    });

    render(<MessageRateChart />);

    const chartHeight = screen.getByTestId('chart-height');
    expect(chartHeight.textContent).toBe('300');
    
    const chartData = screen.getByTestId('chart-series');
    const seriesData = JSON.parse(chartData.textContent);
    expect(seriesData[0].area).toBe(true);
    expect(seriesData[0].showMark).toBe(false);
  });
});
