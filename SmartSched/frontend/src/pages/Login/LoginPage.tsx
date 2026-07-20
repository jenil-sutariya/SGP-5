import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Sparkles, ShieldCheck, ArrowRight, Building2, Lock, Mail } from 'lucide-react';
import { authApi } from '@/api';
import { useAuthStore } from '@/store/authStore';
import { Button, Input, Label } from '@/components/ui';
import { GlassCard } from '@/components/common/GlassCard';
import { CharusatAnimatedBackground } from '@/components/common/CharusatAnimatedBackground';
import { UNIVERSITY, INSTITUTES } from '@/constants/university';

const schema = z.object({
  email: z
    .string()
    .email()
    .refine(
      (v) => UNIVERSITY.emailDomains.some((d) => v.toLowerCase().endsWith(`@${d}`)),
      `Use your ${UNIVERSITY.shortName} email (@${UNIVERSITY.emailDomains[0]})`
    ),
  password: z.string().min(1),
});

type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Form) => {
    try {
      const { data } = await authApi.login(values.email, values.password);
      setAuth(data.data.user, data.data.accessToken, data.data.refreshToken);
      toast.success(`Welcome to ${UNIVERSITY.productName}`);
      navigate('/dashboard');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Login failed';
      toast.error(msg);
    }
  };

  const handleQuickLogin = (email: string) => {
    setValue('email', email);
    setValue('password', 'Admin@123');
    toast.info(`Pre-filled credentials for ${email}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative text-foreground">
      {/* Background Animated Floating Elements */}
      <CharusatAnimatedBackground />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <GlassCard className="p-8 border border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-2xl">
          {/* Header Brand Badge */}
          <div className="mb-8 text-center space-y-2">
            <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-gradient-to-tr from-primary to-primary-light text-white shadow-lg shadow-primary/30 mb-2">
              <Sparkles size={28} />
            </div>
            <p className="text-xs font-bold tracking-[0.2em] text-primary dark:text-cyan-accent uppercase">
              {UNIVERSITY.shortName}
            </p>
            <h1 className="font-display text-3xl font-extrabold text-foreground tracking-tight">
              {UNIVERSITY.productName}
            </h1>
            <p className="text-xs text-muted font-medium max-w-xs mx-auto">
              {UNIVERSITY.productTagline}
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/15 text-gold text-[11px] font-bold border border-gold/30 mt-1">
              <span>{UNIVERSITY.motto}</span>
            </div>
          </div>

          {/* Login Form */}
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <Mail size={14} className="text-primary" /> CHARUSAT Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="23ce001@charusat.edu.in"
                className="rounded-xl h-11"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-danger font-medium">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <Lock size={14} className="text-primary" /> Password
                </Label>
                <Link to="/forgot-password" className="text-xs font-medium text-primary dark:text-cyan-accent hover:underline">
                  Forgot?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="rounded-xl h-11"
                {...register('password')}
              />
              {errors.password && <p className="text-xs text-danger font-medium">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-xl font-bold text-sm bg-gradient-to-r from-primary to-primary-light text-white shadow-lg shadow-primary/30 hover:opacity-95 mt-2 gap-2"
            >
              {isSubmitting ? 'Authenticating…' : 'Sign In to Portal'}
              <ArrowRight size={16} />
            </Button>
          </form>

          {/* Quick One-Click Demo Admin Badges */}
          <div className="mt-8 pt-6 border-t border-border/40 space-y-3">
            <p className="text-xs font-bold text-muted uppercase tracking-wider text-center">
              Quick Admin Demo Login
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl h-10 gap-1.5 text-xs font-bold border-blue-500/30 hover:bg-blue-500/10 text-primary dark:text-cyan-accent"
                onClick={() => handleQuickLogin(UNIVERSITY.demoAdmin)}
              >
                <Building2 size={14} /> {INSTITUTES.CSPIT.code} Admin
              </Button>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl h-10 gap-1.5 text-xs font-bold border-amber-500/30 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                onClick={() => handleQuickLogin('admin.depstar@charusat.edu.in')}
              >
                <ShieldCheck size={14} /> {INSTITUTES.DEPSTAR.code} Admin
              </Button>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
