import React, { useState, useRef, useCallback } from 'react';
import {
  Typography, Paper, Stack, IconButton, TextField, Box, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, CircularProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import axios from 'axios';

function Users({ users, onUpdateUser, onCreateUser }) {
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailChecking, setEmailChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');

  const debounceRef = useRef(null);

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

  const handleOpenDialog = () => {
    setNewName('');
    setNewEmail('');
    setEmailError('');
    setGeneratedPassword('');
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const checkEmail = useCallback(async (email) => {
    if (!email) {
      setEmailError('');
      setEmailChecking(false);
      return;
    }
    setEmailChecking(true);
    try {
      const res = await axios.get(`/api/user/check-email?email=${encodeURIComponent(email)}`);
      setEmailError(res.data.exists ? 'This email is already registered.' : '');
    } catch {
      setEmailError('');
    } finally {
      setEmailChecking(false);
    }
  }, []);

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setNewEmail(val);
    setEmailError('');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => checkEmail(val), 500);
  };

  const handleCreate = async () => {
    if (!newName || !newEmail || emailError || emailChecking) return;
    setCreating(true);
    try {
      const password = await onCreateUser(newName, newEmail);
      setGeneratedPassword(password);
    } catch {
      setEmailError('Failed to create user. The email may already exist.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenDialog}>
          Add User
        </Button>
      </Box>

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

      <Dialog open={dialogOpen} onClose={generatedPassword ? undefined : handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{generatedPassword ? 'User Created' : 'Add New User'}</DialogTitle>
        <DialogContent>
          {generatedPassword ? (
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Alert severity="success">User created successfully!</Alert>
              <Alert severity="warning">
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                  Default password — save this now, it will not be shown again:
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>
                  {generatedPassword}
                </Typography>
              </Alert>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                fullWidth
                required
                autoFocus
              />
              <TextField
                label="Email address"
                type="email"
                value={newEmail}
                onChange={handleEmailChange}
                fullWidth
                required
                error={!!emailError}
                helperText={emailChecking ? 'Checking availability…' : emailError}
                slotProps={{
                  input: {
                    endAdornment: emailChecking ? <CircularProgress size={16} /> : null,
                  },
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {generatedPassword ? (
            <Button onClick={handleCloseDialog} variant="contained">Close</Button>
          ) : (
            <>
              <Button onClick={handleCloseDialog}>Cancel</Button>
              <Button
                onClick={handleCreate}
                variant="contained"
                disabled={!newName || !newEmail || !!emailError || emailChecking || creating}
              >
                {creating ? 'Creating…' : 'Create'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}

export default Users;
