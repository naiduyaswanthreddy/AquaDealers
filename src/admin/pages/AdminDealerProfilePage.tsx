import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdminDealerProfile, useAdminDealerStats, useSuspendDealer, useUnsuspendDealer } from '@/admin/hooks/useAdminDealers';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, ShieldAlert, ShieldCheck, Eye, Send } from 'lucide-react';
import ImpersonateModal from '../components/dealers/ImpersonateModal';
import AdminSubscriptionTab from '../components/dealers/AdminSubscriptionTab';

type Tab = 'overview' | 'onboarding' | 'subscription' | 'activity' | 'support';

const tabs: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'subscription', label: 'Subscription' },
  { key: 'activity', label: 'Activity' },
  { key: 'support', label: 'Support' },
];

const AdminDealerProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isImpersonateOpen, setIsImpersonateOpen] = useState(false);

  const { data: dealer, isLoading } = useAdminDealerProfile(id || '');
  const { data: stats } = useAdminDealerStats(id || '');
  const { mutateAsync: suspendDealer, isPending: isSuspending } = useSuspendDealer();
  const { mutateAsync: unsuspendDealer, isPending: isUnsuspending } = useUnsuspendDealer();

  const handleSuspendToggle = async () => {
    if (!dealer) return;

    try {
      if (dealer.is_active) {
        const reason = window.prompt('Reason for suspension');
        if (!reason?.trim()) return;
        await suspendDealer({ dealerId: dealer.id, reason });
      } else {
        await unsuspendDealer(dealer.id);
      }
    } catch (error) {
      console.error(error);
      window.alert('Failed to update dealer status.');
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!dealer) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--admin-text-muted)' }}>
        Dealer not found.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Back + Header */}
      <button
        onClick={() => navigate('/admin/dealers')}
        className="admin-btn admin-btn-ghost"
        style={{ alignSelf: 'flex-start', gap: 6 }}
      >
        <ArrowLeft size={16} /> Back to Dealers
      </button>

      <div className="admin-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12,
            background: 'linear-gradient(135deg, #388BFD, #A371F7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800, color: 'white'
          }}>
            {dealer.name?.charAt(0)}
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800 }}>{dealer.name}</h1>
            <p style={{ color: 'var(--admin-text-muted)', fontSize: 13 }}>{dealer.shop_name}</p>
          </div>
          <span className={`admin-badge ${dealer.plan}`} style={{ marginLeft: 8, textTransform: 'capitalize' }}>
            {dealer.plan.replace('_', ' ')}
          </span>
          <span className={`admin-badge ${dealer.is_active ? 'active' : 'suspended'}`}>
            {dealer.is_active ? 'Active' : 'Suspended'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="admin-btn admin-btn-outline" onClick={() => setIsImpersonateOpen(true)}>
            <Eye size={14} /> Impersonate
          </button>
          <button className="admin-btn admin-btn-primary"><Send size={14} /> Message</button>
          {dealer.is_active ? (
            <button className="admin-btn admin-btn-danger" onClick={handleSuspendToggle} disabled={isSuspending}>
              <ShieldAlert size={14} /> {isSuspending ? 'Suspending...' : 'Suspend'}
            </button>
          ) : (
            <button className="admin-btn admin-btn-success" onClick={handleSuspendToggle} disabled={isUnsuspending}>
              <ShieldCheck size={14} /> {isUnsuspending ? 'Unsuspending...' : 'Unsuspend'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--admin-border)', paddingBottom: 0 }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 600,
              color: activeTab === tab.key ? 'var(--admin-accent)' : 'var(--admin-text-muted)',
              borderBottom: activeTab === tab.key ? '2px solid var(--admin-accent)' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Dealer Details */}
          <div className="admin-card">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Dealer Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['Shop Name', dealer.shop_name],
                ['Owner', dealer.name],
                ['Phone', dealer.phone],
                ['Email', dealer.email || '—'],
                ['Address', dealer.address || '—'],
                ['District', dealer.district || '—'],
                ['State', dealer.state],
                ['GSTIN', dealer.gstin || '—'],
                ['Language', dealer.language],
                ['Registered', dealer.created_at?.slice(0, 10)],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--admin-text-muted)' }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="admin-card">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Quick Stats</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['Total Farmers', stats?.totalFarmers || 0],
                ['Total Bills', stats?.totalBills || 0],
                ['Total Billing Value', formatCurrency(stats?.totalBillingValue || 0)],
                ['Bills (30d)', stats?.billsLast30Days || 0],
                ['Farmers with Dues', stats?.farmersWithDues || 0],
                ['Outstanding Dues', formatCurrency(stats?.totalOutstandingDues || 0)],
                ['Last Bill', stats?.lastBillDate?.slice(0, 10) || '—'],
              ].map(([label, value]) => (
                <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--admin-text-muted)' }}>{label}</span>
                  <span style={{ fontWeight: 600 }} className="admin-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'onboarding' && (
        <div className="admin-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Onboarding Progress</h3>
          {dealer.onboarding ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Step 1: Shop Details', at: dealer.onboarding.step_1_shop_details_at },
                { label: 'Step 2: Language', at: dealer.onboarding.step_2_language_at },
                { label: 'Step 3: First Product', at: dealer.onboarding.step_3_first_product_at },
                { label: 'Step 4: First Farmer', at: dealer.onboarding.step_4_first_farmer_at },
                { label: 'Step 5: Set PIN', at: dealer.onboarding.step_5_set_pin_at || dealer.onboarding.step_5_first_bill_at },
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                  <span style={{ fontSize: 18 }}>{step.at ? '✅' : '❌'}</span>
                  <span style={{ flex: 1 }}>{step.label}</span>
                  <span style={{ color: 'var(--admin-text-muted)', fontSize: 12 }} className="admin-mono">
                    {step.at ? new Date(step.at).toLocaleString() : 'Not completed'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--admin-text-muted)', fontSize: 13 }}>No onboarding data found.</p>
          )}
        </div>
      )}

      {activeTab === 'subscription' && (
        <AdminSubscriptionTab dealerId={dealer.id} />
      )}

      {(activeTab === 'activity' || activeTab === 'support') && (
        <div className="admin-card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: 40, marginBottom: 8 }}>🚧</p>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 14 }}>
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} tab — Coming in Phase {activeTab === 'activity' ? 14 : 13}
          </p>
        </div>
      )}

      {isImpersonateOpen && dealer && (
        <ImpersonateModal 
          isOpen={isImpersonateOpen} 
          onClose={() => setIsImpersonateOpen(false)} 
          dealer={dealer as any} 
        />
      )}
    </div>
  );
};

export default AdminDealerProfilePage;
