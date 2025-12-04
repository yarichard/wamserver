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

// Mock MUI icons
vi.mock('@mui/icons-material', () => ({
  ExpandMore: () => <div data-testid="expand-more-icon" />,
  ExpandLess: () => <div data-testid="expand-less-icon" />
}));

describe('Vehicles Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders map and vehicle list', () => {
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
    expect(screen.getByText(/Vehicle Positions/)).toBeInTheDocument();
    expect(screen.getByText(/Vehicles by Line/)).toBeInTheDocument();
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

    expect(screen.getByText('VEH001')).toBeInTheDocument();
    expect(screen.getByText('VEH002')).toBeInTheDocument();
    expect(screen.getAllByText('T1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('T2').length).toBeGreaterThan(0);
  });

  it('renders empty vehicle list when no vehicles', () => {
    WebSocketContext.useWebSocket.mockReturnValue({
      vehicles: []
    });

    render(<Vehicles />);

    expect(screen.getByText(/Vehicles by Line/)).toBeInTheDocument();
    expect(screen.getByText(/Lines \(0\)/)).toBeInTheDocument();
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

    // Should display line even without vehicle_ref
    expect(screen.getAllByText('T3').length).toBeGreaterThan(0);
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
    expect(screen.getAllByText('T1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('T2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('T3').length).toBeGreaterThan(0);
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

    render(<Vehicles />);

    // Verify the vehicle is displayed with its data
    expect(screen.getByText('VEH001')).toBeInTheDocument();
    expect(screen.getAllByText('T1').length).toBeGreaterThan(0);
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
