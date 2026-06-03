import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAdminAuthStore } from '@/admin/stores/adminAuthStore';
import { ChevronRight } from 'lucide-react';

const breadcrumbMap: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/dealers': 'Dealers',
  '/admin/subscriptions': 'Subscriptions',
  '/admin/products': 'Products',
  '/admin/support': 'Support Tickets',
  '/admin/broadcast': 'Broadcast',
  '/admin/reports': 'Platform Reports',
  '/admin/analytics': 'Analytics',
  '/admin/settings': 'Settings',
  '/admin/audit': 'Audit Log',
};

const AdminTopBar: React.FC = () => {
  const location = useLocation();
  const { adminUser } = useAdminAuthStore();

  const currentPage = breadcrumbMap[location.pathname] || 
    Object.entries(breadcrumbMap).find(([path]) => location.pathname.startsWith(path))?.[1] ||
    'Admin';

  return (
    <header className="admin-topbar">
      <div className="admin-breadcrumb">
        Admin
        <ChevronRight size={14} />
        <span>{currentPage}</span>
      </div>

      <div className="admin-topbar-user">
        <span style={{ color: 'var(--admin-text-muted)', fontSize: 13 }}>
          {adminUser?.email}
        </span>
        <span className={`admin-role-badge ${adminUser?.role}`}>
          {adminUser?.role?.replace('_', ' ')}
        </span>
      </div>
    </header>
  );
};

export default AdminTopBar;
