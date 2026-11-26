import { Building2, GraduationCap, ShieldCheck } from 'lucide-react';
import { cn } from '@/utils/cn';

interface InstituteBadgeProps {
  code?: string;
  roleLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function InstituteBadge({
  code = 'CHARUSAT',
  roleLabel,
  size = 'md',
  className,
}: InstituteBadgeProps) {
  const upper = code.toUpperCase();
  const isCSPIT = upper.includes('CSPIT');
  const isDEPSTAR = upper.includes('DEPSTAR');

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[11px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3.5 py-1.5 text-xs gap-2',
  };

  const badgeStyle = isCSPIT
    ? 'bg-primary/10 text-primary border-primary/20 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-400/30'
    : isDEPSTAR
      ? 'bg-amber-500/12 text-amber-800 border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-400/30'
      : 'bg-surface-subtle text-foreground border-border';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold border whitespace-nowrap',
        sizeClasses[size],
        badgeStyle,
        className
      )}
    >
      {isCSPIT ? (
        <Building2 size={12} aria-hidden="true" />
      ) : isDEPSTAR ? (
        <GraduationCap size={12} aria-hidden="true" />
      ) : (
        <ShieldCheck size={12} aria-hidden="true" />
      )}
      <span className="tracking-wide uppercase font-display">{code}</span>
      {roleLabel && (
        <span className="pl-1.5 border-l border-current/25 text-[10px] opacity-85 font-medium">
          {roleLabel}
        </span>
      )}
    </span>
  );
}
