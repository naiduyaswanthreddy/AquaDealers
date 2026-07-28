import { supabase } from '@/lib/supabase';
import type { TransactionFilters, TransactionPageResult } from '../types';

export async function getTransactionEvents(filters: TransactionFilters = {}): Promise<TransactionPageResult> {
  const { data, error } = await supabase.rpc('get_transaction_events_v1', {
    p_branch_id: filters.branchId?.trim() || null,
    p_start_date: filters.startDate?.trim() || null,
    p_end_date: filters.endDate?.trim() || null,
    p_type: filters.type || null,
    p_status: filters.status || null,
    p_search: filters.search?.trim() || null,
    p_limit: filters.limit ?? 50,
    p_offset: filters.offset ?? 0,
    p_staff_id: filters.staffId ?? null,
  });
  if (error) throw error;
  return (data ?? { data: [], total: 0 }) as TransactionPageResult;
}

export async function undoTransaction(eventId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('undo_transaction_v1', {
    p_event_id: eventId,
    p_reason: reason.trim(),
  });
  if (error) throw error;
}
