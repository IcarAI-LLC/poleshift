import { FC, useState } from 'react';
import { useAuth } from '@/hooks';

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

// lucide-react icon
import { Loader2 } from 'lucide-react';
const ActivateLicense: FC = () => {
  const { activateLicense, loading, error } = useAuth();
  const [licenseKey, setLicenseKey] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);
    setMessage(null);

    if (!licenseKey) {
      setLocalError('Please enter a license key');
      return;
    }

    try {
      await activateLicense(licenseKey);
      setMessage('License activated successfully! Loading your profile...');
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'License activation failed'
      );
    }
  };

  const displayError = localError || error;

  return (
    <div className='flex min-h-screen items-center justify-center p-4'>
      <Card className='w-full max-w-md'>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Activate Your License</CardTitle>
          </CardHeader>

          <CardContent>
            {displayError && (
              <Alert variant='destructive'>
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{displayError}</AlertDescription>
              </Alert>
            )}

            {message && (
              <Alert variant='default'>
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor='licenseKey'>License Key</Label>
              <Input
                id='licenseKey'
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                required
                disabled={loading || !!message}
                aria-label='License Key'
              />
            </div>
          </CardContent>

          <CardFooter className='flex flex-col gap-2'>
            <Button type='submit' disabled={loading || !!message}>
              {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {loading ? 'Activating...' : 'Activate'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default ActivateLicense;
