import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Card, Input } from '@/components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md space-y-4">
        <h1 className="font-display text-2xl font-bold text-primary">Reset Password</h1>
        <p className="text-sm text-muted">
          Enter your CHARUSAT email address and we'll send you a password reset link.
        </p>
        <Input
          type="email"
          placeholder="your@charusat.edu.in"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button
          className="w-full"
          disabled={loading || !email}
          onClick={async () => {
            setLoading(true);
            try {
              const { authApi } = await import('@/api');
              const res = await authApi.forgotPassword(email);
              toast.success(res.data.data.message ?? 'Reset link sent!');
              if (res.data.data.resetToken) {
                toast.message(`Dev token: ${res.data.data.resetToken}`);
              }
            } catch {
              toast.error('Failed to send reset link. Check the email address.');
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? 'Sending…' : 'Send Reset Link'}
        </Button>
      </Card>
    </div>
  );
}
