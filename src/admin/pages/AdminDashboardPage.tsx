import React from 'react';
import { useAdminKPIs, useExpiringSubscriptions, useStuckOnboarding } from '@/admin/hooks/useAdminMetrics';
import { formatCurrency } from '@/lib/utils';
import { Users, UserCheck, Beaker, IndianRupee, UserPlus, Receipt, AlertTriangle, GraduationCap } from 'lucide-react';

const AdminDashboardPage: React.FC = () => {
  const { data: kpis, isLoading, error: kpiError } = useAdminKPIs();
  const { data: expiring } = useExpiringSubscriptions(7);
  const { data: stuck } = useStuckOnboarding();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (kpiError) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'red' }}>
        <h3>Error loading Dashboard data</h3>
        <p>Your admin session may have expired or is invalid. Please log out and log back in.</p>
        <p style={{ fontSize: 12, marginTop: 10 }}>Details: {(kpiError as Error).message}</p>
      </div>
    );
  }

  const stats = [
    { label: 'Total Dealers', value: kpis?.totalDealers || 0, icon: Users, color: '#388BFD' },
    { label: 'Active This Month', value: kpis?.activeDealers || 0, icon: UserCheck, color: '#3FB950' },
    { label: 'Trial Dealers', value: kpis?.trialDealers || 0, icon: Beaker, color: '#D29922' },
    { label: 'YRR', value: formatCurrency(kpis?.mrr || 0), icon: IndianRupee, color: '#E3B341', isCurrency: true },
    { label: 'New Signups (30d)', value: kpis?.newSignups30d || 0, icon: UserPlus, color: '#A371F7' },
    { label: 'Bills Today', value: kpis?.billsToday || 0, icon: Receipt, color: '#388BFD' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Platform Dashboard</h1>
        <p style={{ color: 'var(--admin-text-muted)', fontSize: 14 }}>
          Real-time overview of AquaDealers platform health
        </p>
      </div>

      {/* KPI Cards */}
      <div className="admin-dashboard-stats">
        {stats.map((stat, i) => (
          <div key={i} className="admin-stat">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span className="admin-stat-label">{stat.label}</span>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: `${stat.color}15`, display: 'flex',
                alignItems: 'center', justifyContent: 'center'
              }}>
                <stat.icon size={18} color={stat.color} />
              </div>
            </div>
            <div className="admin-stat-value">
              {stat.isCurrency ? stat.value : stat.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Alert Panels */}
      <div className="admin-dashboard-panels">
        {/* Expiring Subscriptions */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color="var(--admin-danger)" />
              <span className="admin-card-title">Expiring in 7 Days</span>
            </div>
            <span className="admin-badge urgent">{expiring?.length || 0}</span>
          </div>
          {!expiring || expiring.length === 0 ? (
            <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, textAlign: 'center', padding: 16 }}>
              No subscriptions expiring soon 🎉
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
              {expiring.slice(0, 5).map((sub: any) => (
                <div key={sub.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.02)'
                }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{sub.dealers?.name || 'Unknown'}</p>
                    <div style={{ fontSize: 13, color: 'var(--admin-text-dim)', textTransform: 'capitalize' }}>
                      {sub.plan_name.replace('_', ' ')} · Expires {sub.end_date}
                    </div>
                  </div>
                  <button className="admin-btn admin-btn-outline" style={{ fontSize: 11, padding: '4px 10px' }}>
                    Remind
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stuck Onboarding */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <GraduationCap size={16} color="var(--admin-warning)" />
              <span className="admin-card-title">Onboarding Stuck</span>
            </div>
            <span className="admin-badge high">{stuck?.length || 0}</span>
          </div>
          {!stuck || stuck.length === 0 ? (
            <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, textAlign: 'center', padding: 16 }}>
              All dealers progressing smoothly 🎉
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
              {stuck.slice(0, 5).map((item: any) => {
                const steps = [
                  item.step_1_shop_details_at,
                  item.step_2_language_at,
                  item.step_3_first_product_at,
                  item.step_4_first_farmer_at,
                  item.step_5_set_pin_at || item.step_5_first_bill_at,
                ];
                const completedSteps = steps.filter(Boolean).length;

                return (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.02)'
                  }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>{item.dealers?.name || 'Unknown'}</p>
                      <p style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>
                        Step {completedSteps}/5 · {item.dealers?.phone}
                      </p>
                    </div>
                    <div className="admin-progress-bar" style={{ width: 80 }}>
                      <div className="admin-progress-fill" style={{ width: `${(completedSteps / 5) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
