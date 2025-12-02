import React, { useState, useEffect, useRef } from 'react';
import { Paper, Typography, Box, Switch, FormControlLabel } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { useWebSocket } from '../contexts/WebSocketContext';

export default function MessageRateChart() {
  const { messages } = useWebSocket();
  const [seriesData, setSeriesData] = useState(Array(60).fill(0));
  const [timeLabels, setTimeLabels] = useState(Array(60).fill(''));
  const [autoRefresh, setAutoRefresh] = useState(true);
  const messagesLengthRef = useRef(messages.length);
  const lastCountRef = useRef(messages.length);

  // Update ref when messages change
  useEffect(() => {
    messagesLengthRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    // Initialize refs
    lastCountRef.current = messagesLengthRef.current;

    const interval = setInterval(() => {
      if (!autoRefresh) return;
      
      const currentCount = messagesLengthRef.current;
      let rate = currentCount - lastCountRef.current;
      
      // Handle case where messages might be cleared
      if (rate < 0) rate = 0;
      
      lastCountRef.current = currentCount;

      const now = new Date();
      const timeLabel = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });

      setSeriesData(prev => {
        const newData = [...prev.slice(1), rate];
        return newData;
      });

      setTimeLabels(prev => {
        const newLabels = [...prev.slice(1), timeLabel];
        return newLabels;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  return (
    <Paper elevation={2} sx={{ p: 3, height: '100%', minHeight: 300 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Throughput (Messages/sec)
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              color="primary"
            />
          }
          label="Auto Refresh"
        />
      </Box>
      <Box sx={{ width: '100%', height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <LineChart
          series={[
            {
              data: seriesData,
              label: 'Messages/sec',
              area: true,
              showMark: false,
              color: '#1976d2',
              curve: "catmullRom",
            },
          ]}
          xAxis={[{ 
            data: Array.from({ length: 60 }, (_, i) => i), 
            scaleType: 'linear',
            label: 'Time',
            valueFormatter: (v, context) => {
              const index = context?.location === 'tick' ? v : Math.floor(v);
              return timeLabels[index] || '';
            }
          }]}
          height={300}
          margin={{ left: 30, right: 30, top: 30, bottom: 30 }}
          grid={{ vertical: true, horizontal: true }}
        />
      </Box>
    </Paper>
  );
}
