import { motion } from 'framer-motion';
import { Building2, Sparkles, ShieldCheck } from 'lucide-react';
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
  const isCSPIT = code.toUpperCase().includes('CSPIT');
  const isDEPSTAR = code.toUpperCase().includes('DEPSTAR');

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3 py-1.5 text-xs gap-2',
    lg: 'px-4 py-2 text-sm gap-2.5',
  };

  const badgeStyle = isCSPIT
    ? 'bg-gradient-to-r from-blue-900/80 to-blue-700/80 text-white border-blue-400/40 shadow-blue-900/20'
    : isDEPSTAR
    ? 'bg-gradient-to-r from-amber-700/80 to-orange-600/80 text-white border-amber-300/40 shadow-amber-900/20'
    : 'bg-gradient-to-r from-slate-900/80 to-primary/80 text-white border-cyan-accent/40 shadow-cyan-900/20';

  return (
    <motion.div
      whileHover={{ scale: 1.04, y: -1 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'inline-flex items-center rounded-full font-bold shadow-lg backdrop-blur-md border border-white/20 transition-all',
        sizeClasses[size],
        badgeStyle,
        className
      )}
    >
      {isCSPIT ? (
        <Building2 size={size === 'sm' ? 12 : 14} className="text-cyan-300 animate-pulse" />
      ) : isDEPSTAR ? (
        <Sparkles size={size === 'sm' ? 12 : 14} className="text-amber-200 animate-pulse" />
      ) : (
        <ShieldCheck size={size === 'sm' ? 12 : 14} className="text-cyan-accent animate-pulse" />
      )}
      <span className="tracking-wide uppercase font-display">{code}</span>
      {roleLabel && (
        <span className="pl-1.5 border-l border-white/30 text-[10px] opacity-90 font-medium">
          {roleLabel}
        </span>
      )}
    </motion.div>
  );
}
