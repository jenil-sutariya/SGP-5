import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, ToggleRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useFeatureFlagsStore, FeatureKey, FEATURE_DEFINITIONS } from '@/store/featureFlagsStore';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui';

interface FeatureGuardProps {
  featureKey: FeatureKey;
  children: React.ReactNode;
}

export const FeatureGuard: React.FC<FeatureGuardProps> = ({ featureKey, children }) => {
  const { isFeatureEnabled, setFeatureState } = useFeatureFlagsStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const enabled = isFeatureEnabled(featureKey);
  const isMasterAdmin = user?.role?.name === 'ADMIN';
  const featureDef = FEATURE_DEFINITIONS.find((f) => f.key === featureKey);

  if (enabled) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass max-w-lg w-full p-8 rounded-3xl border border-amber-500/30 dark:border-amber-400/20 shadow-2xl text-center relative overflow-hidden"
      >
        {/* Background glow effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-amber-600/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-5 shadow-lg">
          <ShieldAlert size={32} />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-3">
          <Sparkles size={12} /> Feature Flag Controlled
        </div>

        <h2 className="text-2xl font-display font-extrabold tracking-tight text-foreground mb-2">
          {featureDef?.label || 'Feature'} is Currently Disabled
        </h2>

        <p className="text-sm text-muted mb-6 leading-relaxed">
          {featureDef?.description || 'This module has been temporarily toggled off by the Master Admin for project review and presentation.'}
        </p>

        {isMasterAdmin ? (
          <div className="space-y-3 bg-slate-100/60 dark:bg-slate-800/40 p-4 rounded-2xl border border-border/50 mb-6">
            <p className="text-xs font-semibold text-primary dark:text-cyan-accent flex items-center justify-center gap-1">
              <ToggleRight size={16} /> Master Admin Override
            </p>
            <Button
              variant="default"
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 gap-2"
              onClick={() => setFeatureState(featureKey, true)}
            >
              Enable {featureDef?.label || 'Feature'} Now
            </Button>
          </div>
        ) : null}

        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            className="rounded-xl gap-2 text-foreground font-semibold"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft size={16} /> Return to Dashboard
          </Button>
          {isMasterAdmin && (
            <Button
              variant="ghost"
              className="rounded-xl gap-2 text-primary dark:text-cyan-accent font-semibold"
              onClick={() => navigate('/master-admin')}
            >
              Open Feature Manager
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
