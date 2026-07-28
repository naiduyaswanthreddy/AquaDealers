import { supabase } from '@/lib/supabase';

export interface StockTransferItemInput {
  product_id: string;
  quantity: number;
}

export interface CreateStockTransferResult {
  transfer_id: string;
  transfer_number: string;
  total_quantity: number;
}

export interface StockTransferListRow {
  id: string;
  transfer_number: string | null;
  transfer_date: string;
  from_branch_id: string;
  to_branch_id: string;
  from_branch_name: string | null;
  to_branch_name: string | null;
  total_quantity: number;
  notes: string | null;
  created_at: string;
}

export interface StockTransferDetailItem {
  id: string;
  product_id: string | null;
  product_name_snapshot: string | null;
  quantity: number;
  cost_price: number | null;
  from_lot_id: string | null;
  to_lot_id: string | null;
  created_at: string;
}

export interface StockTransferDetail extends StockTransferListRow {
  items: StockTransferDetailItem[];
}

export async function createStockTransfer(params: {
  fromBranchId: string;
  toBranchId: string;
  transferDate?: string;
  notes?: string;
  items: StockTransferItemInput[];
}): Promise<CreateStockTransferResult> {
  const { data, error } = await supabase.rpc('create_stock_transfer', {
    p_from_branch_id: params.fromBranchId,
    p_to_branch_id: params.toBranchId,
    p_transfer_date: params.transferDate ?? null,
    p_notes: params.notes ?? null,
    p_items: params.items,
  });
  if (error) throw error;
  return data as CreateStockTransferResult;
}

export async function listStockTransfers(params: {
  branchId?: string | null;
  limit?: number;
  offset?: number;
} = {}): Promise<{ total: number; data: StockTransferListRow[] }> {
  const { data, error } = await supabase.rpc('list_stock_transfers', {
    p_branch_id: params.branchId ?? null,
    p_limit: params.limit ?? 50,
    p_offset: params.offset ?? 0,
  });
  if (error) throw error;
  return data as { total: number; data: StockTransferListRow[] };
}

export async function getStockTransfer(id: string): Promise<StockTransferDetail | null> {
  const { data, error } = await supabase.rpc('get_stock_transfer', { p_transfer_id: id });
  if (error) throw error;
  return data as StockTransferDetail | null;
}
