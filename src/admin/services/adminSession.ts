import { useAdminAuthStore } from '../stores/adminAuthStore';

export function getAdminIdOrThrow(): string {
  const adminId = useAdminAuthStore.getState().adminUser?.id;

  if (!adminId) {
    throw new Error('Admin session missing. Please sign in again.');
  }

  return adminId;
}
