import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminSettingsService } from '../services/adminSettingsService';

export const adminSettingsKeys = {
  all: ['admin-settings'] as const,
  plans: () => [...adminSettingsKeys.all, 'plans'] as const,
  audit: () => [...adminSettingsKeys.all, 'audit'] as const,
};

export function useAdminPlans() {
  return useQuery({
    queryKey: adminSettingsKeys.plans(),
    queryFn: () => adminSettingsService.getPlanDefinitions(),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      adminSettingsService.updatePlanDefinition(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminSettingsKeys.plans() }),
  });
}

export function useAdminAuditLogs(limit?: number) {
  return useQuery({
    queryKey: adminSettingsKeys.audit(),
    queryFn: () => adminSettingsService.getAuditLogs(limit),
  });
}


