import React, { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  TextField,
  CircularProgress,
  Alert,
  Typography,
} from '@mui/material';
import * as wasm from "@yarichard/wam_message_gatling";

function Gatling() {
  // Gatling WASM state
  const [gatlingConfig, setGatlingConfig] = useState({
    messagesNb: 10,
    msgSec: 5,
    serverUrl: window.location.origin
  });
  const [gatlingLoading, setGatlingLoading] = useState(false);
  const [gatlingResult, setGatlingResult] = useState(null);
  const [gatlingError, setGatlingError] = useState(null);

  const executeGatling = async () => {
    setGatlingLoading(true);
    setGatlingError(null);
    setGatlingResult(null);

    try {
      // Execute the gatling test
      const result = await wasm.gatling_execute_standalone(
        gatlingConfig.messagesNb,
        gatlingConfig.msgSec,
        gatlingConfig.serverUrl
      );
      
      setGatlingResult(result);
    } catch (error) {
      console.error('Gatling execution failed:', error);
      setGatlingError(error.message || 'Failed to execute Gatling test');
    } finally {
      setGatlingLoading(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, flex: 1 }}>
      <Typography variant="h5" gutterBottom>
        Gatling Load Test (WASM)
      </Typography>
      
      <Box sx={{ mb: 2 }}>
        <TextField
          label="Number of Messages"
          type="number"
          value={gatlingConfig.messagesNb}
          onChange={(e) => setGatlingConfig(prev => ({
            ...prev,
            messagesNb: parseInt(e.target.value) || 0
          }))}
          size="small"
          sx={{ mr: 2, mb: 1, width: '180px' }}
          inputProps={{ min: 1, max: 1000 }}
        />
        <TextField
          label="Messages per Second"
          type="number"
          value={gatlingConfig.msgSec}
          onChange={(e) => setGatlingConfig(prev => ({
            ...prev,
            msgSec: parseInt(e.target.value) || 0
          }))}
          size="small"
          sx={{ mb: 1, width: '180px' }}
          inputProps={{ min: 1, max: 100 }}
        />
      </Box>
      
      <Box sx={{ mb: 2 }}>
        <TextField
          label="Server URL"
          value={gatlingConfig.serverUrl}
          onChange={(e) => setGatlingConfig(prev => ({
            ...prev,
            serverUrl: e.target.value
          }))}
          fullWidth
          size="small"
          placeholder="http://localhost:3000"
        />
      </Box>
      
      <Button
        variant="contained"
        color="primary"
        onClick={executeGatling}
        disabled={gatlingLoading || !gatlingConfig.messagesNb || !gatlingConfig.msgSec}
        startIcon={gatlingLoading ? <CircularProgress size={20} /> : null}
        sx={{ mb: 2 }}
      >
        {gatlingLoading ? 'Running...' : 'Run Gatling Test'}
      </Button>
      
      {gatlingResult && (
        <Alert severity="success" sx={{ mb: 1 }}>
          {gatlingResult}
        </Alert>
      )}
      
      {gatlingError && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {gatlingError}
        </Alert>
      )}
      
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        This test will send messages using WebAssembly to the specified server.
        Configure the number of messages and rate before running.
      </Typography>
    </Paper>
  );
}

export default Gatling;