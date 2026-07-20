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
  hoverGlow = true,
  title,
  subtitle,
  action,
  headerIcon,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'glass rounded-2xl p-5 relative overflow-hidden transition-all',
        hoverGlow && 'glow-card',
        className
      )}
      {...props}
    >
      {(title || subtitle || action || headerIcon) && (
        <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-border/40">
          <div className="flex items-center gap-3">
            {headerIcon && (
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary dark:bg-cyan-accent/10 dark:text-cyan-accent">
                {headerIcon}
              </div>
            )}
            <div>
              {title && <h3 className="font-display font-bold text-base tracking-tight">{title}</h3>}
              {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </motion.div>
  );
}
