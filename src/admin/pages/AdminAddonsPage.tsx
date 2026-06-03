import React, { useState, useMemo } from 'react';
import { useAdminDealers, useUpdateDealerAddons } from '@/admin/hooks/useAdminDealers';
import { Search, Package, CheckCircle, XCircle, ArrowLeft, Shield } from 'lucide-react';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { useLoadMoreList } from '@/lib/useLoadMoreList';

const ADDON_FEATURES = [
  { 
    id: 'advance_accounting', 
    name: 'Advance Accounting', 
    description: 'Access to advanced export and detailed ledger tools.' 
  }
];

const AdminAddonsPage: React.FC = () => {
  const [selectedAddon, setSelectedAddon] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  
  const { data: dealers, isLoading, error: dealersError } = useAdminDealers({
    search: search || undefined,
  });
  
  const updateAddons = useUpdateDealerAddons();

  const filteredDealers = useMemo(() => {
    return dealers?.data || [];
  }, [dealers]);

  const pagedDealers = useLoadMoreList(filteredDealers, {
    initialCount: 10,
    step: 10,
    resetDeps: [search, filteredDealers.length],
  });

  const handleToggleAddon = async (dealerId: string, currentFeatures: string[] = [], addonId: string) => {
    const isGranted = currentFeatures.includes(addonId);
    let newFeatures = [...currentFeatures];
    if (isGranted) {
      newFeatures = newFeatures.filter(f => f !== addonId);
    } else {
      newFeatures.push(addonId);
    }
    
    try {
      await updateAddons.mutateAsync({ dealerId, features: newFeatures });
    } catch (err) {
      console.error('Failed to update addons:', err);
      alert('Failed to update addon features.');
    }
  };

  const activeAddon = ADDON_FEATURES.find(a => a.id === selectedAddon);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {dealersError && (
        <div style={{ padding: 20, marginBottom: 10, borderRadius: 8, background: 'var(--admin-danger-bg)', color: 'var(--admin-danger)', fontSize: 14 }}>
          <strong>Error loading dealers:</strong> {(dealersError as Error).message}. Your session may be invalid. Try logging out.
        </div>
      )}
      
      {!selectedAddon ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Package size={22} /> Addons Management
              </h1>
              <p style={{ color: 'var(--admin-text-muted)', fontSize: 14 }}>
                Select an addon module to manage dealer access.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {ADDON_FEATURES.map(addon => (
              <div 
                key={addon.id} 
                className="admin-card" 
                style={{ cursor: 'pointer', transition: 'transform 0.2s', border: '1px solid var(--admin-border)' }}
                onClick={() => setSelectedAddon(addon.id)}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ padding: 10, background: 'rgba(75, 162, 255, 0.1)', borderRadius: 8, color: 'var(--admin-accent)' }}>
                    <Shield size={24} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{addon.name}</h3>
                </div>
                <p style={{ color: 'var(--admin-text-muted)', fontSize: 14, lineHeight: 1.5 }}>
                  {addon.description}
                </p>
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{ color: 'var(--admin-accent)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    Manage Access &rarr;
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button 
              onClick={() => { setSelectedAddon(null); setSearch(''); }}
              style={{ background: 'transparent', border: '1px solid var(--admin-border)', color: 'var(--admin-text)', padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            >
              <ArrowLeft size={16} /> Back to Addons
            </button>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
                {activeAddon?.name}
              </h1>
              <p style={{ color: 'var(--admin-text-muted)', fontSize: 14, margin: 0 }}>
                Manage which dealers have access to this feature.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 280px' }}>
              <Search size={16} style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--admin-text-dim)'
              }} />
              <input
                type="text"
                placeholder="Search dealers by name, shop, or phone..."
                className="admin-input"
                style={{ paddingLeft: 36 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table w-full text-left" style={{ minWidth: 800 }}>
                <thead>
                  <tr>
                    <th>DEALER</th>
                    <th>PLAN</th>
                    <th style={{ textAlign: 'center', width: 120 }}>ACCESS</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedDealers.visibleItems.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: 40, color: 'var(--admin-text-muted)' }}>
                        {isLoading ? 'Loading dealers...' : 'No dealers found.'}
                      </td>
                    </tr>
                  ) : (
                    pagedDealers.visibleItems.map((dealer) => {
                      const features = dealer.custom_features || [];
                      const hasAddon = features.includes(activeAddon!.id);
                      return (
                        <tr key={dealer.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{dealer.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--admin-text-dim)', marginTop: 2 }}>
                              {dealer.shop_name} &bull; {dealer.phone}
                            </div>
                          </td>
                          <td>
                            <span className={`admin-badge ${dealer.plan || 'trial'}`}>
                              {dealer.plan?.toUpperCase() || 'TRIAL'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => handleToggleAddon(dealer.id, features, activeAddon!.id)}
                              disabled={updateAddons.isPending && updateAddons.variables?.dealerId === dealer.id}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: (updateAddons.isPending && updateAddons.variables?.dealerId === dealer.id) ? 'not-allowed' : 'pointer',
                                padding: 8,
                                borderRadius: '50%',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                                opacity: (updateAddons.isPending && updateAddons.variables?.dealerId === dealer.id) ? 0.5 : 1
                              }}
                              title={hasAddon ? 'Revoke Access' : 'Grant Access'}
                            >
                              {hasAddon ? (
                                <CheckCircle size={24} color="#3FB950" />
                              ) : (
                                <XCircle size={24} color="var(--admin-text-dim)" />
                              )}
                            </button>
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
              total={filteredDealers.length}
              onLoadMore={pagedDealers.loadMore}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default AdminAddonsPage;
