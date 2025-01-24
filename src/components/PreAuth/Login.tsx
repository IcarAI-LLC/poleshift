import { FC, useState } from 'react';
import { useAuth } from '@/hooks';
import type { PreAuthView } from 'src/types';

// shadcn/ui components
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

// lucide icon
import { Loader2 } from 'lucide-react';

interface LoginProps {
  onNavigate: (view: PreAuthView) => void;
  prefillEmail?: string;
  message?: string;
}

const Login: FC<LoginProps> = ({ onNavigate, prefillEmail = '', message }) => {
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const { loading, error: authError, login } = useAuth();
  const displayError = localError || authError;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password) {
      setLocalError('Please enter both email and password');
      return;
    }

    try {
      await login(email, password);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Login failed');
    }
  };

  return (
    <div className='flex min-h-screen items-center justify-center p-4'>
      <Card className='w-full max-w-md'>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Login</CardTitle>
          </CardHeader>

          <CardContent>
            {message && (
              <Alert variant='default'>
                <AlertTitle>Info</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            {displayError && (
              <Alert variant='destructive'>
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{displayError}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor='email'>Email</Label>
              <Input
                id='email'
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete='email'
                aria-label='email'
              />
            </div>

            <div className='mt-3'>
              <Label htmlFor='password'>Password</Label>
              <Input
                id='password'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete='current-password'
                aria-label='password'
              />
            </div>
          </CardContent>

          <CardFooter className='flex flex-col gap-2'>
            <Button type='submit' disabled={loading}>
              {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {loading ? 'Logging In...' : 'Login'}
            </Button>
            <Button
              variant='link'
              onClick={() => onNavigate('reset-password')}
              disabled={loading}
            >
              Forgot your password?
            </Button>
            <div>
              Don&apos;t have an account?{' '}
              <Button
                variant='link'
                onClick={() => onNavigate('signup')}
                disabled={loading}
              >
                Sign Up
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Login;
