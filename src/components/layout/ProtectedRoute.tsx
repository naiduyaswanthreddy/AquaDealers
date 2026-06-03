import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useStaffStore } from '@/stores/staffStore';
import { AquaLoader } from '@/components/ui';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, onboardingComplete, isLoading } = useAuthStore();
  const currentStaff = useStaffStore((state) => state.currentStaff);
  const location = useLocation();

  // Full page branded loading state
  if (isLoading) {
    return <AquaLoader />;
  }

  // Not signed in -> send to login page
  if (!isAuthenticated && !currentStaff) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Signed in but onboarding not finished -> send to onboarding wizard
  // (Don't redirect if we are already visiting the onboarding path)
  if (!onboardingComplete && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Signed in and onboarding finished, but trying to access onboarding -> send to dashboard
  if (onboardingComplete && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
