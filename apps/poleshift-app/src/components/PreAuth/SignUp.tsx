import { ChangeEvent, FC, FormEvent, useState } from 'react';
import { useAuth } from '@/hooks';
import { supabaseConnector } from '@/lib/powersync/SupabaseConnector';
import type { PreAuthView } from 'src/types';

// shadcn/ui components
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SignUpFormState {
  email: string;
  password: string;
  licenseKey: string;
  message: string | null;
  error: string | null;
  isLoading: boolean;
}

type LicenseStatus = 'idle' | 'checking' | 'valid' | 'invalid';

interface SignUpProps {
  onNavigate: (
    view: PreAuthView,
    data?: { email?: string; message?: string }
  ) => void;
}

const SignUp: FC<SignUpProps> = ({ onNavigate }) => {
  const { signUp } = useAuth();
  const [formState, setFormState] = useState<SignUpFormState>({
    email: '',
    password: '',
    licenseKey: '',
    message: null,
    error: null,
    isLoading: false,
  });

  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>('idle');
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [licenseOrg, setLicenseOrg] = useState<string | null>(null);

  const handleLicenseKeyChange = async (value: string) => {
    setFormState((prev) => ({ ...prev, licenseKey: value }));

    if (!value) {
      setLicenseStatus('idle');
      setLicenseError(null);
      setLicenseOrg(null);
      return;
    }

    try {
      setLicenseStatus('checking');
      setLicenseError(null);
      setLicenseOrg(null);

      const result = await supabaseConnector.validateLicenseKey(value);
      if (!result.valid) {
        setLicenseStatus('invalid');
        setLicenseError(result.errorMessage || 'Invalid license key.');
      } else {
        setLicenseStatus('valid');
        setLicenseOrg(result.organizationName ?? null);
      }
    } catch (err) {
      console.error(err);
      setLicenseStatus('invalid');
      setLicenseError(
        err instanceof Error ? err.message : 'Error validating license key'
      );
    }
  };

  const handleInputChange =
    (field: keyof SignUpFormState) =>
    async (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (field === 'licenseKey') {
        await handleLicenseKeyChange(value);
      } else {
        setFormState((prev) => ({ ...prev, [field]: value }));
      }
    };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormState((prev) => ({
      ...prev,
      error: null,
      message: null,
    }));

    if (!formState.email || !formState.password) {
      setFormState((prev) => ({
        ...prev,
        error: 'Email and password are required.',
      }));
      return;
    }

    // If you want to enforce valid license:
    if (licenseStatus === 'invalid' || licenseStatus === 'checking') {
      setFormState((prev) => ({
        ...prev,
        error: 'Please enter a valid license key before signing up.',
      }));
      return;
    }

    setFormState((prev) => ({ ...prev, isLoading: true }));
    try {
      await signUp(formState.email, formState.password);
      onNavigate('login', {
        email: formState.email,
        message:
          'Sign-up successful! Please check your email to confirm your account before logging in.',
      });
    } catch (err) {
      console.error('Sign-up error:', err);
      setFormState((prev) => ({
        ...prev,
        error:
          err instanceof Error ? err.message : 'An unexpected error occurred',
        isLoading: false,
      }));
    }
  };

  return (
    <div className='flex min-h-screen items-center justify-center p-4'>
      <Card className='w-full max-w-md'>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
          </CardHeader>

          <CardContent>
            {formState.error && (
              <Alert variant='destructive'>
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{formState.error}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor='email'>Email</Label>
              <Input
                id='email'
                type='email'
                value={formState.email}
                onChange={handleInputChange('email')}
                autoComplete='email'
                disabled={formState.isLoading}
                required
              />
            </div>

            <div className='mt-3'>
              <Label htmlFor='password'>Password</Label>
              <Input
                id='password'
                type='password'
                value={formState.password}
                onChange={handleInputChange('password')}
                autoComplete='new-password'
                disabled={formState.isLoading}
                required
              />
            </div>

            {/* License Key + Validation UI */}
            <div className='mt-3'>
              <Label htmlFor='licenseKey'>License Key</Label>
              <Input
                id='licenseKey'
                type='text'
                value={formState.licenseKey}
                onChange={handleInputChange('licenseKey')}
                disabled={formState.isLoading}
              />

              {licenseStatus !== 'idle' && (
                <div className='mt-2 flex items-center gap-2'>
                  <Tooltip>
                    <TooltipTrigger>
                      {licenseStatus === 'checking' && (
                        <Badge variant='secondary'>Checking...</Badge>
                      )}
                      {licenseStatus === 'valid' && (
                        <Badge variant='default'>Valid</Badge>
                      )}
                      {licenseStatus === 'invalid' && (
                        <Badge variant='destructive'>Invalid</Badge>
                      )}
                    </TooltipTrigger>
                    <TooltipContent>
                      {licenseStatus === 'checking' && (
                        <span>We’re validating your license key...</span>
                      )}
                      {licenseStatus === 'valid' && licenseOrg ? (
                        <span>License belongs to: {licenseOrg}</span>
                      ) : licenseStatus === 'valid' ? (
                        <span>License key is valid</span>
                      ) : licenseError ? (
                        <span>{licenseError}</span>
                      ) : (
                        <span>Unknown license status</span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className='flex flex-col gap-2'>
            <Button type='submit' disabled={formState.isLoading}>
              {formState.isLoading && (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              )}
              {formState.isLoading ? 'Signing Up...' : 'Sign Up'}
            </Button>
            <div>
              Already have an account?{' '}
              <Button
                variant='link'
                onClick={() => onNavigate('login')}
                disabled={formState.isLoading}
              >
                Log In
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default SignUp;
