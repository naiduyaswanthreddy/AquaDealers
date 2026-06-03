import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminDealers } from '@/admin/hooks/useAdminDealers';
import { formatCurrency } from '@/lib/utils';
import { Search, Download, Users, MoreVertical } from 'lucide-react';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { useLoadMoreList } from '@/lib/useLoadMoreList';

const planColors: Record<string, string> = {
  trial: 'trial', basic: 'basic', pro: 'pro', expired: 'expired',
};

const AdminDealerListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: dealers, isLoading, error: dealersError } = useAdminDealers({
    search: search || undefined,
    plan: planFilter || undefined,
    status: statusFilter || undefined,
  });

  const filteredDealers = useMemo(() => {
    return dealers?.data || [];
  }, [dealers]);
  const pagedDealers = useLoadMoreList(filteredDealers, {
    initialCount: 10,
    step: 10,
    resetDeps: [search, planFilter, statusFilter, filteredDealers.length],
  });

  const handleExportCSV = () => {
    if (!filteredDealers.length) return;
    const headers = ['Name', 'Shop', 'Phone', 'District', 'Plan', 'Status', 'Created'];
    const rows = filteredDealers.map(d => [
      d.name, d.shop_name, d.phone, d.district || '', d.plan,
      d.is_active ? 'Active' : 'Suspended', d.created_at?.slice(0, 10),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dealers_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {dealersError && (
        <div style={{ padding: 20, marginBottom: 10, borderRadius: 8, background: 'var(--admin-danger-bg)', color: 'var(--admin-danger)', fontSize: 14 }}>
          <strong>Error loading dealers:</strong> {(dealersError as Error).message}. Your session may be invalid. Try logging out.
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={22} /> Dealer Management
          </h1>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 14 }}>
            {filteredDealers.length} dealer{filteredDealers.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <button className="admin-btn admin-btn-outline" onClick={handleExportCSV}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <Search size={16} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--admin-text-dim)'
          }} />
          <input
            type="text"
            placeholder="Search by name, shop, or phone..."
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
          style={{ minWidth: 130 }}
        >
          <option value="">All Plans</option>
          <option value="trial">Trial</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
        </select>
        <select
          className="admin-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ minWidth: 130 }}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div className="admin-table-wrapper">
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : dealers?.data?.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
            No dealers found matching your filters.
          </div>
        ) : (
          <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Dealer</th>
                <th>Phone</th>
                <th>District</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Joined</th>
                <th style={{ width: 60 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedDealers.visibleItems.map((dealer) => (
                <tr
                  key={dealer.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/admin/dealers/${dealer.id}`)}
                >
                  <td>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 13 }}>{dealer.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{dealer.shop_name}</p>
                    </div>
                  </td>
                  <td>
                    <span className="admin-mono">{dealer.phone}</span>
                  </td>
                  <td style={{ color: 'var(--admin-text-muted)', fontSize: 13 }}>
                    {dealer.district || '—'}
                  </td>
                  <td>
                    <span className={`admin-badge ${planColors[dealer.plan] || 'trial'}`} style={{ textTransform: 'capitalize' }}>
                      {dealer.plan.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-badge ${dealer.is_active ? 'active' : 'suspended'}`}>
                      {dealer.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--admin-text-muted)', fontSize: 12 }}>
                    {dealer.created_at?.slice(0, 10)}
                  </td>
                  <td>
                    <button
                      className="admin-btn admin-btn-ghost"
                      style={{ padding: '4px 6px' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ListLoadMore
            shown={pagedDealers.visibleCount}
            total={pagedDealers.totalCount}
            onLoadMore={pagedDealers.loadMore}
            label="Load more dealers"
          />
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDealerListPage;
