import { create } from 'zustand';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { supabase } from '@/lib/supabase';
import { billingService } from '../services/billingService';
import type { BillingPayload, CreateBillResult } from '../types';
import type { SignatureStroke } from '@/types/database';

const OFFLINE_BILLS_KEY = 'offline_pending_bills_v1';
const PENDING_SIGS_KEY  = 'offline_pending_signatures_v1';

type PendingSig = {
  billId: string;
  dealerId: string;
  branchId: string | null;
  signerName: string | null;
  strokes: SignatureStroke[];
};

const readPendingSigs = (): Promise<PendingSig[]> =>
  idbGet<PendingSig[]>(PENDING_SIGS_KEY).then((v) => v || []);

const writePendingSigs = (sigs: PendingSig[]) => idbSet(PENDING_SIGS_KEY, sigs);

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
  `OFF-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

export const isNetworkError = (error: unknown): boolean => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /failed to fetch|network|load failed|fetch failed|timed? ?out|connection was lost|could not be found|cancelled|networkerror/i.test(message);
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
      // Flush signatures that failed on a previous sync attempt before touching bills.
      const pendingSigs = await readPendingSigs();
      const stillPending: PendingSig[] = [];
      for (const sig of pendingSigs) {
        try {
          await billingService.saveBillSignature({
            dealerId: sig.dealerId,
            branchId: sig.branchId,
            billId: sig.billId,
            signerName: sig.signerName,
            signatureData: sig.strokes,
          });
        } catch {
          stillPending.push(sig);
        }
      }
      if (stillPending.length !== pendingSigs.length) {
        await writePendingSigs(stillPending);
      }

      const bills = await readQueue();
      const newPendingSigs: PendingSig[] = [];

      type BillOutcome =
        | { ok: true; clientRef: string; billNumber: string; pendingSig: PendingSig | null }
        | { ok: false; clientRef: string; error: string; isNetwork: boolean };

      const outcomes = await Promise.allSettled<BillOutcome>(
        bills.map(async (bill): Promise<BillOutcome> => {
          const { data, error } = await supabase.rpc('create_bill_offline_sync', {
            p_payload: bill.payload,
            p_client_ref: bill.clientRef,
          });

          if (error) {
            return { ok: false, clientRef: bill.clientRef, error: error.message, isNetwork: isNetworkError(error) };
          }

          const result = data as CreateBillResult & { already_synced?: boolean };
          let pendingSig: PendingSig | null = null;

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
              console.error('Failed to sync offline bill signature, queuing for retry:', signatureError);
              pendingSig = {
                billId: result.bill_id,
                dealerId: bill.payload.dealer_id,
                branchId: bill.payload.branch_id ?? null,
                signerName: bill.signerName,
                strokes: bill.signatureStrokes!,
              };
            }
          }

          if (!result.already_synced) {
            supabase.functions.invoke('send-bill-whatsapp', { body: { billId: result.bill_id } }).catch(() => {});
          }

          return { ok: true, clientRef: bill.clientRef, billNumber: result.bill_number, pendingSig };
        })
      );

      const syncedRefs = new Set<string>();
      const failedRefs = new Map<string, string>();

      for (const outcome of outcomes) {
        const value = outcome.status === 'fulfilled' ? outcome.value : null;
        if (!value) continue;
        if (value.ok) {
          syncedRefs.add(value.clientRef);
          summary.synced += 1;
          summary.syncedNumbers.push(value.billNumber);
          if (value.pendingSig) newPendingSigs.push(value.pendingSig);
        } else {
          failedRefs.set(value.clientRef, value.error);
          summary.failed += 1;
        }
      }

      if (newPendingSigs.length) {
        const existing = await readPendingSigs();
        await writePendingSigs([...existing, ...newPendingSigs]);
      }

      const updatedBills = bills
        .filter((b) => !syncedRefs.has(b.clientRef))
        .map((b) => failedRefs.has(b.clientRef)
          ? { ...b, status: 'failed' as const, error: failedRefs.get(b.clientRef) }
          : b
        );

      await writeQueue(updatedBills);
      set({ bills: updatedBills });
      return summary;
    } finally {
      set({ isSyncing: false });
    }
  },
}));
