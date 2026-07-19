import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { authApi } from '@/api';
import { useAuthStore } from '@/store/authStore';
import { Button, Card, Input, Label } from '@/components/ui';
import { UNIVERSITY } from '@/constants/university';

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

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="p-8">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">{UNIVERSITY.shortName}</p>
            <h1 className="font-display mt-1 text-3xl font-bold text-primary">{UNIVERSITY.productName}</h1>
            <p className="mt-2 text-sm text-muted">{UNIVERSITY.productTagline}</p>
            <p className="mt-1 text-xs text-muted">{UNIVERSITY.campus}</p>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="email">CHARUSAT Email</Label>
              <Input id="email" type="email" placeholder="23ce001@charusat.edu.in" {...register('email')} />
              {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
              {errors.password && <p className="text-xs text-danger">{errors.password.message}</p>}
            </div>
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <Button className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <div className="mt-6 space-y-1 text-center text-xs text-muted">
            <p>CSPIT Admin: admin.cspit@charusat.edu.in</p>
            <p>DEPSTAR Admin: admin.depstar@charusat.edu.in</p>
            <p>Password: Admin@123</p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
