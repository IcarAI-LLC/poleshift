import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { api } from '../../lib/api';

interface SignUpProps {
  onNavigate: (view: 'login') => void;
}

const SignUp: React.FC<SignUpProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [licenseKey, setLicenseKey] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    if (!email || !password || !licenseKey) {
      setError('Email, password, and license key are required.');
      setIsLoading(false);
      return;
    }

    try {
      await api.auth.signUpWithLicense(email, password, licenseKey);
      setMessage(
          'Sign-up successful! Please check your email to confirm your account before logging in.'
      );
    } catch (err: any) {
      console.error('Sign-up error:', err);
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
            Sign Up
          </Typography>

          {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
          )}

          {message && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {message}{' '}
                <Button variant="text" onClick={() => onNavigate('login')}>
                  Log in here
                </Button>
                .
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
              disabled={!!message || isLoading}
          />

          <TextField
              label="Password"
              variant="outlined"
              type="password"
              fullWidth
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={!!message || isLoading}
          />

          <TextField
              label="License Key"
              variant="outlined"
              type="text"
              fullWidth
              margin="normal"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              required
              disabled={!!message || isLoading}
          />

          <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              sx={{ mt: 2, mb: 1 }}
              disabled={!!message || isLoading}
              startIcon={isLoading ? <CircularProgress size={20} /> : null}
          >
            {isLoading ? 'Signing Up...' : 'Sign Up'}
          </Button>

          {!message && (
              <Box textAlign="center" mt={2}>
                <Typography variant="body2">
                  Already have an account?{' '}
                  <Button
                      variant="text"
                      onClick={() => onNavigate('login')}
                      disabled={isLoading}
                  >
                    Log In
                  </Button>
                </Typography>
              </Box>
          )}
        </Box>
      </Box>
  );
};

export default SignUp;