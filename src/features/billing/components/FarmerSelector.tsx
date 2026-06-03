import React, { useMemo, useState } from 'react';
import { Check, User, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SearchBar, FarmerAvatar } from '@/components/ui';
import { useFarmers } from '@/features/farmers/hooks/useFarmers';
import { useCartStore } from '../stores/cartStore';
import { cn } from '@/lib/utils';

export const FarmerSelector: React.FC<{ onSelect?: () => void }> = ({ onSelect }) => {
  const { t } = useTranslation();
  const { data: farmers = [], isLoading } = useFarmers();
  const { farmerId, setFarmer } = useCartStore();
  const [search, setSearch] = useState('');

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

      <div className="grid gap-2.5 md:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setFarmer(null, 'Walk-in Customer', 0, 0);
            onSelect?.();
          }}
          className={cn(
            'focus-ring rounded-2xl border p-3 text-left shadow-[0_10px_26px_rgba(15,23,42,0.10)] transition-all duration-200',
            farmerId === null
              ? 'border-primary bg-white ring-2 ring-primary/15'
              : 'border-white bg-white hover:border-slate-200 hover:bg-sky-50/30 active:scale-[0.985]'
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

        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-white bg-white p-3 shadow-[0_10px_26px_rgba(15,23,42,0.10)]"
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 animate-pulse rounded-2xl bg-slate-100" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            </div>
          ))
        ) : filteredFarmers.map((farmer) => (
          <button
            key={farmer.id}
            type="button"
            onClick={() => {
              setFarmer(farmer.id, farmer.name, farmer.total_due, farmer.credit_limit);
              onSelect?.();
            }}
            className={cn(
            'focus-ring rounded-2xl border p-3 text-left shadow-[0_10px_26px_rgba(15,23,42,0.10)] transition-all duration-200',
            farmerId === farmer.id
                ? 'border-primary bg-white ring-2 ring-primary/15'
                : 'border-white bg-white hover:border-slate-200 hover:bg-sky-50/30 active:scale-[0.985]'
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                'flex shrink-0 transition-all duration-200',
                farmerId === farmer.id ? 'ring-2 ring-primary ring-offset-1 rounded-full' : ''
              )}>
                <FarmerAvatar 
                  imageUrl={farmer.image_url} 
                  name={farmer.name} 
                  size="lg" 
                  className={cn(
                    "shadow-sm",
                    farmerId === farmer.id ? 'bg-primary text-white border-2 border-white' : 'bg-primary/10 text-primary border border-primary/20'
                  )}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-bold text-slate-800">{farmer.name}</h3>
                  {farmerId === farmer.id ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {farmer.village && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200/60 uppercase tracking-wide">
                      {farmer.village}
                    </span>
                  )}
                  {farmer.phone && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-100/70">
                      {farmer.phone}
                    </span>
                  )}
                  {!farmer.village && !farmer.phone && (
                    <span className="text-[11px] font-semibold text-slate-400">
                      {t('billing.noCustomerMeta', 'No details')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {!isLoading && !filteredFarmers.length ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-text-secondary">
          <Users className="mx-auto mb-3 h-6 w-6 text-text-muted" />
          {t('billing.noCustomerMatches', 'No farmers match your search.')}
        </div>
      ) : null}
    </div>
  );
};

export default FarmerSelector;
