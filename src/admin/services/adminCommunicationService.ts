import { supabase } from '@/lib/supabase';
import { SupportTicket, BroadcastMessage } from '../types';
import { getAdminIdOrThrow } from './adminSession';

export const adminCommunicationService = {
  // --- Support Tickets ---

  async getTickets(status?: 'open' | 'resolved'): Promise<SupportTicket[]> {
    const { data, error } = await supabase.rpc('admin_get_tickets', {
      p_admin_id: getAdminIdOrThrow(),
      p_status: status || null,
    });

    if (error) throw error;
    return (data || []) as SupportTicket[];
  },

  async resolveTicket(ticketId: string, reply: string, adminId: string): Promise<void> {
    const { error } = await supabase.rpc('admin_resolve_ticket', {
      p_admin_id: adminId,
      p_ticket_id: ticketId,
      p_reply: reply,
    });

    if (error) throw error;
  },

  // --- Broadcast Messages ---

  async getBroadcasts(): Promise<BroadcastMessage[]> {
    const { data, error } = await supabase
      .rpc('admin_get_broadcasts', {
        p_admin_id: getAdminIdOrThrow(),
      });

    if (error) throw error;
    return (data || []) as BroadcastMessage[];
  },

  async sendBroadcast(params: {
    title?: string;
    message: string;
    targetSegment: 'all' | 'trial' | 'basic' | 'pro' | 'expiring_7days' | 'inactive_30days' | 'onboarding_stuck';
    channel: 'in_app' | 'whatsapp' | 'both';
    adminId: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('admin_send_broadcast', {
      p_admin_id: params.adminId,
      p_payload: {
        title: params.title || params.message.slice(0, 60),
        message: params.message,
        targetSegment: params.targetSegment,
        channel: params.channel,
      },
    });

    if (error) throw error;
  },
};
