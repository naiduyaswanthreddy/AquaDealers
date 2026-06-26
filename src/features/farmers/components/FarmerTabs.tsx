import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, FileText, Landmark, PackageSearch, UserRound } from 'lucide-react';

export type TabType = 'ledger' | 'items' | 'bills' | 'payments' | 'details';

interface FarmerTabsProps {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
}

export const FarmerTabs: React.FC<FarmerTabsProps> = ({ activeTab, onChange }) => {
  const { t } = useTranslation();
  
  const tabs: { id: TabType; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
    { id: 'ledger', label: t('farmers.tabs.ledger', 'Ledger'), icon: BookOpen },
    { id: 'items', label: t('farmers.tabs.items', 'Items'), icon: PackageSearch },
    { id: 'bills', label: t('farmers.tabs.bills', 'Bills'), icon: FileText },
    { id: 'payments', label: t('farmers.tabs.payments', 'Payments'), icon: Landmark },
    { id: 'details', label: t('farmers.tabs.details', 'Details'), icon: UserRound },
  ];

  return (
    <div className="mt-2 rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,#f8fbff_0%,#eef5fb_100%)] p-2 shadow-[0_14px_36px_rgba(148,163,184,0.16)]">
      <div className="grid grid-cols-5 gap-1 sm:gap-2">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-2 py-2.5 text-center transition-all ${
              isActive
                ? 'bg-primary text-white shadow-[0_14px_28px_rgba(20,103,159,0.28)] ring-1 ring-primary/20'
                : 'text-slate-500 hover:bg-white/70 hover:text-slate-700'
            }`}
          >
            <Icon
              className="h-4 w-4"
              style={{ color: isActive ? '#7dd3fc' : '#94a3b8', strokeWidth: 2.45 }}
            />
            <span className="truncate text-[0.72rem] font-black tracking-[0.02em]">{tab.label}</span>
          </button>
        );
      })}
      </div>
    </div>
  );
};

export default FarmerTabs;
