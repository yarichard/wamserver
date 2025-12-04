import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Box, Paper, Typography, Chip, Stack, Button } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useWebSocket } from '../contexts/WebSocketContext';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Color palette for different lines
const LINE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
  '#E63946', '#457B9D', '#E76F51', '#2A9D8F', '#F4A261'
];

// Create a colored marker icon
const createColoredIcon = (color, isSelected = false) => {
  const svgIcon = `
    <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 8.4 12.5 28.5 12.5 28.5S25 20.9 25 12.5C25 5.6 19.4 0 12.5 0z" 
            fill="${color}" stroke="${isSelected ? '#FFD700' : '#fff'}" stroke-width="${isSelected ? '4' : '2'}"/>
      <circle cx="12.5" cy="12.5" r="6" fill="#fff"/>
    </svg>
  `;
  
  return L.divIcon({
    html: svgIcon,
    className: 'custom-marker',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
  });
};

// Component to handle map updates when selection changes
function MapController({ selectedVehicle, filteredVehicles }) {
  const map = useMap();
  
  useEffect(() => {
    if (selectedVehicle && selectedVehicle.latitude && selectedVehicle.longitude) {
      map.flyTo([selectedVehicle.latitude, selectedVehicle.longitude], 15, {
        duration: 1
      });
    }
  }, [selectedVehicle, map]);
  
  return null;
}

