import { supabase } from '@/lib/supabase';
import { AdminUser } from '../types';
import { getAdminIdOrThrow } from './adminSession';

/**
 * Admin Authentication Service
 * In production, this would call Edge Functions with a custom JWT system.
 * For local dev, we query admin_users directly via the Supabase client.
 */
export const adminAuthService = {
  async login(email: string, password: string): Promise<AdminUser> {
    const normalizedEmail = email.trim().toLowerCase();

    // Use RPC so password verification happens server-side and RLS on admin_users remains locked down.
    const { data, error } = await supabase
      .rpc('admin_login', {
        p_email: normalizedEmail,
        p_password: password,
      })
      .maybeSingle();

    if (error) {
      if (
        error.message.includes('Could not find the function') ||
        error.message.includes('admin_login')
      ) {
        throw new Error('Admin database setup is incomplete. Run the updated 004 admin migration first.');
      }

      throw new Error(error.message);
    }

    if (!data) {
      throw new Error('Invalid email or password');
    }

    return data as AdminUser;
  },

  async getCurrentAdmin(adminId: string): Promise<AdminUser | null> {
    const { data, error } = await supabase
      .rpc('admin_get_current_user', {
        p_admin_id: adminId,
      })
      .maybeSingle();

    if (error) return null;
    return data as AdminUser;
  },

  async getAdminUsers(): Promise<AdminUser[]> {
    const { data, error } = await supabase
      .rpc('admin_list_users', {
        p_admin_id: getAdminIdOrThrow(),
      });

    if (error) throw error;
    return (data || []) as AdminUser[];
  },
};
