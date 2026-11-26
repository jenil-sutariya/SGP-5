import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CalendarDays,
  ShieldCheck,
  ArrowRight,
  Building2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  CheckCircle2,
  Users,
  Cpu,
} from 'lucide-react';
import { authApi } from '@/api';
import { useAuthStore, useThemeStore } from '@/store/authStore';
import { Button, Input, Label } from '@/components/ui';
import { CharusatAnimatedBackground } from '@/components/common/CharusatAnimatedBackground';
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import { UNIVERSITY, INSTITUTES } from '@/constants/university';

const schema = z.object({
  email: z
    .string()
    .email('Enter a valid CHARUSAT email address')
    .refine(
      (v) => UNIVERSITY.emailDomains.some((d) => v.toLowerCase().endsWith(`@${d}`)),
      `Use your ${UNIVERSITY.shortName} email (@${UNIVERSITY.emailDomains[0]})`
    ),
  password: z.string().min(1, 'Password is required'),
});

type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const theme = useThemeStore((s) => s.theme);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && prefersDark));
  }, [theme]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const loginMutation = useMutation({
    mutationFn: (values: Form) => authApi.login(values.email, values.password),
    onSuccess: ({ data }) => {
      setAuth(data.data.user, data.data.accessToken, data.data.refreshToken);
      toast.success(`Welcome to ${UNIVERSITY.productName}`);
      navigate('/dashboard');
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Login failed';
      toast.error(msg);
    },
  });
  const isSubmitting = loginMutation.isPending;

  const onSubmit = (values: Form) => {
    loginMutation.mutate(values);
  };

  const handleQuickLogin = (email: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', UNIVERSITY.demoPassword, { shouldValidate: true });
    toast.info(`Filled demo credentials for ${email}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 relative text-foreground">
      <CharusatAnimatedBackground />

      <div className="fixed top-4 right-4 z-20">
        <ThemeSwitcher />
      </div>

      <div className="w-full max-w-4xl relative z-10">
        <div className="surface-card rounded-3xl overflow-hidden grid md:grid-cols-12 shadow-xl">
          {/* Institutional Context Panel */}
          <div className="md:col-span-5 bg-primary text-white p-7 sm:p-9 flex flex-col justify-between relative overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-2xl pointer-events-none"
            />
            <div className="space-y-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
                  <CalendarDays size={22} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">
                    {UNIVERSITY.shortName}
                  </p>
                  <p className="font-display font-bold text-lg leading-tight">SmartSched</p>
                </div>
              </div>

              <div className="space-y-2.5">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
                  {UNIVERSITY.productName}
                </h1>
                <p className="text-sm text-blue-100/90 leading-relaxed">
                  {UNIVERSITY.fullName} — unified academic scheduling for {INSTITUTES.CSPIT.code},{' '}
                  {INSTITUTES.DEPSTAR.code}, and campus departments.
                </p>
              </div>

              <ul className="space-y-3 pt-2 text-xs sm:text-sm text-blue-50/95">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-300" aria-hidden="true" />
                  <span>Students & professors view live weekly and dated schedules with room details.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Users size={16} className="shrink-0 mt-0.5 text-amber-300" aria-hidden="true" />
                  <span>HODs & coordinators manage divisions, labs, and faculty workloads cleanly.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Cpu size={16} className="shrink-0 mt-0.5 text-sky-300" aria-hidden="true" />
                  <span>Automated constraint solver prevents classroom, lab, and faculty clashes.</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-5 border-t border-white/15 flex items-center justify-between text-xs text-blue-100/80 relative z-10">
              <span>{UNIVERSITY.motto}</span>
              <span>{UNIVERSITY.campus.split(',')[0]}</span>
            </div>
          </div>

          {/* Sign-In Form Panel */}
          <div className="md:col-span-7 p-7 sm:p-9 flex flex-col justify-center bg-card">
            <div className="mb-6">
              <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Sign in to your account
              </h2>
              <p className="text-sm text-muted mt-1">
                Use your official <span className="font-medium text-foreground">@charusat.edu.in</span> or{' '}
                <span className="font-medium text-foreground">@charusat.ac.in</span> email.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="flex items-center gap-1.5">
                  <Mail size={13} className="text-primary dark:text-cyan-accent" aria-hidden="true" />
                  CHARUSAT Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="23ce001@charusat.edu.in"
                  className="h-11"
                  aria-invalid={errors.email ? 'true' : undefined}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                  {...register('email')}
                />
                {errors.email && (
                  <p id="login-email-error" role="alert" className="text-xs text-danger font-medium">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="flex items-center gap-1.5">
                    <Lock size={13} className="text-primary dark:text-cyan-accent" aria-hidden="true" />
                    Password
                  </Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-primary dark:text-cyan-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="h-11 pr-10"
                    aria-invalid={errors.password ? 'true' : undefined}
                    aria-describedby={errors.password ? 'login-password-error' : undefined}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-subtle cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>
                {errors.password && (
                  <p id="login-password-error" role="alert" className="text-xs text-danger font-medium">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                loading={isSubmitting}
                className="w-full font-semibold mt-2"
              >
                {isSubmitting ? 'Signing in…' : 'Sign In to Portal'}
                {!isSubmitting && <ArrowRight size={16} aria-hidden="true" />}
              </Button>
            </form>

            {/* Quick Demo Access */}
            <div className="mt-7 pt-5 border-t border-border space-y-2.5">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider text-center">
                Quick Demo Access
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 gap-1.5 font-semibold"
                  onClick={() => handleQuickLogin(UNIVERSITY.demoAdmin)}
                >
                  <Building2 size={14} className="text-primary dark:text-cyan-accent" aria-hidden="true" />
                  {INSTITUTES.CSPIT.code} Admin Demo
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 gap-1.5 font-semibold"
                  onClick={() => handleQuickLogin('admin.depstar@charusat.edu.in')}
                >
                  <ShieldCheck size={14} className="text-gold" aria-hidden="true" />
                  {INSTITUTES.DEPSTAR.code} Admin Demo
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
