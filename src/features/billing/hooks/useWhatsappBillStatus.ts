import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { billingKeys } from './useBilling';
import { Bill } from '@/types/database';

export type WhatsappShareState =
  | { kind: 'off' } // addon disabled, or bill has no recorded attempt (estimate/walk-in/pre-feature bill) — show the manual share button
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'failed'; reason: Bill['whatsapp_status_reason'] };

// One delayed refetch to catch the fire-and-forget send from checkout (it
// hasn't necessarily landed by the time this page/modal renders), plus the
// retry action — shared by BillDetailsPage and CheckoutSuccessModal instead
// of duplicating the same race-closing logic in both.
export function useWhatsappBillStatus(bill: Bill | undefined, addonOn: boolean): {
  state: WhatsappShareState;
  isRetrying: boolean;
  retry: () => Promise<void>;
} {
  const queryClient = useQueryClient();
  const [isRetrying, setIsRetrying] = useState(false);
  // Distinguishes "a send is genuinely in flight" from "this bill never had
  // one fired for it" (an old bill from before the addon was on, or before
  // this feature existed) — without it, such a bill's permanently-null
  // status would show "Sending…" forever instead of falling back to the
  // manual share button.
  const [hasWaited, setHasWaited] = useState(false);

  const applies = addonOn && !!bill && !bill.is_estimate && !!bill.farmer_id;

  useEffect(() => {
    setHasWaited(false);
  }, [bill?.id]);

  useEffect(() => {
    if (!applies || !bill || bill.whatsapp_status) return;
    const timer = setTimeout(() => {
      queryClient.refetchQueries({ queryKey: billingKeys.detail(bill.id) }).finally(() => setHasWaited(true));
    }, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applies, bill?.id, bill?.whatsapp_status]);

  const retry = async () => {
    if (!bill) return;
    setIsRetrying(true);
    try {
      await supabase.functions.invoke('send-bill-whatsapp', { body: { billId: bill.id } });
      await queryClient.invalidateQueries({ queryKey: billingKeys.detail(bill.id) });
    } finally {
      setIsRetrying(false);
    }
  };

  const state: WhatsappShareState = !applies
    ? { kind: 'off' }
    : bill!.whatsapp_status === 'sent'
      ? { kind: 'sent' }
      : bill!.whatsapp_status === 'failed'
        ? { kind: 'failed', reason: bill!.whatsapp_status_reason }
        : hasWaited
          ? { kind: 'off' }
          : { kind: 'sending' };

  return { state, isRetrying, retry };
}
