import React, { useMemo, useState } from 'react';
import { Check, User, Users, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SearchBar, FarmerAvatar, Button } from '@/components/ui';
import { useFarmers } from '@/features/farmers/hooks/useFarmers';
import { useCartStore } from '../stores/cartStore';
import { cn, formatCurrency } from '@/lib/utils';
import { QuickAddFarmerModal } from './QuickAddFarmerModal';
import { QuickAddWalkInModal } from './QuickAddWalkInModal';
import { CROP_STATUSES } from '@/lib/constants';

export const FarmerSelector: React.FC<{ onSelect?: () => void }> = ({ onSelect }) => {
  const { t } = useTranslation();
  const { data: farmers = [], isLoading } = useFarmers();
  const { farmerId, setFarmer } = useCartStore();
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);

  const filteredFarmers = useMemo(
    () =>
      farmers.filter((farmer) => {
        const query = search.toLowerCase();
        const cleanQuery = query.replace(/[^0-9]/g, '');
        const cleanPhone = farmer.phone ? farmer.phone.replace(/[^0-9]/g, '') : '';
        const matchesPhone = cleanQuery && cleanPhone.includes(cleanQuery);

        return (
          farmer.name.toLowerCase().includes(query) ||
          farmer.phone?.includes(search) ||
          matchesPhone ||
          farmer.village?.toLowerCase().includes(query)
        );
      }),
    [farmers, search]
  );

  return (
    <div className="space-y-3 rounded-[22px] bg-slate-50/80 p-2">
      <SearchBar value={search} onChange={setSearch} placeholder={t('billing.searchCustomer', 'Search customer')} showVoicePlaceholder />

      <div className="grid gap-2.5 grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setIsWalkInModalOpen(true);
          }}
          className={cn(
            'focus-ring rounded-2xl border p-3 text-left shadow-sm transition-all duration-200',
            farmerId === null
              ? 'border-primary bg-white ring-2 ring-primary/15'
              : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50 active:scale-[0.985]'
          )}
        >
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-500">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-800">Walk-in Customer</h3>
                {farmerId === null ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs font-medium text-slate-400 leading-snug">{t('billing.walkInHint', 'Use this for instant cash or UPI sales.')}</p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="focus-ring rounded-2xl border border-dashed border-slate-300 bg-white hover:border-primary/50 hover:bg-sky-50/10 p-3 text-left shadow-sm transition-all duration-200 active:scale-[0.985]"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-sky-50 p-3 text-primary">
              <UserPlus className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-800">Add New Farmer</h3>
              </div>
              <p className="mt-1 text-xs font-medium text-slate-400 leading-snug">Quickly register a new farmer.</p>
            </div>
          </div>
        </button>
      </div>

      {isLoading ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 border-b border-slate-100 last:border-0 animate-pulse"
            >
              <div className="h-11 w-11 rounded-full bg-slate-100 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-28 rounded bg-slate-100" />
                <div className="h-3 w-40 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredFarmers.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
          {filteredFarmers.map((farmer, index) => {
            const crop = CROP_STATUSES.find((c) => c.value === farmer.crop_status);
            const statusColor = crop?.color || '#10B981';
            const listStatusLabel = crop?.label || 'Growing';
            const details = [
              farmer.village,
              farmer.phone,
            ]
              .filter(Boolean)
              .join(' • ');

            return (
              <React.Fragment key={farmer.id}>
                {index > 0 && <div className="h-px w-full bg-slate-100" aria-hidden="true" />}
                <button
                  type="button"
                  onClick={() => {
                    setFarmer(farmer.id, farmer.name, farmer.total_due, farmer.credit_limit);
                    onSelect?.();
                  }}
                  className={cn(
                    'w-full cursor-pointer text-left transition-all active:scale-[0.99] focus-ring group flex min-h-[70px] items-center justify-between px-3 py-3 sm:px-4 hover:bg-slate-50/70',
                    farmerId === farmer.id ? 'bg-sky-50/20' : ''
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <FarmerAvatar imageUrl={farmer.image_url} name={farmer.name} size="md" />

                    <div className="min-w-0">
                      <div className="truncate text-[0.95rem] font-bold tracking-tight text-slate-900">
                        {farmer.name}
                      </div>
                      {details && (
                        <div className="mt-0.5 truncate text-[0.75rem] font-medium text-slate-500 uppercase">
                          {details}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[0.95rem] font-bold tabular-nums ${
                            farmer.total_due > 0 ? 'text-orange-500' : 'text-slate-400'
                          }`}
                        >
                          {formatCurrency(farmer.total_due)}
                        </span>
                        <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full shadow-sm" style={{ backgroundColor: statusColor }} />
                      </div>
                      <div className="mt-0">
                        <span className="text-[0.75rem] font-semibold text-slate-400">
                          {listStatusLabel}
                        </span>
                      </div>
                    </div>
                    {farmerId === farmer.id ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shrink-0 ml-1">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    ) : (
                      <svg
                        className="h-4.5 w-4.5 text-slate-200 transition-colors group-hover:text-slate-300 shrink-0 ml-1"
                        viewBox="0 0 20 20"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      ) : null}

      {!isLoading && !filteredFarmers.length ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-text-secondary flex flex-col items-center">
          <Users className="mx-auto mb-3 h-6 w-6 text-text-muted" />
          <p className="mb-3">{t('billing.noCustomerMatches', 'No farmers match your search.')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="font-bold"
          >
            <UserPlus className="mr-1.5 h-4 w-4" />
            Add "{search}" as Farmer
          </Button>
        </div>
      ) : null}

      <QuickAddFarmerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        initialName={search}
        onSuccess={(farmer) => {
          setFarmer(farmer.id, farmer.name, farmer.total_due, farmer.credit_limit);
          onSelect?.();
        }}
      />
      <QuickAddWalkInModal
        isOpen={isWalkInModalOpen}
        onClose={() => setIsWalkInModalOpen(false)}
        onSuccess={(farmer) => {
          setFarmer(farmer.id, farmer.name, farmer.total_due, farmer.credit_limit);
          onSelect?.();
        }}
      />
    </div>
  );
};

export default FarmerSelector;
