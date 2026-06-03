import React from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import type { FeatureKey } from '@/stores/subscriptionStore';
import { Lock } from 'lucide-react';

interface PlanGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showOverlay?: boolean;
}

export const PlanGate: React.FC<PlanGateProps> = ({ 
  feature, 
  children, 
  fallback, 
  showOverlay = false 
}) => {
  const { user } = useAuthStore();
  const planDefinitions = useSubscriptionStore(state => state.planDefinitions);
  
  let canAccess = false;
  
  if (user) {
    if (user.custom_features && user.custom_features.includes(feature)) {
      canAccess = true;
    } else {
      const planDef = planDefinitions[user.plan];
      if (planDef && planDef.features.includes(feature)) {
        canAccess = true;
      }
    }
  }

  if (canAccess) {
    return <>{children}</>;
  }

  if (showOverlay) {
    return (
      <div className="relative group">
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 backdrop-blur-[1px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
            <Lock size={12} />
            Upgrade Required
          </div>
        </div>
      </div>
    );
  }

  return fallback ? <>{fallback}</> : null;
};
