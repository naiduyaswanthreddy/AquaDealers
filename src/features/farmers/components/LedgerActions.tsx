import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, IndianRupee, Link2, MessageCircle, Phone, Plus, History, FileStack, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { useStaffStore } from '@/stores/staffStore';
import { getStaffFeatureMode } from '@/lib/staffAccess';
import { formatCurrency } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useFarmer } from '../hooks/useFarmerLedger';
import { useSetFarmerPreviousDue } from '../hooks/useFarmers';

interface LedgerActionsProps {
  farmerId: string;
  farmerPhone: string | null;
  farmerName: string;
  shareToken?: string | null;
  totalDue?: number;
  onCollect: () => void;
}

export const LedgerActions: React.FC<LedgerActionsProps> = ({
  farmerId,
  farmerPhone,
  farmerName,
  shareToken,
  totalDue = 0,
  onCollect,
}) => {
  const navigate = useNavigate();
  const dealer = useAuthStore((state) => state.user);
  const currentStaff = useStaffStore((s) => s.currentStaff);
  const canNewBill = getStaffFeatureMode('newBill', currentStaff?.permissions, !!currentStaff) === 'visible';
  const canAddHistory = getStaffFeatureMode('billHistory', currentStaff?.permissions, !!currentStaff) === 'visible';
  const [historyChoiceOpen, setHistoryChoiceOpen] = React.useState(false);
  const [openingBalanceOpen, setOpeningBalanceOpen] = React.useState(false);
  const [shareBalanceOpen, setShareBalanceOpen] = React.useState(false);
  const { data: farmer } = useFarmer(farmerId);
  const setPreviousDue = useSetFarmerPreviousDue();
  const updateFarmer = setPreviousDue;
  const [openingBalanceInput, setOpeningBalanceInput] = React.useState('');

  React.useEffect(() => {
    if (openingBalanceOpen) setOpeningBalanceInput(String(farmer?.opening_balance ?? ''));
  }, [openingBalanceOpen, farmer?.opening_balance]);

  const handleSavePreviousDue = () => {
    const value = Number(openingBalanceInput);
    if (!Number.isFinite(value) || value < 0) { toast.error('Enter a valid amount (0 or more)'); return; }
    setPreviousDue.mutate(
      { farmerId, previousDue: value },
      {
        onSuccess: () => { toast.success('Previous due updated'); setOpeningBalanceOpen(false); },
        onError: (e: any) => toast.error(e?.message || 'Failed to update previous due'),
      }
    );
  };
  const handleSaveOpeningBalance = handleSavePreviousDue;

  const handleWhatsApp = () => {
    if (!farmerPhone) return;
    const message = encodeURIComponent(`Hello ${farmerName}, this is from the shop.`);
    window.open(`https://wa.me/91${farmerPhone}?text=${message}`, '_blank');
  };

  const handleCall = () => {
    if (!farmerPhone) return;
    window.open(`tel:${farmerPhone}`, '_self');
  };

  const getShareLink = () => {
    if (!shareToken) {
      toast.error('Share link not ready yet. Try again in a moment.');
      return null;
    }

    return `${window.location.origin}/f/${shareToken}`;
  };

  const handleCopyShareLink = async () => {
    const link = getShareLink();
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      toast.success('Balance link copied');
      setShareBalanceOpen(false);
    } catch {
      toast.error('Could not copy the balance link');
    }
  };

  const handleShareBalanceViaWhatsApp = () => {
    const link = getShareLink();
    if (!link) return;

    const message = encodeURIComponent(
      `Namaste ${farmerName}! Your balance with ${dealer?.shop_name || 'our shop'} is ${formatCurrency(totalDue)}. ` +
      `View your full bill and payment statement anytime here: ${link}`
    );
    const normalizedPhone = farmerPhone?.replace(/\D/g, '').slice(-10);
    if (normalizedPhone) {
      window.open(`https://wa.me/91${normalizedPhone}?text=${message}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${message}`, '_blank');
    }
    setShareBalanceOpen(false);
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={onCollect}
          style={{ backgroundColor: '#e6f7ec' }}
          className="flex h-24 flex-col items-center justify-center gap-2 rounded-[22px] border border-emerald-200/60 text-emerald-900 shadow-[0_1px_2px_rgba(16,185,129,0.05)] transition-all active:scale-95 hover:brightness-[0.97]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
            <IndianRupee className="w-5 h-5" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider">Collect</span>
        </button>

        <button
          onClick={() => navigate(`/bills/new?farmer=${farmerId}`)}
          disabled={!canNewBill}
          style={{ backgroundColor: '#e6f3ff' }}
          className="flex h-24 flex-col items-center justify-center gap-2 rounded-[22px] border border-sky-200/60 text-sky-950 shadow-[0_1px_2px_rgba(14,165,233,0.05)] transition-all active:scale-95 hover:brightness-[0.97] disabled:opacity-40 disabled:pointer-events-none"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-white shadow-sm">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider">New Bill</span>
        </button>

        <button
          onClick={() => setHistoryChoiceOpen(true)}
          disabled={!canAddHistory}
          style={{ backgroundColor: '#fff3e6' }}
          className="flex h-24 flex-col items-center justify-center gap-2 rounded-[22px] border border-orange-200/60 text-orange-950 shadow-[0_1px_2px_rgba(249,115,22,0.05)] transition-all active:scale-95 hover:brightness-[0.97] disabled:opacity-40 disabled:pointer-events-none"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm">
            <History className="w-5 h-5" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-center leading-tight">Add History</span>
        </button>
      </div>

      <Modal isOpen={historyChoiceOpen} onClose={() => setHistoryChoiceOpen(false)} title="Add History">
        <div className="grid gap-3">
          <button
            onClick={() => { setHistoryChoiceOpen(false); navigate(`/bills/historical?farmer=${farmerId}`); }}
            className="flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-left transition-all active:scale-[0.98] hover:brightness-[0.97]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
              <FileStack className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-orange-950">Bulk Historical Bills</div>
              <div className="text-xs text-orange-900/70">Add old bills with item-level detail — bill number, date, items, prices.</div>
            </div>
          </button>

          <button
            onClick={() => { setHistoryChoiceOpen(false); setOpeningBalanceOpen(true); }}
            className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left transition-all active:scale-[0.98] hover:brightness-[0.97]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-emerald-950">Set Previous Due</div>
              <div className="text-xs text-emerald-900/70">Just enter the amount the farmer already owes from before. No items needed.</div>
            </div>
          </button>
        </div>
      </Modal>

      <Modal isOpen={shareBalanceOpen} onClose={() => setShareBalanceOpen(false)} title="Share Balance">
        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => { void handleCopyShareLink(); }}
            className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-left text-violet-950 transition-all active:scale-[0.98] hover:brightness-[0.97]"
          >
            <Copy className="h-5 w-5 shrink-0" />
            <span className="text-sm font-black">Copy link</span>
          </button>
          <button
            type="button"
            onClick={handleShareBalanceViaWhatsApp}
            className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left text-emerald-950 transition-all active:scale-[0.98] hover:brightness-[0.97]"
          >
            <MessageCircle className="h-5 w-5 shrink-0" />
            <span className="text-sm font-black">Send to farmer on WhatsApp</span>
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={openingBalanceOpen}
        onClose={() => setOpeningBalanceOpen(false)}
        title="Set Previous Due"
        footerButtons={[
          { label: 'Cancel', variant: 'ghost', onClick: () => setOpeningBalanceOpen(false), disabled: setPreviousDue.isPending },
          { label: updateFarmer.isPending ? 'Saving…' : 'Save', variant: 'primary', onClick: handleSaveOpeningBalance, loading: updateFarmer.isPending },
        ]}
      >
        <div className="grid gap-3">
          <p className="text-sm text-slate-600">
            Enter the amount <span className="font-semibold">{farmerName}</span> already owed before you started using this app. Correcting it adjusts their current due by the difference.
          </p>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={openingBalanceInput}
            onChange={(e) => setOpeningBalanceInput(e.target.value)}
            placeholder="0"
            autoFocus
          />
          {farmer?.opening_balance != null && Number(farmer.opening_balance) !== 0 && (
            <p className="text-xs text-slate-500">Current previous due: {formatCurrency(Number(farmer.opening_balance))}</p>
          )}
        </div>
      </Modal>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <button
          onClick={handleWhatsApp}
          disabled={!farmerPhone}
          style={{ backgroundColor: '#f0fcf4' }}
          className="flex h-14 items-center justify-center gap-2 rounded-[18px] border border-emerald-200/50 text-emerald-900 shadow-sm transition-all active:scale-95 disabled:opacity-50 hover:brightness-[0.97]"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
            <MessageCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-sm font-black">WhatsApp</span>
        </button>

        <button
          onClick={handleCall}
          disabled={!farmerPhone}
          style={{ backgroundColor: '#f0f8ff' }}
          className="flex h-14 items-center justify-center gap-2 rounded-[18px] border border-sky-200/50 text-sky-900 shadow-sm transition-all active:scale-95 disabled:opacity-50 hover:brightness-[0.97]"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
            <Phone className="w-4 h-4 text-sky-500" />
          </div>
          <span className="text-sm font-black">Call</span>
        </button>

        <button
          onClick={() => setShareBalanceOpen(true)}
          style={{ backgroundColor: '#f5f0ff' }}
          className="flex h-14 items-center justify-center gap-2 rounded-[18px] border border-violet-200/50 text-violet-900 shadow-sm transition-all active:scale-95 hover:brightness-[0.97]"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
            <Link2 className="w-4 h-4 text-violet-500" />
          </div>
          <span className="text-sm font-black leading-tight">Share Balance</span>
        </button>
      </div>
    </div>
  );
};

export default LedgerActions;
