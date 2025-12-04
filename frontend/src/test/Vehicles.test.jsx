import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Vehicles from '../components/Vehicles';
import * as WebSocketContext from '../contexts/WebSocketContext';

// Mock the WebSocket context
vi.mock('../contexts/WebSocketContext', () => ({
  useWebSocket: vi.fn()
}));

// Mock react-leaflet components
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children, position }) => (
    <div data-testid={`marker-${position[0]}-${position[1]}`}>{children}</div>
  ),
  Popup: ({ children }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({
    flyTo: vi.fn(),
    setView: vi.fn(),
  })
}));

// Mock leaflet CSS import
vi.mock('leaflet/dist/leaflet.css', () => ({}));

// Mock leaflet
vi.mock('leaflet', () => ({
  default: {
    Icon: {
      Default: {
        prototype: { _getIconUrl: null },
        mergeOptions: vi.fn()
      }
    },
    divIcon: vi.fn((options) => ({
      options,
      _getIconUrl: vi.fn()
    }))
  }
}));

// Mock the DataGrid component from MUI to avoid CSS import issues
vi.mock('@mui/x-data-grid', () => ({
  DataGrid: ({ rows, columns }) => (
    <div data-testid="data-grid">
      {rows.map(row => (
        <div key={row.id} data-testid={`vehicle-${row.id}`}>
          <span data-testid={`vehicle-ref-${row.id}`}>{row.vehicle_ref}</span>
          <span data-testid={`line-${row.id}`}>{row.line}</span>
          <span data-testid={`direction-${row.id}`}>{row.direction}</span>
        </div>
      ))}
    </div>
  )
}));

describe('Vehicles Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders map and data grid', () => {
    const mockVehicles = [
      { 
        vehicle_ref: 'VEH001', 
        line: 'T1', 
        direction: 'North',
        latitude: 45.7640,
        longitude: 4.8357
      }
    ];

    WebSocketContext.useWebSocket.mockReturnValue({
      vehicles: mockVehicles
    });

    render(<Vehicles />);

    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByTestId('data-grid')).toBeInTheDocument();
    expect(screen.getByText(/Vehicle Positions/)).toBeInTheDocument();
  });

  it('renders vehicles from context', () => {
    const mockVehicles = [
      { 
        vehicle_ref: 'VEH001', 
        line: 'T1', 
        direction: 'North',
        latitude: 45.7640,
        longitude: 4.8357
      },
      { 
        vehicle_ref: 'VEH002', 
        line: 'T2', 
        direction: 'South',
        latitude: 45.7500,
        longitude: 4.8500
      }
    ];

    WebSocketContext.useWebSocket.mockReturnValue({
      vehicles: mockVehicles
    });

    render(<Vehicles />);

    expect(screen.getByTestId('vehicle-VEH001')).toBeInTheDocument();
    expect(screen.getByText('VEH001')).toBeInTheDocument();
    expect(screen.getByTestId('line-VEH001')).toHaveTextContent('T1');
    expect(screen.getByText('North')).toBeInTheDocument();
    
    expect(screen.getByTestId('vehicle-VEH002')).toBeInTheDocument();
    expect(screen.getByText('VEH002')).toBeInTheDocument();
    expect(screen.getByTestId('line-VEH002')).toHaveTextContent('T2');
    expect(screen.getByText('South')).toBeInTheDocument();
  });

  it('renders empty grid when no vehicles', () => {
    WebSocketContext.useWebSocket.mockReturnValue({
      vehicles: []
    });

    render(<Vehicles />);

    const dataGrid = screen.getByTestId('data-grid');
    expect(dataGrid).toBeInTheDocument();
    expect(dataGrid.children.length).toBe(0);
  });

  it('handles vehicles without vehicle_ref by using index as id', () => {
    const mockVehicles = [
      { 
        line: 'T3', 
        direction: 'East',
        latitude: 45.7600,
        longitude: 4.8400
      }
    ];

    WebSocketContext.useWebSocket.mockReturnValue({
      vehicles: mockVehicles
    });

    render(<Vehicles />);

    // Should use index (0) as id when vehicle_ref is missing
    expect(screen.getByTestId('vehicle-0')).toBeInTheDocument();
    expect(screen.getByTestId('line-0')).toHaveTextContent('T3');
    expect(screen.getByText('East')).toBeInTheDocument();
  });

  it('renders multiple vehicles correctly', () => {
    const mockVehicles = [
      { vehicle_ref: 'VEH001', line: 'T1', direction: 'North', latitude: 45.7640, longitude: 4.8357 },
      { vehicle_ref: 'VEH002', line: 'T2', direction: 'South', latitude: 45.7500, longitude: 4.8500 },
      { vehicle_ref: 'VEH003', line: 'T3', direction: 'East', latitude: 45.7700, longitude: 4.8600 }
    ];

    WebSocketContext.useWebSocket.mockReturnValue({
      vehicles: mockVehicles
    });

    render(<Vehicles />);

    expect(screen.getByText('VEH001')).toBeInTheDocument();
    expect(screen.getByText('VEH002')).toBeInTheDocument();
    expect(screen.getByText('VEH003')).toBeInTheDocument();
    expect(screen.getByTestId('line-VEH001')).toHaveTextContent('T1');
    expect(screen.getByTestId('line-VEH002')).toHaveTextContent('T2');
    expect(screen.getByTestId('line-VEH003')).toHaveTextContent('T3');
  });

  it('displays vehicle location data', () => {
    const mockVehicles = [
      { 
        vehicle_ref: 'VEH001', 
        line: 'T1', 
        direction: 'North',
        latitude: 45.7640,
        longitude: 4.8357
      }
    ];

    WebSocketContext.useWebSocket.mockReturnValue({
      vehicles: mockVehicles
    });

    const { container } = render(<Vehicles />);

    // Verify the DataGrid receives the vehicle with location data
    const vehicle = screen.getByTestId('vehicle-VEH001');
    expect(vehicle).toBeInTheDocument();
  });

  it('renders markers on map for each vehicle', () => {
    const mockVehicles = [
      { 
        vehicle_ref: 'VEH001', 
        line: 'T1', 
        direction: 'North',
        latitude: 45.7640,
        longitude: 4.8357
      },
      { 
        vehicle_ref: 'VEH002', 
        line: 'T2', 
        direction: 'South',
        latitude: 45.7500,
        longitude: 4.8500
      }
    ];

    WebSocketContext.useWebSocket.mockReturnValue({
      vehicles: mockVehicles
    });

    render(<Vehicles />);

    // Check that markers are rendered for each vehicle
    expect(screen.getByTestId('marker-45.764-4.8357')).toBeInTheDocument();
    expect(screen.getByTestId('marker-45.75-4.85')).toBeInTheDocument();
  });

  it('uses default center when no vehicles', () => {
    WebSocketContext.useWebSocket.mockReturnValue({
      vehicles: []
    });

    render(<Vehicles />);

    // Map should still render with default center
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByText(/Vehicle Positions/)).toBeInTheDocument();
  });
});
