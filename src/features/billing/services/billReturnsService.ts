import { supabase } from '@/lib/supabase';

export interface BillReturnItemInput {
  bill_item_id: string;
  quantity: number;
  unit_price?: number;
}

export interface CreateBillReturnResult {
  return_id: string;
  return_number: string;
  total: number;
  new_bill_balance: number;
  new_farmer_due: number | null;
}

export interface BillReturnItem {
  id: string;
  product_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface BillReturn {
  id: string;
  return_number: string | null;
  return_date: string;
  total_amount: number;
  notes: string | null;
  branch_name: string | null;
  created_at: string;
  items: BillReturnItem[];
}

export interface FarmerReturnItemInput {
  product_id: string;
  quantity: number;
  unmatched_unit_price: number;
}

export interface FarmerReturnAllocation {
  bill_id: string;
  bill_item_id: string;
  bill_number: string;
  bill_date: string;
  branch_name: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  balance_before: number;
  balance_reduction: number;
  balance_after: number;
  settlement_amount: number;
}

export interface FarmerReturnPreviewLine {
  product_id: string;
  product_name: string;
  quantity: number;
  matched_quantity: number;
  unmatched_quantity: number;
  unmatched_unit_price: number;
  total_amount: number;
  allocations: FarmerReturnAllocation[];
}

export interface FarmerReturnPreview {
  farmer_id: string;
  farmer_name: string;
  start_date: string;
  end_date: string;
  lines: FarmerReturnPreviewLine[];
  total_amount: number;
  unmatched_total: number;
  bill_balance_reduction: number;
  opening_balance_before: number;
  opening_balance_reduction: number;
  opening_balance_after: number;
  settlement_amount: number;
  farmer_due_before: number;
  farmer_due_after_cash_refund: number;
  farmer_due_after_credit: number;
}

export interface FarmerReturnDetail {
  id: string;
  eventId: string | null;
  farmerId: string;
  farmerName: string;
  branchId: string;
  returnNumber: string | null;
  returnDate: string;
  startDate: string;
  endDate: string;
  notes: string | null;
  settlementMethod: 'farmer_credit' | 'cash_refund';
  totalAmount: number;
  items: Array<FarmerReturnItemInput & { name: string }>;
}

export async function previewFarmerReturn(params: {
  farmerId: string;
  startDate: string;
  endDate: string;
  items: FarmerReturnItemInput[];
}): Promise<FarmerReturnPreview> {
  const { data, error } = await supabase.rpc('preview_farmer_return_v1', {
    p_farmer_id: params.farmerId,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_items: params.items,
  });
  if (error) throw error;
  return data as FarmerReturnPreview;
}

export async function createFarmerReturn(params: {
  farmerId: string;
  branchId: string;
  startDate: string;
  endDate: string;
  returnDate: string;
  notes?: string;
  settlementMethod: 'farmer_credit' | 'cash_refund';
  items: FarmerReturnItemInput[];
  expectedPreview: FarmerReturnPreview;
}): Promise<{ return_id: string; return_number: string; preview: FarmerReturnPreview }> {
  const { data, error } = await supabase.rpc('create_farmer_return_v1', {
    p_payload: {
      farmer_id: params.farmerId,
      branch_id: params.branchId,
      start_date: params.startDate,
      end_date: params.endDate,
      return_date: params.returnDate,
      notes: params.notes || null,
      settlement_method: params.settlementMethod,
      items: params.items,
      expected_preview: params.expectedPreview,
    },
  });
  if (error) throw error;
  return data as { return_id: string; return_number: string; preview: FarmerReturnPreview };
}

export async function replaceFarmerReturn(params: {
  eventId: string;
  farmerId: string;
  branchId: string;
  startDate: string;
  endDate: string;
  returnDate: string;
  notes?: string;
  settlementMethod: 'farmer_credit' | 'cash_refund';
  items: FarmerReturnItemInput[];
  expectedPreview: FarmerReturnPreview;
}): Promise<{ return_id: string; return_number: string; preview: FarmerReturnPreview }> {
  const { data, error } = await supabase.rpc('replace_farmer_return_v1', {
    p_event_id: params.eventId,
    p_payload: {
      farmer_id: params.farmerId,
      branch_id: params.branchId,
      start_date: params.startDate,
      end_date: params.endDate,
      return_date: params.returnDate,
      notes: params.notes || null,
      settlement_method: params.settlementMethod,
      items: params.items,
      expected_preview: params.expectedPreview,
    },
  });
  if (error) throw error;
  return data as { return_id: string; return_number: string; preview: FarmerReturnPreview };
}

export async function getFarmerReturnDetail(returnId: string): Promise<FarmerReturnDetail> {
  const [{ data: returnRow, error: returnError }, { data: lines, error: linesError }, { data: event, error: eventError }] = await Promise.all([
    supabase.from('bill_returns').select('id, farmer_id, branch_id, return_number, return_date, source_bill_start_date, source_bill_end_date, notes, settlement_method, total_amount, farmers(name)').eq('id', returnId).single(),
    supabase.from('farmer_return_lines').select('product_id, product_name_snapshot, quantity, unmatched_unit_price').eq('return_id', returnId).order('created_at'),
    supabase.from('transaction_events').select('id').eq('source_type', 'bill_return').eq('source_id', returnId).eq('status', 'active').maybeSingle(),
  ]);
  if (returnError) throw returnError;
  if (linesError) throw linesError;
  if (eventError) throw eventError;

  return {
    id: returnRow.id,
    eventId: event?.id ?? null,
    farmerId: returnRow.farmer_id,
    farmerName: (returnRow.farmers as unknown as { name?: string } | null)?.name || 'Farmer',
    branchId: returnRow.branch_id,
    returnNumber: returnRow.return_number,
    returnDate: returnRow.return_date,
    startDate: returnRow.source_bill_start_date,
    endDate: returnRow.source_bill_end_date,
    notes: returnRow.notes,
    settlementMethod: returnRow.settlement_method === 'cash_refund' ? 'cash_refund' : 'farmer_credit',
    totalAmount: Number(returnRow.total_amount || 0),
    items: (lines || []).map((line) => ({
      product_id: line.product_id,
      name: line.product_name_snapshot || 'Product',
      quantity: Number(line.quantity || 0),
      unmatched_unit_price: Number(line.unmatched_unit_price || 0),
    })),
  };
}

export async function createBillReturn(params: {
  billId: string;
  returnDate?: string; // YYYY-MM-DD
  notes?: string;
  items: BillReturnItemInput[];
}): Promise<CreateBillReturnResult> {
  const { data, error } = await supabase.rpc('create_bill_return', {
    p_bill_id: params.billId,
    p_return_date: params.returnDate ?? null,
    p_notes: params.notes ?? null,
    p_items: params.items,
  });
  if (error) throw error;
  return data as CreateBillReturnResult;
}

export async function getReturnsForBill(billId: string): Promise<BillReturn[]> {
  const { data, error } = await supabase.rpc('get_returns_for_bill', { p_bill_id: billId });
  if (error) throw error;
  return (data ?? []) as BillReturn[];
}
