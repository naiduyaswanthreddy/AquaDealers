import React, { useMemo, useState } from 'react';
import { ArrowLeft, Plus, Loader2 } from 'lucide-react';
import {
  useAdminDealers,
  useWhatsappPlans,
  useUpsertWhatsappPlan,
  useSetDealerWhatsappAddon,
  useWhatsappOverview,
  useSetWhatsappPrice,
} from '@/admin/hooks/useAdminDealers';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { useLoadMoreList } from '@/lib/useLoadMoreList';

interface Props {
  onBack: () => void;
}

const WhatsappAddonManager: React.FC<Props> = ({ onBack }) => {
  const [search, setSearch] = useState('');
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanLimit, setNewPlanLimit] = useState('');

  const { data: plans, isLoading: plansLoading } = useWhatsappPlans();
  const upsertPlan = useUpsertWhatsappPlan();
  const setDealerAddon = useSetDealerWhatsappAddon();
  const { data: overview } = useWhatsappOverview();
  const setPrice = useSetWhatsappPrice();
  const [priceInput, setPriceInput] = useState('');

  const { data: dealers, isLoading: dealersLoading } = useAdminDealers({ search: search || undefined });
  const dealerList = dealers?.data || [];
  const pagedDealers = useLoadMoreList(dealerList, {
    initialCount: 10,
    step: 10,
    resetDeps: [search, dealerList.length],
  });

  const usageByDealer = useMemo(() => {
    const map = new Map<string, number>();
    (overview?.per_dealer || []).forEach(row => map.set(row.dealer_id, row.used));
    return map;
  }, [overview]);

  const planLimitById = useMemo(() => {
    const map = new Map<string, number>();
    (plans || []).forEach(p => map.set(p.id, p.monthly_limit));
    return map;
  }, [plans]);

  const handleSavePrice = async () => {
    const price = parseFloat(priceInput);
    if (isNaN(price) || price < 0) return;
    try {
      await setPrice.mutateAsync(price);
      setPriceInput('');
    } catch (err) {
      console.error('Failed to save WhatsApp price:', err);
      alert('Failed to save price.');
    }
  };

  const handleCreatePlan = async () => {
    const limit = parseInt(newPlanLimit, 10);
    if (!newPlanName.trim() || !limit || limit <= 0) return;
    try {
      await upsertPlan.mutateAsync({ name: newPlanName.trim(), monthlyLimit: limit });
      setNewPlanName('');
      setNewPlanLimit('');
    } catch (err) {
      console.error('Failed to create WhatsApp plan:', err);
      alert('Failed to create plan.');
    }
  };

  const handlePlanChange = async (dealerId: string, planId: string, currentEnabled: boolean) => {
    try {
      await setDealerAddon.mutateAsync({ dealerId, planId: planId || null, enabled: currentEnabled });
    } catch (err) {
      console.error('Failed to assign WhatsApp plan:', err);
      alert('Failed to assign plan.');
    }
  };

  const handleToggleEnabled = async (dealerId: string, planId: string | null, currentEnabled: boolean) => {
    try {
      await setDealerAddon.mutateAsync({ dealerId, planId, enabled: !currentEnabled });
    } catch (err) {
      console.error('Failed to toggle WhatsApp addon:', err);
      alert('Failed to update.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={onBack}
          style={{ background: 'transparent', border: '1px solid var(--admin-border)', color: 'var(--admin-text)', padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        >
          <ArrowLeft size={16} /> Back to Addons
        </button>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>WhatsApp Notifications</h1>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 14, margin: 0 }}>
            Create monthly message-quota plans and assign one per dealer.
          </p>
        </div>
      </div>

      <div className="admin-card">
        <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>This month, across all dealers</h3>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>Messages sent</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{overview?.total_sent_this_month ?? 0}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>Estimated cost</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              &#8377;{(overview?.total_cost_this_month ?? 0).toFixed(2)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>Price / message</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              &#8377;{(overview?.price_per_message ?? 0).toFixed(2)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="admin-input"
            type="number"
            min={0}
            step="0.01"
            placeholder="New price per message (e.g. 0.35)"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            style={{ width: 240 }}
          />
          <button
            onClick={handleSavePrice}
            disabled={setPrice.isPending || !priceInput}
            className="admin-btn admin-btn-primary"
          >
            Save Price
          </button>
        </div>
      </div>

      <div className="admin-card">
        <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>Plans</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {plansLoading ? (
            <span style={{ color: 'var(--admin-text-muted)', fontSize: 13 }}>Loading...</span>
          ) : !plans?.length ? (
            <span style={{ color: 'var(--admin-text-muted)', fontSize: 13 }}>No plans yet — create one below.</span>
          ) : (
            plans.map(p => (
              <span key={p.id} className="admin-badge" style={{ fontSize: 13 }}>
                {p.name} &middot; {p.monthly_limit}/mo
              </span>
            ))
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="admin-input"
            placeholder="Plan name (e.g. 100/month)"
            value={newPlanName}
            onChange={(e) => setNewPlanName(e.target.value)}
            style={{ flex: '1 1 200px' }}
          />
          <input
            className="admin-input"
            type="number"
            min={1}
            placeholder="Monthly limit"
            value={newPlanLimit}
            onChange={(e) => setNewPlanLimit(e.target.value)}
            style={{ width: 140 }}
          />
          <button
            onClick={handleCreatePlan}
            disabled={upsertPlan.isPending}
            className="admin-btn admin-btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} /> Add Plan
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', maxWidth: 360 }}>
        <input
          type="text"
          placeholder="Search dealers by name, shop, or phone..."
          className="admin-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table w-full text-left" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>DEALER</th>
                <th>PLAN</th>
                <th>USAGE</th>
                <th>COST</th>
                <th style={{ textAlign: 'center', width: 100 }}>ENABLED</th>
              </tr>
            </thead>
            <tbody>
              {pagedDealers.visibleItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--admin-text-muted)' }}>
                    {dealersLoading ? 'Loading dealers...' : 'No dealers found.'}
                  </td>
                </tr>
              ) : (
                pagedDealers.visibleItems.map((dealer) => {
                  const enabled = !!dealer.whatsapp_enabled;
                  const planId = dealer.whatsapp_addon_plan_id || '';
                  const isBusy = setDealerAddon.isPending && setDealerAddon.variables?.dealerId === dealer.id;
                  return (
                    <tr key={dealer.id} style={{ opacity: isBusy ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{dealer.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--admin-text-dim)', marginTop: 2 }}>
                          {dealer.shop_name} &bull; {dealer.phone}
                        </div>
                      </td>
                      <td>
                        <select
                          className="admin-input"
                          value={planId}
                          disabled={isBusy}
                          onChange={(e) => handlePlanChange(dealer.id, e.target.value, enabled)}
                        >
                          <option value="">No plan</option>
                          {plans?.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.monthly_limit}/mo)</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--admin-text-muted)' }}>
                        {planId ? `${usageByDealer.get(dealer.id) || 0}/${planLimitById.get(planId) ?? '?'}` : '—'}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--admin-text-muted)' }}>
                        {planId ? `₹${((usageByDealer.get(dealer.id) || 0) * (overview?.price_per_message ?? 0)).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isBusy ? (
                          <Loader2 size={16} className="animate-spin" style={{ display: 'inline-block' }} />
                        ) : (
                          <input
                            type="checkbox"
                            checked={enabled}
                            disabled={!planId}
                            title={!planId ? 'Assign a plan first' : enabled ? 'Disable' : 'Enable'}
                            onChange={() => handleToggleEnabled(dealer.id, planId || null, enabled)}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <ListLoadMore
          shown={pagedDealers.visibleItems.length}
          total={dealerList.length}
          onLoadMore={pagedDealers.loadMore}
        />
      </div>
    </div>
  );
};

export default WhatsappAddonManager;
