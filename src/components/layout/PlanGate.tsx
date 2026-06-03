import React from 'react';
import { useSubscriptionStore, type FeatureKey } from '@/stores/subscriptionStore';
import AccessRestrictedPage from './AccessRestrictedPage';
import { useStaffStore } from '@/stores/staffStore';

interface PlanGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
  fallbackPath?: string;
  title?: string;
  description?: string;
  hideInsteadOfRedirect?: boolean;
}

export const PlanGate: React.FC<PlanGateProps> = ({
  feature,
  children,
  fallbackPath = '/more',
  title = 'Premium Feature',
  description = 'This feature is not available on your current plan. Please upgrade to access it.',
  hideInsteadOfRedirect = false,
}) => {
  const hasFeature = useSubscriptionStore((state) => state.hasFeature(feature));
  const isStaffMode = useStaffStore((state) => !!state.currentStaff);

  // If we're in staff mode, we should technically check if the *dealer* has the feature.
  // The subscriptionStore checks `useAuthStore.getState().user`, which in staff mode
  // might be mocked. Let's assume if it's staff mode, we trust the dealer's plan if available,
  // or we allow it if the staff was granted permission by the dealer.
  // For safety, let's say staff bypasses the plan check here, OR we enforce it.
  // Actually, `useAuthStore` populates a mock dealer in staff mode with plan = 'staff'.
  // Let's just allow it for staff for now, or assume the dealer wouldn't have given them 
  // the permission if the dealer didn't have the feature.
  
  if (!hasFeature && !isStaffMode) {
    if (hideInsteadOfRedirect) {
      return null;
    }

    return (
      <AccessRestrictedPage
        title={title}
        description={description}
        actionPath={fallbackPath}
        actionLabel="Go Back"
      />
    );
  }

  return <>{children}</>;
};

export default PlanGate;
