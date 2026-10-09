import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useFeatureFlagsStore, FeatureKey } from '@/store/featureFlagsStore';
import { Button } from '@/components/ui';

interface FeatureGuardProps {
  featureKey: FeatureKey;
  children: React.ReactNode;
}

export const FeatureGuard: React.FC<FeatureGuardProps> = ({ featureKey, children }) => {
  const { isFeatureEnabled } = useFeatureFlagsStore();
  const navigate = useNavigate();

  const enabled = isFeatureEnabled(featureKey);

  if (enabled) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass max-w-md w-full p-8 rounded-3xl border border-border/40 shadow-2xl text-center space-y-5"
      >
        <p className="text-sm font-semibold text-muted">No data available</p>
        <Button
          variant="outline"
          className="rounded-xl gap-2 text-foreground font-semibold mx-auto"
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft size={16} /> Return to Dashboard
        </Button>
      </motion.div>
    </div>
  );
};
