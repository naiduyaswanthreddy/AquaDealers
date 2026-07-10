import React, { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { Modal, Button, Input, Textarea } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useUpdateFarmer } from '../hooks/useFarmers';
import type { Farmer } from '@/types/database';

interface FollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmer: Farmer;
}

/**
 * Collection follow-up editor: promised-to-pay date, promised amount, and a
 * note. Powers the "Follow-ups due today" list on the Dues page.
 */
export const FollowUpModal: React.FC<FollowUpModalProps> = ({ isOpen, onClose, farmer }) => {
  const { mutateAsync: updateFarmer, isPending } = useUpdateFarmer();
  const [followUpDate, setFollowUpDate] = useState('');
  const [promisedAmount, setPromisedAmount] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFollowUpDate(farmer.follow_up_date || '');
      setPromisedAmount(
        farmer.promised_amount !== null && farmer.promised_amount !== undefined
          ? String(farmer.promised_amount)
          : ''
      );
      setNote(farmer.follow_up_note || '');
    }
  }, [isOpen, farmer]);

  const handleSave = async () => {
    if (!followUpDate) {
      toast.error('Pick a follow-up date.');
      return;
    }
    try {
      await updateFarmer({
        farmerId: farmer.id,
        data: {
          follow_up_date: followUpDate,
          follow_up_note: note.trim() || null,
          promised_amount: promisedAmount ? Number(promisedAmount) : null,
        },
      });
      toast.success('Follow-up saved.');
      onClose();
    } catch {
      // useUpdateFarmer already toasts errors
    }
  };

  const handleClear = async () => {
    try {
      await updateFarmer({
        farmerId: farmer.id,
        data: { follow_up_date: null, follow_up_note: null, promised_amount: null },
      });
      toast.success('Follow-up cleared.');
      onClose();
    } catch {
      // useUpdateFarmer already toasts errors
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Collection Follow-up">
      <div className="space-y-4 p-1">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-black text-slate-900">{farmer.name}</div>
            <div className="text-xs font-semibold text-rose-500">
              Due {formatCurrency(farmer.total_due)}
            </div>
          </div>
        </div>

        <Input
          label="Promised to pay on"
          type="date"
          value={followUpDate}
          onChange={(e) => setFollowUpDate(e.target.value)}
        />

        <Input
          label="Promised amount (optional)"
          type="number"
          inputMode="decimal"
          min={0}
          placeholder="e.g. 25000"
          value={promisedAmount}
          onChange={(e) => setPromisedAmount(e.target.value)}
        />

        <Textarea
          label="Note (optional)"
          placeholder="e.g. Will pay after harvest on the 15th"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="flex items-center justify-between gap-3 pt-1">
          {farmer.follow_up_date ? (
            <Button variant="outline" onClick={handleClear} disabled={isPending}>
              Clear
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={isPending}>
              Save Follow-up
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default FollowUpModal;
