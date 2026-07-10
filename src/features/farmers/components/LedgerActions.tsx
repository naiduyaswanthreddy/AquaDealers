import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IndianRupee, Link2, MessageCircle, Phone, Plus, History } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency } from '@/lib/utils';

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

  const handleWhatsApp = () => {
    if (!farmerPhone) return;
    const message = encodeURIComponent(`Hello ${farmerName}, this is from the shop.`);
    window.open(`https://wa.me/91${farmerPhone}?text=${message}`, '_blank');
  };

  const handleCall = () => {
    if (!farmerPhone) return;
    window.open(`tel:${farmerPhone}`, '_self');
  };

  const handleShareBalance = () => {
    if (!shareToken) {
      toast.error('Balance link is not ready for this farmer yet.');
      return;
    }
    const link = `${window.location.origin}/f/${shareToken}`;
    const message = encodeURIComponent(
      `Namaste ${farmerName}! Your balance with ${dealer?.shop_name || 'our shop'} is ${formatCurrency(totalDue)}. ` +
      `View your full bill and payment statement anytime here: ${link}`
    );
    if (farmerPhone) {
      window.open(`https://wa.me/91${farmerPhone}?text=${message}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${message}`, '_blank');
    }
  };

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
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
          style={{ backgroundColor: '#e6f3ff' }}
          className="flex h-24 flex-col items-center justify-center gap-2 rounded-[22px] border border-sky-200/60 text-sky-950 shadow-[0_1px_2px_rgba(14,165,233,0.05)] transition-all active:scale-95 hover:brightness-[0.97]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-white shadow-sm">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider">New Bill</span>
        </button>

        <button
          onClick={() => navigate(`/bills/historical?farmer=${farmerId}`)}
          style={{ backgroundColor: '#fff3e6' }}
          className="flex h-24 flex-col items-center justify-center gap-2 rounded-[22px] border border-orange-200/60 text-orange-950 shadow-[0_1px_2px_rgba(249,115,22,0.05)] transition-all active:scale-95 hover:brightness-[0.97]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm">
            <History className="w-5 h-5" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-center leading-tight">Add History</span>
        </button>
      </div>

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
          onClick={handleShareBalance}
          disabled={!shareToken}
          style={{ backgroundColor: '#f5f0ff' }}
          className="flex h-14 items-center justify-center gap-2 rounded-[18px] border border-violet-200/50 text-violet-900 shadow-sm transition-all active:scale-95 disabled:opacity-50 hover:brightness-[0.97]"
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
