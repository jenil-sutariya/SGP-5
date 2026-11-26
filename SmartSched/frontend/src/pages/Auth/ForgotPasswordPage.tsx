import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, CalendarDays, Mail } from 'lucide-react';
import { authApi } from '@/api';
import { Button, Input, Label } from '@/components/ui';
import { CharusatAnimatedBackground } from '@/components/common/CharusatAnimatedBackground';
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import { useThemeStore } from '@/store/authStore';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && prefersDark));
  }, [theme]);

  const forgotMutation = useMutation({
    mutationFn: (targetEmail: string) => authApi.forgotPassword(targetEmail),
    onSuccess: (res) => {
      toast.success(res.data.data.message ?? 'Reset link sent!');
      if (res.data.data.resetToken) {
        toast.message(`Dev token: ${res.data.data.resetToken}`);
      }
    },
    onError: () => {
      toast.error('Failed to send reset link. Check the email address.');
    },
  });
  const loading = forgotMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    forgotMutation.mutate(email);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative text-foreground">
      <CharusatAnimatedBackground />

      <div className="fixed top-4 right-4 z-20">
        <ThemeSwitcher />
      </div>

      <div className="surface-card w-full max-w-md rounded-3xl p-7 sm:p-8 relative z-10 shadow-xl space-y-5">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to Sign In
        </Link>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
            <CalendarDays size={20} aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Reset Password
            </h1>
            <p className="text-xs text-muted">CHARUSAT SmartSched Portal</p>
          </div>
        </div>

        <p className="text-sm text-muted leading-relaxed">
          Enter your CHARUSAT email address and we will send password reset instructions.
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="reset-email" className="flex items-center gap-1.5">
              <Mail size={13} className="text-primary dark:text-cyan-accent" aria-hidden="true" />
              CHARUSAT Email
            </Label>
            <Input
              id="reset-email"
              type="email"
              required
              autoComplete="email"
              placeholder="your@charusat.edu.in"
              className="h-11"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!email}>
            {loading ? 'Sending…' : 'Send Reset Link'}
          </Button>
        </form>
      </div>
    </div>
  );
}
