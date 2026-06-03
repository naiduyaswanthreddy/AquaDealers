import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export const adminImpersonationService = {
  async initiateImpersonation(adminId: string, adminName: string, dealerId: string, reason: string): Promise<void> {
    // 1. Log the impersonation event in the audit log
    const { error: auditError } = await supabase.rpc('admin_record_audit_event', {
      p_admin_id: adminId,
      p_action: 'impersonate_dealer',
      p_target_type: 'dealer',
      p_target_id: dealerId,
      p_target_name: null,
      p_details: { reason },
    });
    if (auditError) throw auditError;

    // 2. Fetch the dealer to impersonate
    const { data: dealer, error } = await supabase
      .rpc('admin_get_dealer_profile', {
        p_admin_id: adminId,
        p_dealer_id: dealerId,
      });

    if (error || !dealer) throw new Error('Dealer not found');

    // 3. Inject the impersonation session into the main app's auth store
    // In a real app with real JWTs, we would issue a short-lived token with a custom claim.
    useAuthStore.getState().setSession({
      user: {
        id: dealer.id,
        phone: dealer.phone,
        user_metadata: { name: dealer.name },
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
      access_token: 'impersonation_token',
      refresh_token: 'impersonation_token',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
    });

    useAuthStore.getState().setImpersonator(adminName);
  },
};
