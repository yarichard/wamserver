import React, { useState } from 'react';
import { Typography, Paper, Stack, IconButton, TextField, Box, Button } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';

function Users({ users, onUpdateUser }) {
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const handleEdit = (user) => {
    setEditingId(user.id);
    setEditingName(user.name);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleSave = async (id) => {
    await onUpdateUser(id, editingName);
    setEditingId(null);
  };

  return (
    <Stack spacing={2}>
      {users.map(user => (
        <Paper key={user.id} elevation={1} sx={{ p: 2 }}>
          {editingId === user.id ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                size="small"
                label="Name"
              />
              <Button onClick={() => handleSave(user.id)} variant="contained" size="small">Save</Button>
              <Button onClick={handleCancel} size="small">Cancel</Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h6">{user.name}</Typography>
              <IconButton onClick={() => handleEdit(user)} size="small" aria-label="edit">
                <EditIcon />
              </IconButton>
            </Box>
          )}
        </Paper>
      ))}
    </Stack>
  );
}

export default Users;
