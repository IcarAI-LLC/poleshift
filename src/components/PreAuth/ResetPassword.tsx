// lib/components/PreAuth/ResetPassword.tsx
import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useAuth } from '../../lib/hooks';

interface ResetPasswordProps {
  onNavigate: (view: 'login') => void;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      await resetPassword(email);
      setMessage('Password reset email sent. Check your inbox.');
    } catch (err: any) {
      console.error('Reset Password error:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
      <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          minHeight="100vh"
          bgcolor="background.default"
          color="text.primary"
          padding={2}
      >
        <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              width: '100%',
              maxWidth: 400,
              p: 4,
              bgcolor: 'background.paper',
              borderRadius: 2,
              boxShadow: 3,
            }}
        >
          <Typography variant="h5" component="h1" gutterBottom align="center">
            Reset Password
          </Typography>

          {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
          )}

          {message && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {message}
              </Alert>
          )}

          <TextField
              label="Email"
              variant="outlined"
              type="email"
              fullWidth
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading || !!message}
          />

          <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              sx={{ mt: 2, mb: 1 }}
              disabled={isLoading || !!message}
              startIcon={isLoading ? <CircularProgress size={20} /> : null}
          >
            {isLoading ? 'Sending...' : 'Reset Password'}
          </Button>

          <Box textAlign="center" mt={2}>
            <Typography variant="body2">
              Remember your password?{' '}
              <Button
                  variant="text"
                  onClick={() => onNavigate('login')}
                  disabled={isLoading}
              >
                Log In
              </Button>
            </Typography>
          </Box>
        </Box>
      </Box>
  );
};

export default ResetPassword;