function Vehicles() {
  const { vehicles } = useWebSocket();
  const [visibleLines, setVisibleLines] = useState(new Set());
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const markerRefs = useRef({});

  // Generate color mapping for unique lines
  const lineColorMap = useMemo(() => {
    const uniqueLines = [...new Set(vehicles.map(v => v.line).filter(Boolean))];
    const colorMap = {};
    uniqueLines.forEach((line, index) => {
      colorMap[line] = LINE_COLORS[index % LINE_COLORS.length];
    });
    // Initialize all lines as visible only on first load
    if (!isInitialized && visibleLines.size === 0 && uniqueLines.length > 0) {
      setVisibleLines(new Set(uniqueLines));
      setIsInitialized(true);
    }
    return colorMap;
  }, [vehicles, visibleLines.size, isInitialized]);

  // Get unique lines
  const uniqueLines = useMemo(() => {
    return [...new Set(vehicles.map(v => v.line).filter(Boolean))].sort();
  }, [vehicles]);

  // Toggle line visibility
  const toggleLine = (line) => {
    setVisibleLines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(line)) {
        newSet.delete(line);
      } else {
        newSet.add(line);
      }
      return newSet;
    });
  };

  // Select all lines
  const selectAllLines = () => {
    setVisibleLines(new Set(uniqueLines));
  };

  // Unselect all lines
  const unselectAllLines = () => {
    setVisibleLines(new Set());
  };

  // Filter vehicles based on visible lines
  const filteredVehicles = vehicles.filter(v => visibleLines.has(v.line));

  // Get selected vehicle details
  const selectedVehicle = useMemo(() => {
    return filteredVehicles.find(v => (v.vehicle_ref || filteredVehicles.indexOf(v)) === selectedVehicleId);
  }, [selectedVehicleId, filteredVehicles]);

  // Handle row selection
  const handleSelectionChange = (selectionModel) => {
    if (selectionModel.length > 0) {
      const vehicleId = selectionModel[0];
      setSelectedVehicleId(vehicleId);
      
      // Open popup for selected marker
      if (markerRefs.current[vehicleId]) {
        markerRefs.current[vehicleId].openPopup();
      }
    } else {
      setSelectedVehicleId(null);
    }
  };

  const columns = [
    { 
      field: 'vehicle_ref', 
      headerName: 'Vehicle Ref', 
      flex: 1,
    },
    {
      field: 'line',
      headerName: 'Line',
      width: 100,
    },
    {
      field: 'direction',
      headerName: 'Direction',
      width: 150,
      hideable: true,
    },
    {
      field: 'latitude',
      headerName: 'Latitude',
      width: 130,
      type: 'number',
      hideable: true,
    },
    {
      field: 'longitude',
      headerName: 'Longitude',
      width: 130,
      type: 'number',
      hideable: true,
    },
  ];

  // Column visibility model - hide all columns except vehicle_ref and line
  const [columnVisibilityModel, setColumnVisibilityModel] = useState({
    direction: false,
    latitude: false,
    longitude: false,
  });

  // Add id field for DataGrid if not present
  const rowsWithId = filteredVehicles.map((vehicle, index) => ({
    id: vehicle.vehicle_ref || index,
    ...vehicle
  }));

  // Calculate map center (average of all vehicle positions)
  const mapCenter = filteredVehicles.length > 0
    ? [
        filteredVehicles.reduce((sum, v) => sum + (v.latitude || 0), 0) / filteredVehicles.length,
        filteredVehicles.reduce((sum, v) => sum + (v.longitude || 0), 0) / filteredVehicles.length
      ]
    : [45.764043, 4.835659]; // Default to Lyon, France

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: 'calc(100vh - 150px)' }}>
      {/* Line Filter Section */}
      <Paper elevation={2} sx={{ p: 2, maxHeight: '120px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1">
            Lines ({uniqueLines.length})
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button 
              size="small" 
              variant="outlined" 
              onClick={selectAllLines}
              sx={{ textTransform: 'none' }}
            >
              Select All
            </Button>
            <Button 
              size="small" 
              variant="outlined" 
              onClick={unselectAllLines}
              sx={{ textTransform: 'none' }}
            >
              Unselect All
            </Button>
          </Stack>
        </Box>
        <Box sx={{ 
          overflowX: 'auto', 
          overflowY: 'auto',
          maxHeight: '80px',
          '&::-webkit-scrollbar': {
            height: '8px',
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#f1f1f1',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#888',
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: '#555',
            },
          },
        }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {uniqueLines.map(line => (
              <Chip
                key={line}
                label={line}
                onClick={() => toggleLine(line)}
                sx={{
                  backgroundColor: visibleLines.has(line) ? lineColorMap[line] : '#e0e0e0',
                  color: visibleLines.has(line) ? '#fff' : '#666',
                  fontWeight: 'bold',
                  '&:hover': {
                    opacity: 0.8,
                  },
                }}
              />
            ))}
          </Stack>
        </Box>
      </Paper>

      {/* Map and Grid Section */}
      <Box sx={{ display: 'flex', gap: 3, flex: 1, minHeight: 0 }}>
        {/* Map Section */}
        <Box sx={{ flex: '0 0 70%', display: 'flex', flexDirection: 'column' }}>
          <Paper elevation={2} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>
              Vehicle Positions ({filteredVehicles.length})
            </Typography>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <MapContainer
                center={mapCenter}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapController selectedVehicle={selectedVehicle} filteredVehicles={filteredVehicles} />
                {filteredVehicles.map((vehicle, index) => {
                  const vehicleId = vehicle.vehicle_ref || index;
                  const isSelected = vehicleId === selectedVehicleId;
                  return (
                    vehicle.latitude && vehicle.longitude && (
                      <Marker
                        key={vehicleId}
                        position={[vehicle.latitude, vehicle.longitude]}
                        icon={createColoredIcon(lineColorMap[vehicle.line] || LINE_COLORS[0], isSelected)}
                        ref={(ref) => {
                          if (ref) {
                            markerRefs.current[vehicleId] = ref;
                          }
                        }}
                      >
                        <Popup>
                          <strong>Vehicle:</strong> {vehicle.vehicle_ref}<br />
                          <strong>Line:</strong> {vehicle.line}<br />
                          <strong>Direction:</strong> {vehicle.direction}<br />
                          <strong>Position:</strong> {vehicle.latitude.toFixed(6)}, {vehicle.longitude.toFixed(6)}
                        </Popup>
                      </Marker>
                    )
                  );
                })}
              </MapContainer>
            </Box>
          </Paper>
        </Box>

        {/* Data Grid Section */}
        <Box sx={{ flex: '0 0 30%', display: 'flex', flexDirection: 'column' }}>
          <Paper elevation={2} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <DataGrid
              rows={rowsWithId}
              columns={columns}
              pageSize={10}
              rowsPerPageOptions={[10, 25, 50]}
              onRowClick={(params) => {
                // Toggle selection: if clicking the same row, deselect it
                if (selectedVehicleId === params.id) {
                  setSelectedVehicleId(null);
                } else {
                  setSelectedVehicleId(params.id);
                  if (markerRefs.current[params.id]) {
                    markerRefs.current[params.id].openPopup();
                  }
                }
              }}
              columnVisibilityModel={columnVisibilityModel}
              onColumnVisibilityModelChange={setColumnVisibilityModel}
              sx={{
                '& .MuiDataGrid-cell:focus': {
                  outline: 'none',
                },
                '& .MuiDataGrid-row:hover': {
                  cursor: 'pointer',
                },
                '& .MuiDataGrid-row.Mui-selected': {
                  backgroundColor: 'rgba(25, 118, 210, 0.12)',
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.16)',
                  },
                },
              }}
            />
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}

export default Vehicles;
