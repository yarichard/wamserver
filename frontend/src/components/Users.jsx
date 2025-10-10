import React from 'react';
import { Typography, Paper, Stack } from '@mui/material';

function Users({ users }) {
  return (
    <Stack spacing={2}>
      {users.map(user => (
        <Paper key={user.id} elevation={1} sx={{ p: 2 }}>
          <Typography variant="h6">{user.name}</Typography>
          <Typography color="text.secondary">ID: {user.id}</Typography>
        </Paper>
      ))}
    </Stack>
  );
}

export default Users;