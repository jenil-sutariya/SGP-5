import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/utils/cn';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  subtitle?: string;
  accentGradient?: string;
  className?: string;
  action?: ReactNode;
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  change,
  changeType = 'positive',
  subtitle,
  accentGradient = 'from-primary/20 to-cyan-accent/10',
  className,
  action,
}: MetricCardProps) {
  const isPositive = changeType === 'positive';
  const isNegative = changeType === 'negative';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className={cn(
        'glass glow-card rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between border border-border/60',
        className
      )}
    >
      {/* Background Subtle Gradient Accent */}
      <div className={cn('absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br blur-2xl opacity-40 pointer-events-none', accentGradient)} />

      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">{title}</span>
        <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 dark:from-cyan-accent/20 dark:to-primary/20 text-primary dark:text-cyan-accent shadow-inner">
          <Icon size={20} />
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display font-extrabold text-3xl tracking-tight text-foreground">{value}</h3>
          {change && (
            <div
              className={cn(
                'inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border',
                isPositive && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                isNegative && 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
                !isPositive && !isNegative && 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
              )}
            >
              {isPositive && <TrendingUp size={12} />}
              {isNegative && <TrendingDown size={12} />}
              {!isPositive && !isNegative && <Minus size={12} />}
              <span>{change}</span>
            </div>
          )}
        </div>
        {subtitle && <p className="text-xs text-muted mt-1 font-medium">{subtitle}</p>}
      </div>

      {action && <div className="mt-3 pt-3 border-t border-border/40">{action}</div>}
    </motion.div>
  );
}
