import { ReactNode } from 'react';
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
  className,
  action,
}: MetricCardProps) {
  const isPositive = changeType === 'positive';
  const isNegative = changeType === 'negative';

  return (
    <div
      className={cn(
        'surface-card glow-card rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">{title}</span>
        <div className="p-2.5 rounded-xl bg-primary/8 text-primary dark:bg-blue-500/15 dark:text-cyan-accent">
          <Icon size={18} aria-hidden="true" />
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display font-bold text-3xl tracking-tight text-foreground tabular-nums">
            {value}
          </h3>
          {change && (
            <div
              className={cn(
                'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border',
                isPositive && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
                isNegative && 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
                !isPositive && !isNegative && 'bg-surface-subtle text-muted border-border'
              )}
            >
              {isPositive && <TrendingUp size={12} aria-hidden="true" />}
              {isNegative && <TrendingDown size={12} aria-hidden="true" />}
              {!isPositive && !isNegative && <Minus size={12} aria-hidden="true" />}
              <span>{change}</span>
            </div>
          )}
        </div>
        {subtitle && <p className="text-xs text-muted mt-1.5">{subtitle}</p>}
      </div>

      {action && <div className="mt-3 pt-3 border-t border-border">{action}</div>}
    </div>
  );
}
