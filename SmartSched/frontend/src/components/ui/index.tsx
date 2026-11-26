import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-light shadow-xs',
        secondary: 'bg-secondary text-white hover:bg-secondary/90 shadow-xs',
        outline: 'border border-border bg-card text-foreground hover:bg-surface-subtle',
        ghost: 'text-foreground hover:bg-surface-subtle',
        danger: 'bg-danger text-white hover:bg-danger/90 shadow-xs',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8.5 rounded-lg px-3 text-xs',
        lg: 'h-11 rounded-xl px-6',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {!asChild && loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {children}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export const inputBaseClasses =
  'flex h-10 w-full rounded-xl border border-border bg-white dark:bg-slate-900 px-3 py-2 text-sm text-foreground placeholder:text-muted/70 outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(inputBaseClasses, className)} {...props} />
  )
);
Input.displayName = 'Input';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(inputBaseClasses, 'cursor-pointer font-medium', className)} {...props} />
  )
);
Select.displayName = 'Select';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-xs font-semibold text-foreground/90', className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('surface-card rounded-2xl p-5 sm:p-6', className)} {...props} />;
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'primary' | 'outline' | 'success' | 'danger' | 'warning' | 'secondary';
}) {
  const styles = {
    default: 'bg-primary/10 text-primary dark:bg-blue-500/15 dark:text-blue-300',
    primary: 'bg-primary/10 text-primary dark:bg-blue-500/15 dark:text-blue-300',
    outline: 'border border-border bg-transparent text-foreground',
    success: 'bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    danger: 'bg-red-500/12 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    warning: 'bg-amber-500/15 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    secondary: 'bg-surface-subtle text-foreground/85',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        styles[variant],
        className
      )}
      {...props}
    />
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-800/70', className)}
      {...props}
    />
  );
}
