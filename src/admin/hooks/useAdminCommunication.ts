import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminCommunicationService } from '../services/adminCommunicationService';

export const adminCommKeys = {
  all: ['admin-comm'] as const,
  tickets: (status?: string) => [...adminCommKeys.all, 'tickets', status] as const,
  broadcasts: () => [...adminCommKeys.all, 'broadcasts'] as const,
};

// --- Support Tickets ---

export function useAdminTickets(status?: 'open' | 'resolved') {
  return useQuery({
    queryKey: adminCommKeys.tickets(status),
    queryFn: () => adminCommunicationService.getTickets(status),
  });
}

export function useResolveTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, reply, adminId }: { ticketId: string; reply: string; adminId: string }) =>
      adminCommunicationService.resolveTicket(ticketId, reply, adminId),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminCommKeys.all }),
  });
}

// --- Broadcast Messages ---

export function useAdminBroadcasts() {
  return useQuery({
    queryKey: adminCommKeys.broadcasts(),
    queryFn: () => adminCommunicationService.getBroadcasts(),
  });
}

export function useSendBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminCommunicationService.sendBroadcast,
    onSuccess: () => qc.invalidateQueries({ queryKey: adminCommKeys.all }),
  });
}
