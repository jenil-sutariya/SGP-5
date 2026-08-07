import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Sliders,
  Sparkles,
  CheckCircle2,
  XCircle,
  Building2,
  Building,
  GraduationCap,
  Users,
  UserCheck,
  User,
  BookOpen,
  BookMarked,
  DoorOpen,
  FlaskConical,
  CalendarDays,
  Cpu,
  Bell,
  RefreshCw,
  Zap,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useFeatureFlagsStore, FEATURE_DEFINITIONS, FeatureKey } from '@/store/featureFlagsStore';
import { Button } from '@/components/ui';
import { cn } from '@/utils/cn';

const iconMap: Record<string, React.ElementType> = {
  Building2,
  Building,
  GraduationCap,
  Users,
  UserCheck,
  User,
  BookOpen,
  BookMarked,
  DoorOpen,
  FlaskConical,
  CalendarDays,
  Cpu,
  Bell,
};

const categoryLabels: Record<string, { label: string; color: string }> = {
  organisation: { label: 'Organisation & Setup', color: 'from-blue-500/20 to-indigo-500/10 text-blue-600 dark:text-blue-400' },
  academics: { label: 'Academic Structure', color: 'from-purple-500/20 to-pink-500/10 text-purple-600 dark:text-purple-400' },
  people: { label: 'People Directory', color: 'from-emerald-500/20 to-teal-500/10 text-emerald-600 dark:text-emerald-400' },
  facilities: { label: 'Facilities & Labs', color: 'from-amber-500/20 to-orange-500/10 text-amber-600 dark:text-amber-400' },
  scheduling: { label: 'Scheduling & AI Core', color: 'from-cyan-500/20 to-blue-500/10 text-cyan-600 dark:text-cyan-400' },
};

