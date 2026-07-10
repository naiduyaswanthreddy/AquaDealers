import { create } from 'zustand';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { supabase } from '@/lib/supabase';
import { billingService } from '../services/billingService';
import type { BillingPayload, CreateBillResult } from '../types';
import type { SignatureStroke } from '@/types/database';

const OFFLINE_BILLS_KEY = 'offline_pending_bills_v1';

export interface OfflineBill {
  clientRef: string;
  tempBillNumber: string;
  payload: BillingPayload;
  signatureStrokes: SignatureStroke[] | null;
  signerName: string | null;
  farmerName: string | null;
  total: number;
  amountPaid: number;
  balanceDue: number;
  createdAt: string;
  status: 'pending' | 'failed';
  error?: string | null;
}

export interface OfflineSyncSummary {
  synced: number;
  failed: number;
  syncedNumbers: string[];
}

export const generateTempBillNumber = () =>
  `OFF-${Date.now().toString(36).toUpperCase().slice(-6)}`;

export const isNetworkError = (error: unknown): boolean => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /failed to fetch|network|load failed|fetch failed|timed? ?out/i.test(message);
};

const readQueue = async (): Promise<OfflineBill[]> =>
  (await idbGet<OfflineBill[]>(OFFLINE_BILLS_KEY)) || [];

const writeQueue = async (bills: OfflineBill[]) => {
  await idbSet(OFFLINE_BILLS_KEY, bills);
};

interface OfflineBillState {
  bills: OfflineBill[];
  isLoaded: boolean;
  isSyncing: boolean;
  load: () => Promise<void>;
  queueBill: (bill: Omit<OfflineBill, 'status' | 'createdAt'>) => Promise<void>;
  discardBill: (clientRef: string) => Promise<void>;
  syncAll: () => Promise<OfflineSyncSummary>;
}

export const useOfflineBillStore = create<OfflineBillState>((set, get) => ({
  bills: [],
  isLoaded: false,
  isSyncing: false,

  load: async () => {
    const bills = await readQueue();
    set({ bills, isLoaded: true });
  },

  queueBill: async (bill) => {
    const record: OfflineBill = {
      ...bill,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const bills = [...(await readQueue()), record];
    await writeQueue(bills);
    set({ bills });
  },

  discardBill: async (clientRef) => {
    const bills = (await readQueue()).filter((b) => b.clientRef !== clientRef);
    await writeQueue(bills);
    set({ bills });
  },

  syncAll: async () => {
    const summary: OfflineSyncSummary = { synced: 0, failed: 0, syncedNumbers: [] };
    if (get().isSyncing || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return summary;
    }

    set({ isSyncing: true });
    try {
      let bills = await readQueue();

      for (const bill of bills) {
        const { data, error } = await supabase.rpc('create_bill_offline_sync', {
          p_payload: bill.payload,
          p_client_ref: bill.clientRef,
        });

        if (error) {
          if (isNetworkError(error)) {
            // Still offline / flaky — leave the whole queue for the next attempt.
            break;
          }
          bills = bills.map((b) =>
            b.clientRef === bill.clientRef
              ? { ...b, status: 'failed' as const, error: error.message }
              : b
          );
          summary.failed += 1;
          continue;
        }

        const result = data as CreateBillResult & { already_synced?: boolean };

        if (bill.signatureStrokes?.length) {
          try {
            await billingService.saveBillSignature({
              dealerId: bill.payload.dealer_id,
              branchId: bill.payload.branch_id ?? null,
              billId: result.bill_id,
              signerName: bill.signerName,
              signatureData: bill.signatureStrokes,
            });
          } catch (signatureError) {
            console.error('Failed to sync offline bill signature:', signatureError);
          }
        }

        bills = bills.filter((b) => b.clientRef !== bill.clientRef);
        summary.synced += 1;
        summary.syncedNumbers.push(result.bill_number);
      }

      await writeQueue(bills);
      set({ bills });
      return summary;
    } finally {
      set({ isSyncing: false });
    }
  },
}));
