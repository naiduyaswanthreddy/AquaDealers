export type TransactionType =
  | 'bill'
  | 'farmer_payment'
  | 'stock_purchase'
  | 'supplier_payment'
  | 'bill_return'
  | 'stock_transfer'
  | 'expense'
  | 'cash_entry';

export type TransactionStatus = 'active' | 'read_only' | 'undone';

export interface TransactionEvent {
  id: string;
  dealer_id: string;
  branch_id: string | null;
  branch_name: string | null;
  source_type: TransactionType;
  source_id: string;
  reference: string | null;
  party_name: string | null;
  amount: number | null;
  quantity: number | null;
  details: Record<string, unknown>;
  created_at: string;
  undo_expires_at: string | null;
  status: TransactionStatus;
  undo_reason: string | null;
  can_undo: boolean;
  undo_state: string;
}

export interface TransactionFilters {
  branchId?: string | null;
  startDate?: string;
  endDate?: string;
  type?: string;
  status?: string;
  search?: string;
  staffId?: string | null;
  limit?: number;
  offset?: number;
}

export interface TransactionPageResult {
  data: TransactionEvent[];
  total: number;
}
