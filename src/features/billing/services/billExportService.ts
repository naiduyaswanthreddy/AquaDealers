import { supabase } from '@/lib/supabase';

export interface BillExportRow {
  bill_number: string;
  bill_date: string;
  farmer_name_snapshot: string | null;
  total: number;
  subtotal: number;
  discount_amount: number;
  gst_amount: number;
  amount_paid: number;
  balance_due: number;
  payment_type: string | null;
  type: string;
  created_at: string;
}

export interface BillExportOptions {
  dealerId: string;
  branchId?: string | null;
  startDate?: string;
  endDate?: string;
  paymentStatus?: 'all' | 'paid' | 'unpaid';
  search?: string;
}

/**
 * Exports ALL bills matching the filter in 500-row chunks via the
 * export_bills_chunk RPC. This avoids loading 10,000+ rows into
 * browser memory at once and prevents request timeouts.
 *
 * Usage:
 *   const rows = await exportAllBills(options, (pct) => setProgress(pct));
 */
export async function exportAllBills(
  options: BillExportOptions,
  onProgress?: (pct: number) => void
): Promise<BillExportRow[]> {
  const CHUNK_SIZE = 500;
  let offset = 0;
  let total = Infinity;
  const allRows: BillExportRow[] = [];

  while (offset < total) {
    const { data, error } = await supabase.rpc('export_bills_chunk', {
      p_dealer_id: options.dealerId,
      p_branch_id: options.branchId ?? null,
      p_start_date: options.startDate ?? null,
      p_end_date: options.endDate ?? null,
      p_payment_status: options.paymentStatus ?? 'all',
      p_search: options.search ?? null,
      p_limit: CHUNK_SIZE,
      p_offset: offset,
    });

    if (error) throw error;

    const result = data as { total: number; data: BillExportRow[] };
    total = result.total;
    const chunk = result.data ?? [];
    allRows.push(...chunk);
    offset += CHUNK_SIZE;

    onProgress?.(Math.min(100, Math.round((allRows.length / total) * 100)));

    // Safety: stop if we get an empty chunk (shouldn't happen but avoids infinite loops)
    if (chunk.length === 0) break;
  }

  return allRows;
}

/**
 * Converts an array of BillExportRow objects to a CSV string.
 */
export function billsToCsv(rows: BillExportRow[]): string {
  const headers = [
    'Bill Number',
    'Bill Date',
    'Customer Name',
    'Subtotal (₹)',
    'Discount (₹)',
    'GST (₹)',
    'Total (₹)',
    'Amount Paid (₹)',
    'Balance Due (₹)',
    'Payment Type',
    'Type',
    'Created At',
  ];

  const escape = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    // Wrap in quotes if contains comma, newline, or quote; escape internal quotes
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        escape(r.bill_number),
        escape(r.bill_date),
        escape(r.farmer_name_snapshot ?? 'Walk-in Customer'),
        escape(Number(r.subtotal).toFixed(2)),
        escape(Number(r.discount_amount).toFixed(2)),
        escape(Number(r.gst_amount).toFixed(2)),
        escape(Number(r.total).toFixed(2)),
        escape(Number(r.amount_paid).toFixed(2)),
        escape(Number(r.balance_due).toFixed(2)),
        escape(r.payment_type ?? ''),
        escape(r.type),
        escape(new Date(r.created_at).toLocaleString('en-IN')),
      ].join(',')
    ),
  ];

  return lines.join('\n');
}

/**
 * Triggers a browser download of the CSV file.
 */
export function downloadCsv(csvContent: string, filename: string): void {
  // Add BOM for Excel UTF-8 compatibility
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
