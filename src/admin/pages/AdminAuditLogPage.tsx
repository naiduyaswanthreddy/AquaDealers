import React, { useState } from 'react';
import { useAdminAuditLogs } from '@/admin/hooks/useAdminSettings';
import { useAdminAuthStore } from '@/admin/stores/adminAuthStore';
import { Shield, Search, Lock } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { useLoadMoreList } from '@/lib/useLoadMoreList';

const AdminAuditLogPage: React.FC = () => {
  const { adminUser } = useAdminAuthStore();
  const [search, setSearch] = useState('');
  const { data: logs, isLoading } = useAdminAuditLogs(200);

  // Security check: Only super_admin can view audit logs
  if (adminUser?.role !== 'super_admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const filteredLogs = (logs || []).filter((log: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return log.action.toLowerCase().includes(s) || 
           log.target_type?.toLowerCase().includes(s) ||
           log.admin?.name?.toLowerCase().includes(s);
  });
  const pagedLogs = useLoadMoreList(filteredLogs, {
    initialCount: 25,
    step: 25,
    resetDeps: [search, filteredLogs.length],
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: 'calc(100vh - 120px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={22} color="var(--admin-danger)" /> Audit Logs
          </h1>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 14 }}>
            Immutable record of all administrative actions. (Super Admin Only)
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--admin-danger-bg)', padding: '6px 12px', borderRadius: 8, color: 'var(--admin-danger)', fontSize: 13, fontWeight: 600 }}>
          <Lock size={14} /> Highly Confidential
        </div>
      </div>

      <div className="admin-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 320 }}>
            <Search size={16} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-dim)'
            }} />
            <input
              type="text"
              placeholder="Search actions, admins, or targets..."
              className="admin-input"
              style={{ paddingLeft: 36 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span style={{ fontSize: 13, color: 'var(--admin-text-muted)' }}>Showing last 200 events</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div className="admin-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="admin-table">
              <thead style={{ position: 'sticky', top: 0, background: 'var(--admin-card)' }}>
                <tr>
                  <th>Timestamp</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target Type</th>
                  <th>Target ID</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                      <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--admin-text-muted)' }}>
                      No audit logs found.
                    </td>
                  </tr>
                ) : (
                  <>
                  {pagedLogs.visibleItems.map((log: any) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: 12, color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(log.performed_at).toLocaleString()}
                      </td>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>
                        {log.admin?.name || 'System'}
                      </td>
                      <td>
                        <span className="admin-badge basic" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--admin-text)', border: '1px solid var(--admin-border)' }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ color: 'var(--admin-text-muted)' }}>
                        {log.target_type || '—'}
                      </td>
                      <td className="admin-mono" style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>
                        {log.target_id?.slice(0, 8) || '—'}
                      </td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--admin-text-dim)' }}>
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </td>
                    </tr>
                  ))}
                  </>
                )}
              </tbody>
            </table>
            <ListLoadMore
              shown={pagedLogs.visibleCount}
              total={pagedLogs.totalCount}
              onLoadMore={pagedLogs.loadMore}
              label="Load more logs"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAuditLogPage;
