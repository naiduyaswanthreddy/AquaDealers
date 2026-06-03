import React from 'react';
import { useStaffStore } from '@/stores/staffStore';
import { getStaffFeatureMode, type StaffFeatureKey } from '@/lib/staffAccess';
import AccessRestrictedPage from './AccessRestrictedPage';

interface FeatureGateProps {
  allowed: StaffFeatureKey[];
  children: React.ReactNode;
  fallbackPath?: string;
  title?: string;
  description?: string;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  allowed,
  children,
  fallbackPath = '/more',
  title,
  description,
}) => {
  const currentStaff = useStaffStore((state) => state.currentStaff);
  const isStaffMode = !!currentStaff;

  if (isStaffMode) {
    const canAccess = allowed.some(
      (featureKey) => getStaffFeatureMode(featureKey, currentStaff?.permissions, true) === 'visible'
    );

    if (!canAccess) {
      return (
        <AccessRestrictedPage
          title={title}
          description={description}
          actionPath={fallbackPath}
        />
      );
    }
  }

  return <>{children}</>;
};

export default FeatureGate;