export default function MasterAdminPage() {
  const { flags, toggleFeature, applyPreset, fetchFlags, isLoading, lastUpdated } = useFeatureFlagsStore();

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const totalFeatures = FEATURE_DEFINITIONS.length;
  const activeCount = FEATURE_DEFINITIONS.filter((f) => flags[f.key]).length;
  const activePercentage = Math.round((activeCount / totalFeatures) * 100);

  const categories = ['organisation', 'academics', 'people', 'facilities', 'scheduling'] as const;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Banner & Header */}
      <div className="glass relative overflow-hidden rounded-3xl p-8 border border-white/20 dark:border-white/10 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-primary/20 via-cyan-accent/10 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary dark:text-cyan-accent text-xs font-extrabold uppercase tracking-wider">
              <Sparkles size={14} /> Master Admin Feature Toggles
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-foreground">
              Project Review Control Center
            </h1>
            <p className="text-sm text-muted max-w-2xl leading-relaxed">
              Enable or disable specific system modules dynamically during live project demonstrations. Disabling a feature cleanly hides its navigation and guards route access.
            </p>
          </div>

          {/* Active Features Status Overview Card */}
          <div className="glass p-5 rounded-2xl border border-border/50 min-w-[280px] space-y-3 bg-white/40 dark:bg-slate-900/40">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted">
              <span>Active Features</span>
              <span className="text-primary dark:text-cyan-accent">{activeCount} / {totalFeatures} ({activePercentage}%)</span>
            </div>
            <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${activePercentage}%` }}
                className="h-full bg-gradient-to-r from-primary to-cyan-accent rounded-full shadow-md"
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted font-medium">
              <span>{activeCount === totalFeatures ? '⚡ Full Access Mode' : `${totalFeatures - activeCount} Features Disabled`}</span>
              {lastUpdated && <span>Synced {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Presets Toolbar */}
      <div className="glass p-5 rounded-2xl border border-white/20 dark:border-white/10 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Zap size={18} className="text-amber-500" />
            <span>Quick Review Presets</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchFlags()}
            disabled={isLoading}
            className="text-xs text-muted hover:text-foreground gap-1.5 rounded-xl"
          >
            <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} /> Refresh State
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Button
            variant="outline"
            className="justify-start gap-3 rounded-xl border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs py-5"
            onClick={() => applyPreset('all')}
          >
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
            <div className="text-left">
              <div>Enable All Features</div>
              <div className="text-[10px] font-normal text-muted">Full Presentation Mode</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start gap-3 rounded-xl border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold text-xs py-5"
            onClick={() => applyPreset('scheduling_only')}
          >
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-600 dark:text-cyan-400">
              <Play size={16} />
            </div>
            <div className="text-left">
              <div>Core Scheduling Demo</div>
              <div className="text-[10px] font-normal text-muted">Focus on Timetable AI</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start gap-3 rounded-xl border-rose-500/30 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs py-5"
            onClick={() => applyPreset('none')}
          >
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400">
              <XCircle size={16} />
            </div>
            <div className="text-left">
              <div>Disable All Features</div>
              <div className="text-[10px] font-normal text-muted">Minimal Dashboard</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start gap-3 rounded-xl border-primary/30 hover:bg-primary/10 text-primary dark:text-cyan-accent font-bold text-xs py-5"
            onClick={() => applyPreset('core_demo')}
          >
            <div className="p-2 rounded-lg bg-primary/20 text-primary dark:text-cyan-accent">
              <RotateCcw size={16} />
            </div>
            <div className="text-left">
              <div>Reset Default Toggles</div>
              <div className="text-[10px] font-normal text-muted">Standard SmartSched Setup</div>
            </div>
          </Button>
        </div>
      </div>

      {/* Feature Toggles Grid by Categories */}
      <div className="space-y-8">
        {categories.map((catKey) => {
          const categoryFeatures = FEATURE_DEFINITIONS.filter((f) => f.category === catKey);
          if (categoryFeatures.length === 0) return null;
          const meta = categoryLabels[catKey];

          return (
            <div key={catKey} className="space-y-4">
              <div className="flex items-center gap-2">
                <div className={cn('p-1.5 rounded-lg bg-gradient-to-r', meta.color)}>
                  <Sliders size={16} />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground tracking-tight">
                  {meta.label}
                </h2>
                <span className="text-xs text-muted font-medium ml-auto">
                  {categoryFeatures.filter((f) => flags[f.key]).length} / {categoryFeatures.length} active
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryFeatures.map((feature) => {
                  const Icon = iconMap[feature.iconName] || Sliders;
                  const isEnabled = flags[feature.key] ?? true;

                  return (
                    <motion.div
                      key={feature.key}
                      whileHover={{ y: -2 }}
                      className={cn(
                        'glass p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden',
                        isEnabled
                          ? 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-md'
                          : 'border-border/60 bg-slate-100/40 dark:bg-slate-900/40 opacity-75'
                      )}
                    >
                      {/* Top status indicator bar */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'p-2.5 rounded-xl transition-colors shadow-sm',
                              isEnabled
                                ? 'bg-primary text-white shadow-primary/30'
                                : 'bg-slate-200 dark:bg-slate-800 text-muted'
                            )}
                          >
                            <Icon size={20} />
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                              {feature.label}
                            </h3>
                            <span className="text-[10px] font-mono text-muted uppercase tracking-wider">
                              {feature.route}
                            </span>
                          </div>
                        </div>

                        {/* Interactive Toggle Button */}
                        <button
                          type="button"
                          onClick={() => toggleFeature(feature.key as FeatureKey)}
                          className={cn(
                            'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                            isEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                          )}
                          aria-label={`Toggle ${feature.label}`}
                        >
                          <motion.span
                            layout
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className={cn(
                              'pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
                              isEnabled ? 'translate-x-5' : 'translate-x-0'
                            )}
                          />
                        </button>
                      </div>

                      <p className="text-xs text-muted mb-4 leading-relaxed flex-1">
                        {feature.description}
                      </p>

                      <div className="flex items-center justify-between pt-3 border-t border-border/40 text-xs">
                        <span className="font-semibold text-muted">Status:</span>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider',
                            isEnabled
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-slate-200 dark:bg-slate-800 text-muted'
                          )}
                        >
                          {isEnabled ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          {isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
