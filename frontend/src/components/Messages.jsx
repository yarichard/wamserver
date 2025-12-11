import React, { useEffect } from 'react';
import { Box, Paper, Grid } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { useWebSocket } from '../contexts/WebSocketContext';
import KafkaParams from './KafkaParams';
import MessageRateChart from './MessageRateChart';
import Gatling from './Gatling';

function Messages({ messages: initialMessages }) {
  const { messages, setMessages } = useWebSocket();
  
  useEffect(() => {
    // Initialize messages with the ones from props
    if (initialMessages && initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages, messages.length]);
  const columns = [
    { 
      field: 'id', 
      headerName: 'ID', 
      width: 90 
    },
    {
      field: 'text',
      headerName: 'Message',
      width: 400,
      flex: 1,
    },
    {
      field: 'user_id',
      headerName: 'User ID',
      width: 130,
    },
  ];

  return (
    <>
      <Grid container spacing={3} sx={{ alignItems: 'stretch', mb: 3 }}>
        <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
          <KafkaParams />
        </Grid>
        
        <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
          <Gatling />
        </Grid>
      </Grid>

      <Box sx={{ mb: 3 }}>
        <MessageRateChart />
      </Box>

      <Paper elevation={2} sx={{ width: '100%', height: 600 }}>
        <DataGrid
          rows={messages}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[10, 25, 50]}
          checkboxSelection
          disableSelectionOnClick
          autoHeight
          sx={{
            '& .MuiDataGrid-cell:focus': {
              outline: 'none',
            },
          }}
        />
      </Paper>
    </>
  );
}

export default Messages;