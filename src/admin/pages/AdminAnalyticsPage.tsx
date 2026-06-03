import React from 'react';
import { useAdminAnalytics } from '@/admin/hooks/useAdminAnalytics';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { IndianRupee, TrendingUp, Users } from 'lucide-react';

const COLORS = ['#4ba2ff', '#45c98a', '#f4b65f', '#8e88ff'];

const AdminAnalyticsPage: React.FC = () => {
  const { data, isLoading, error } = useAdminAnalytics();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--admin-text-muted)' }}>
        Loading analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, background: 'var(--admin-danger-bg)', color: 'var(--admin-danger)', borderRadius: 12 }}>
        <strong>Error loading analytics:</strong> {(error as Error).message}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={24} /> Platform Analytics
        </h1>
        <p style={{ color: 'var(--admin-text-muted)', fontSize: 14 }}>
          Monitor your platform growth and revenue.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="admin-dashboard-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="admin-stat">
          <div className="admin-stat-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IndianRupee size={16} color="var(--admin-success)" /> Monthly Recurring Revenue (MRR)
          </div>
          <div className="admin-stat-value">₹{data.mrr?.toLocaleString('en-IN') || 0}</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IndianRupee size={16} color="var(--admin-accent)" /> Yearly Recurring Revenue (YRR)
          </div>
          <div className="admin-stat-value">₹{data.yrr?.toLocaleString('en-IN') || 0}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
        {/* Plan Distribution */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Plan Distribution</h3>
          </div>
          <div style={{ height: 300 }}>
            {data.planDistribution?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.planDistribution}
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {data.planDistribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: 'rgba(20, 31, 45, 0.95)', border: '1px solid var(--admin-border)', borderRadius: 8, color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--admin-text-muted)' }}>
                No plan data available
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            {data.planDistribution?.map((entry: any, index: number) => (
              <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: COLORS[index % COLORS.length] }} />
                <span style={{ textTransform: 'capitalize' }}>{entry.name} ({entry.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dealer Growth */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">New Dealers (Last 30 Days)</h3>
          </div>
          <div style={{ height: 300 }}>
            {data.dealerGrowth?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.dealerGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="var(--admin-text-dim)" 
                    fontSize={12} 
                    tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="var(--admin-text-dim)" fontSize={12} allowDecimals={false} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ background: 'rgba(20, 31, 45, 0.95)', border: '1px solid var(--admin-border)', borderRadius: 8, color: '#fff' }}
                    labelFormatter={(val) => new Date(val).toLocaleDateString()}
                  />
                  <Bar dataKey="dealers" fill="var(--admin-accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--admin-text-muted)' }}>
                No new dealers in last 30 days
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsPage;
