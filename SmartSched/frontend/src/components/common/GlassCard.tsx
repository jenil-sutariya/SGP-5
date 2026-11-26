import { ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/utils/cn';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
  hoverGlow?: boolean;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  headerIcon?: ReactNode;
}

export function GlassCard({
  children,
  className,
  hoverGlow = false,
  title,
  subtitle,
  action,
  headerIcon,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'surface-card rounded-2xl p-5 sm:p-6 relative overflow-hidden',
        hoverGlow && 'glow-card',
        className
      )}
      {...props}
    >
      {(title || subtitle || action || headerIcon) && (
        <div className="flex items-start justify-between gap-3 mb-4 pb-3.5 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            {headerIcon && (
              <div className="p-2 rounded-xl bg-primary/10 text-primary dark:bg-blue-500/15 dark:text-cyan-accent shrink-0">
                {headerIcon}
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="font-display font-bold text-base tracking-tight text-foreground truncate">
                  {title}
                </h3>
              )}
              {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </motion.div>
  );
}
