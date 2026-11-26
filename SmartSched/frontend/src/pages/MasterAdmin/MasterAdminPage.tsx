import React, { useEffect } from 'react';
import {
  Sliders,
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

const categoryLabels: Record<string, { label: string; badge: string }> = {
  organisation: { label: 'Organisation & Setup', badge: 'bg-blue-500/12 text-blue-700 dark:text-blue-300' },
  academics: { label: 'Academic Structure', badge: 'bg-purple-500/12 text-purple-700 dark:text-purple-300' },
  people: { label: 'People Directory', badge: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' },
  facilities: { label: 'Facilities & Labs', badge: 'bg-amber-500/12 text-amber-800 dark:text-amber-300' },
  scheduling: { label: 'Scheduling & AI Core', badge: 'bg-cyan-500/12 text-cyan-800 dark:text-cyan-300' },
};

export default function MasterAdminPage() {
  const { flags, toggleFeature, applyPreset, fetchFlags, isLoading, lastUpdated } =
    useFeatureFlagsStore();

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const totalFeatures = FEATURE_DEFINITIONS.length;
  const activeCount = FEATURE_DEFINITIONS.filter((f) => flags[f.key]).length;
  const activePercentage = Math.round((activeCount / totalFeatures) * 100);

  const categories = ['organisation', 'academics', 'people', 'facilities', 'scheduling'] as const;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* Top Banner */}
      <section className="surface-card rounded-2xl p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary dark:bg-blue-500/15 dark:text-cyan-accent text-xs font-semibold uppercase tracking-wider">
            <Sliders size={13} aria-hidden="true" /> Master Admin Controls
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-foreground">
            Feature Availability Manager
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            Enable or disable portal modules dynamically. Disabling a module hides its navigation
            entry and guards direct route access.
          </p>
        </div>

        {/* Status Overview */}
        <div className="rounded-2xl border border-border bg-surface-subtle/60 p-4 sm:p-5 min-w-[270px] space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
            <span>Active Modules</span>
            <span className="text-primary dark:text-cyan-accent tabular-nums">
              {activeCount} / {totalFeatures} ({activePercentage}%)
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${activePercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>
              {activeCount === totalFeatures
                ? 'Full Access Mode'
                : `${totalFeatures - activeCount} Modules Disabled`}
            </span>
            {lastUpdated && (
              <span className="tabular-nums">
                Synced{' '}
                {new Date(lastUpdated).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Quick Action Presets */}
      <section className="surface-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Zap size={17} className="text-gold" aria-hidden="true" />
            <span>Quick Presets</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchFlags()}
            disabled={isLoading}
            className="text-xs text-muted hover:text-foreground gap-1.5"
          >
            <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} aria-hidden="true" />
            Refresh State
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Button
            variant="outline"
            className="justify-start gap-3 h-auto py-3 px-3.5"
            onClick={() => applyPreset('all')}
          >
            <div className="p-2 rounded-lg bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 size={16} aria-hidden="true" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-foreground">Enable All Features</div>
              <div className="text-[11px] font-normal text-muted">Full Presentation Mode</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start gap-3 h-auto py-3 px-3.5"
            onClick={() => applyPreset('scheduling_only')}
          >
            <div className="p-2 rounded-lg bg-sky-500/12 text-sky-700 dark:text-sky-300">
              <Play size={16} aria-hidden="true" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-foreground">Core Scheduling Demo</div>
              <div className="text-[11px] font-normal text-muted">Focus on Timetable AI</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start gap-3 h-auto py-3 px-3.5"
            onClick={() => applyPreset('none')}
          >
            <div className="p-2 rounded-lg bg-red-500/12 text-red-700 dark:text-red-300">
              <XCircle size={16} aria-hidden="true" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-foreground">Disable All Features</div>
              <div className="text-[11px] font-normal text-muted">Minimal Dashboard</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start gap-3 h-auto py-3 px-3.5"
            onClick={() => applyPreset('core_demo')}
          >
            <div className="p-2 rounded-lg bg-primary/10 text-primary dark:text-cyan-accent">
              <RotateCcw size={16} aria-hidden="true" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-foreground">Reset Defaults</div>
              <div className="text-[11px] font-normal text-muted">Standard SmartSched Setup</div>
            </div>
          </Button>
        </div>
      </section>

      {/* Feature Toggles Grid by Category */}
      <div className="space-y-7">
        {categories.map((catKey) => {
          const categoryFeatures = FEATURE_DEFINITIONS.filter((f) => f.category === catKey);
          if (categoryFeatures.length === 0) return null;
          const meta = categoryLabels[catKey];

          return (
            <div key={catKey} className="space-y-3.5">
              <div className="flex items-center gap-2.5">
                <div className={cn('p-1.5 rounded-lg', meta.badge)}>
                  <Sliders size={15} aria-hidden="true" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground tracking-tight">
                  {meta.label}
                </h2>
                <span className="text-xs text-muted font-medium ml-auto tabular-nums">
                  {categoryFeatures.filter((f) => flags[f.key]).length} / {categoryFeatures.length}{' '}
                  active
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryFeatures.map((feature) => {
                  const Icon = iconMap[feature.iconName] || Sliders;
                  const isEnabled = flags[feature.key] ?? true;

                  return (
                    <div
                      key={feature.key}
                      className={cn(
                        'surface-card p-5 rounded-2xl transition-colors flex flex-col justify-between',
                        isEnabled
                          ? 'border-emerald-500/35'
                          : 'opacity-80 bg-surface-subtle/50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              'p-2.5 rounded-xl shrink-0',
                              isEnabled
                                ? 'bg-primary text-white'
                                : 'bg-surface-subtle text-muted'
                            )}
                          >
                            <Icon size={18} aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm text-foreground truncate">
                              {feature.label}
                            </h3>
                            <span className="text-[11px] font-mono text-muted">
                              {feature.route}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={isEnabled}
                          aria-label={`Toggle ${feature.label}`}
                          onClick={() => toggleFeature(feature.key as FeatureKey)}
                          className={cn(
                            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                            isEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                          )}
                        >
                          <span
                            className={cn(
                              'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs transition-transform duration-150',
                              isEnabled ? 'translate-x-5' : 'translate-x-0'
                            )}
                          />
                        </button>
                      </div>

                      <p className="text-xs text-muted mb-4 leading-relaxed flex-1">
                        {feature.description}
                      </p>

                      <div className="flex items-center justify-between pt-3 border-t border-border text-xs">
                        <span className="font-medium text-muted">Status</span>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
                            isEnabled
                              ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                              : 'bg-surface-subtle text-muted'
                          )}
                        >
                          {isEnabled ? (
                            <CheckCircle2 size={12} aria-hidden="true" />
                          ) : (
                            <XCircle size={12} aria-hidden="true" />
                          )}
                          {isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
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
