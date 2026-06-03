import React, { useState } from 'react';
import { useAdminSubscriptions, useAdminRevenue, useExtendSubscription } from '@/admin/hooks/useAdminSubscriptions';
import { formatCurrency } from '@/lib/utils';
import { CreditCard, AlertCircle, Plus, Search } from 'lucide-react';
import ExtendSubscriptionModal from '../components/subscriptions/ExtendSubscriptionModal';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { useLoadMoreList } from '@/lib/useLoadMoreList';

const planColors: Record<string, string> = {
  trial: 'trial', basic: 'basic', pro: 'pro', pro_plus: 'pro', expired: 'expired', suspended: 'suspended'
};

const SubscriptionManagementPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [search, setSearch] = useState('');
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);

  const { data: revenue } = useAdminRevenue();
  const { data: subscriptions, isLoading } = useAdminSubscriptions({
    status: statusFilter || undefined,
    plan: planFilter || undefined,
  });

  const filteredSubs = (subscriptions || []).filter(sub => {
    if (!search) return true;
    const s = search.toLowerCase();
    return sub.dealers?.name?.toLowerCase().includes(s) || 
           sub.dealers?.shop_name?.toLowerCase().includes(s) ||
           sub.dealers?.phone?.includes(s);
  });
  const pagedSubs = useLoadMoreList(filteredSubs, {
    initialCount: 10,
    step: 10,
    resetDeps: [search, statusFilter, planFilter, filteredSubs.length],
  });

  const handleExtend = (dealerId: string) => {
    setSelectedDealerId(dealerId);
    setIsExtendModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={22} /> Subscription Management
          </h1>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 14 }}>
            Manage dealer plans and track revenue
          </p>
        </div>
        <button 
          className="admin-btn admin-btn-primary"
          onClick={() => { setSelectedDealerId(null); setIsExtendModalOpen(true); }}
        >
          <Plus size={14} /> Quick Grant
        </button>
      </div>

      {/* Revenue KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div className="admin-stat">
          <div className="admin-stat-label">Yearly Recurring Revenue (YRR)</div>
          <div className="admin-stat-value">{formatCurrency(revenue?.mrr || 0)}</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-label">Annual Run Rate (ARR)</div>
          <div className="admin-stat-value">{formatCurrency(revenue?.arr || 0)}</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-label">Active Paid Subscriptions</div>
          <div className="admin-stat-value">{revenue?.activePaid || 0}</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-label">Active Trials</div>
          <div className="admin-stat-value">{revenue?.trialCount || 0}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-card" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <Search size={16} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--admin-text-dim)'
          }} />
          <input
            type="text"
            placeholder="Search by dealer name, shop, or phone..."
            className="admin-input"
            style={{ paddingLeft: 36 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="admin-select"
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          style={{ minWidth: 150 }}
        >
          <option value="">All Plans</option>
          <option value="trial">Trial</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="pro_plus">Pro+</option>
        </select>
        <select
          className="admin-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ minWidth: 150 }}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div className="admin-table-wrapper">
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
             <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredSubs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
            <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
            <p>No subscriptions found matching your filters.</p>
          </div>
        ) : (
          <>
            <table className="admin-table">
            <thead>
              <tr>
                <th>Dealer</th>
                <th>Plan</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
                <th>Amount</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedSubs.visibleItems.map((sub) => {
                const isExpiringSoon = sub.status === 'active' && 
                  new Date(sub.end_date).getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000;
                  
                return (
                  <tr key={sub.id}>
                    <td>
                      <p style={{ fontWeight: 600, fontSize: 13 }}>{sub.dealers?.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{sub.dealers?.shop_name} • {sub.dealers?.phone}</p>
                    </td>
                    <td>
                      <span className={`admin-badge ${planColors[sub.plan_name] || 'trial'}`} style={{ textTransform: 'capitalize' }}>
                        {sub.plan_name.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ color: 'var(--admin-text-muted)' }}>{sub.start_date}</td>
                    <td>
                       <span style={{ color: isExpiringSoon ? 'var(--admin-warning)' : 'inherit', fontWeight: isExpiringSoon ? 600 : 400 }}>
                          {sub.end_date}
                       </span>
                    </td>
                    <td>
                      <span className={`admin-badge ${planColors[sub.status] || 'trial'}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="admin-mono">{formatCurrency(sub.amount_paid || 0)}</td>
                    <td>
                      <button 
                        className="admin-btn admin-btn-outline" 
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        onClick={() => handleExtend(sub.dealer_id)}
                      >
                        Extend
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ListLoadMore
            shown={pagedSubs.visibleCount}
            total={pagedSubs.totalCount}
            onLoadMore={pagedSubs.loadMore}
            label="Load more subscriptions"
          />
          </>
        )}
      </div>

      {isExtendModalOpen && (
        <ExtendSubscriptionModal 
          isOpen={isExtendModalOpen}
          onClose={() => setIsExtendModalOpen(false)}
          defaultDealerId={selectedDealerId}
        />
      )}
    </div>
  );
};

export default SubscriptionManagementPage;
