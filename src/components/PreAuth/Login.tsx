// lib/components/PreAuth/Login.tsx
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

interface LoginProps {
  onNavigate: (view: 'signup' | 'reset-password') => void;
}

const Login: React.FC<LoginProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { login, processLicenseKey } = useAuth();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Attempt login
      const { storedLicenseKey } = await login(email, password);

      // Process license key if one was stored during signup
      if (storedLicenseKey) {
        try {
          await processLicenseKey(storedLicenseKey);
        } catch (licenseError: any) {
          setError(licenseError.message);
          return;
        }
      }
    } catch (loginError: any) {
      setError(loginError.message);
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
            Login
          </Typography>

          {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
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
              disabled={isLoading}
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
              disabled={isLoading}
          />

          <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              sx={{ mt: 2, mb: 1 }}
              disabled={isLoading}
              startIcon={isLoading ? <CircularProgress size={20} /> : null}
          >
            {isLoading ? 'Logging In...' : 'Login'}
          </Button>

          <Box textAlign="center" mt={2}>
            <Button
                variant="text"
                onClick={() => onNavigate('reset-password')}
                disabled={isLoading}
            >
              Forgot your password?
            </Button>
          </Box>

          <Box textAlign="center" mt={1}>
            <Typography variant="body2">
              Don't have an account?{' '}
              <Button
                  variant="text"
                  onClick={() => onNavigate('signup')}
                  disabled={isLoading}
              >
                Sign Up
              </Button>
            </Typography>
          </Box>
        </Box>
      </Box>
  );
};

export default Login;