import React, { useState, useRef, useCallback } from 'react';
import {
  Typography, Paper, Stack, IconButton, TextField, Box, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, CircularProgress,
  InputAdornment,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import axios from 'axios';

function Users({ users, onUpdateUser, onCreateUser, onDeleteUser, onChangePassword, currentUserId }) {
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  // Create user dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailChecking, setEmailChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');

  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Change password dialog
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwUserId, setPwUserId] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

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

  // --- Create user ---
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

  // --- Delete user ---
  const handleOpenDeleteDialog = (user) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setUserToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      await onDeleteUser(userToDelete.id);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  // --- Change password ---
  const handleOpenPwDialog = (userId) => {
    setPwUserId(userId);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwError('');
    setShowCurrentPw(false);
    setShowNewPw(false);
    setPwDialogOpen(true);
  };

  const handleClosePwDialog = () => {
    setPwDialogOpen(false);
    setPwUserId(null);
  };

  const handleSavePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError('All fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    setPwSaving(true);
    setPwError('');
    try {
      await onChangePassword(pwUserId, currentPassword, newPassword);
      handleClosePwDialog();
    } catch (err) {
      if (err.response?.status === 422) {
        setPwError('Current password is incorrect.');
      } else if (err.response?.status === 403) {
        setPwError('You can only change your own password.');
      } else {
        setPwError('Failed to change password.');
      }
    } finally {
      setPwSaving(false);
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
                <Box>
                  <Typography variant="h6">{user.name}</Typography>
                  {user.email && (
                    <Typography variant="body2" color="text.secondary">{user.email}</Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton onClick={() => handleEdit(user)} size="small" aria-label="edit">
                    <EditIcon />
                  </IconButton>
                  {currentUserId === user.id && (
                    <IconButton onClick={() => handleOpenPwDialog(user.id)} size="small" aria-label="change password">
                      <LockIcon />
                    </IconButton>
                  )}
                  <IconButton onClick={() => handleOpenDeleteDialog(user)} size="small" aria-label="delete" color="error">
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </Box>
            )}
          </Paper>
        ))}
      </Stack>

      {/* Create user dialog */}
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

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{userToDelete?.name}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={deleting}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change password dialog */}
      <Dialog open={pwDialogOpen} onClose={handleClosePwDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {pwError && <Alert severity="error">{pwError}</Alert>}
            <TextField
              label="Current password"
              type={showCurrentPw ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              fullWidth
              autoFocus
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowCurrentPw(v => !v)} edge="end" size="small">
                        {showCurrentPw ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label="New password"
              type={showNewPw ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowNewPw(v => !v)} edge="end" size="small">
                        {showNewPw ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label="Confirm new password"
              type={showNewPw ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePwDialog} disabled={pwSaving}>Cancel</Button>
          <Button onClick={handleSavePassword} variant="contained" disabled={pwSaving}>
            {pwSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default Users;
