import { useQuery } from '@tanstack/react-query';
import { adminMetricsService } from '../services/adminMetricsService';

export const adminMetricKeys = {
  all: ['admin-metrics'] as const,
  kpis: () => [...adminMetricKeys.all, 'kpis'] as const,
  expiring: (days: number) => [...adminMetricKeys.all, 'expiring', days] as const,
  activity: () => [...adminMetricKeys.all, 'activity'] as const,
  stuckOnboarding: () => [...adminMetricKeys.all, 'stuck-onboarding'] as const,
};

export function useAdminKPIs() {
  return useQuery({
    queryKey: adminMetricKeys.kpis(),
    queryFn: () => adminMetricsService.getPlatformKPIs(),
    refetchInterval: 5 * 60 * 1000, // auto-refresh every 5 minutes
    staleTime: 0, // Always fetch fresh data on mount
  });
}

export function useExpiringSubscriptions(days: number = 7) {
  return useQuery({
    queryKey: adminMetricKeys.expiring(days),
    queryFn: () => adminMetricsService.getExpiringSubscriptions(days),
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: adminMetricKeys.activity(),
    queryFn: () => adminMetricsService.getRecentActivity(),
    refetchInterval: 30 * 1000, // auto-refresh every 30 seconds
  });
}

export function useStuckOnboarding() {
  return useQuery({
    queryKey: adminMetricKeys.stuckOnboarding(),
    queryFn: () => adminMetricsService.getStuckOnboarding(),
  });
}
