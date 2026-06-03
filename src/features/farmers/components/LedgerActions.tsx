import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IndianRupee, MessageCircle, Phone, Plus, History } from 'lucide-react';

interface LedgerActionsProps {
  farmerId: string;
  farmerPhone: string | null;
  farmerName: string;
  onCollect: () => void;
}

export const LedgerActions: React.FC<LedgerActionsProps> = ({
  farmerId,
  farmerPhone,
  farmerName,
  onCollect,
}) => {
  const navigate = useNavigate();

  const handleWhatsApp = () => {
    if (!farmerPhone) return;
    const message = encodeURIComponent(`Hello ${farmerName}, this is from the shop.`);
    window.open(`https://wa.me/91${farmerPhone}?text=${message}`, '_blank');
  };

  const handleCall = () => {
    if (!farmerPhone) return;
    window.open(`tel:${farmerPhone}`, '_self');
  };

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={onCollect}
          className="flex h-24 flex-col items-center justify-center gap-2 rounded-[22px] border border-emerald-200 bg-[linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)] text-emerald-900 shadow-sm transition-all active:scale-95"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
            <IndianRupee className="w-5 h-5" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider">Collect</span>
        </button>

        <button
          onClick={() => navigate(`/bills/new?farmer=${farmerId}`)}
          className="flex h-24 flex-col items-center justify-center gap-2 rounded-[22px] border border-sky-200 bg-[linear-gradient(180deg,#eff6ff_0%,#dbeafe_100%)] text-sky-950 shadow-sm transition-all active:scale-95"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-white shadow-sm">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider">New Bill</span>
        </button>

        <button
          onClick={() => navigate(`/bills/historical?farmer=${farmerId}`)}
          className="flex h-24 flex-col items-center justify-center gap-2 rounded-[22px] border border-orange-200 bg-[linear-gradient(180deg,#fff7ed_0%,#ffedd5_100%)] text-orange-950 shadow-sm transition-all active:scale-95"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm">
            <History className="w-5 h-5" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-center leading-tight">Add History</span>
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          onClick={handleWhatsApp}
          disabled={!farmerPhone}
          className="flex h-14 items-center justify-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 text-slate-700 shadow-sm transition-all active:scale-95 disabled:opacity-50"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
            <MessageCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-sm font-black">WhatsApp</span>
        </button>

        <button
          onClick={handleCall}
          disabled={!farmerPhone}
          className="flex h-14 items-center justify-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 text-slate-700 shadow-sm transition-all active:scale-95 disabled:opacity-50"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
            <Phone className="w-4 h-4 text-sky-500" />
          </div>
          <span className="text-sm font-black">Call</span>
        </button>
      </div>
    </div>
  );
};

export default LedgerActions;
