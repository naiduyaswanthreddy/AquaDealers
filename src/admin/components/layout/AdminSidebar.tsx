import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAdminAuthStore } from '@/admin/stores/adminAuthStore';
import {
  LayoutDashboard, Users, CreditCard, Package, LifeBuoy,
  Megaphone, BarChart2, PieChart, Settings, FileText, Shield, LogOut
} from 'lucide-react';

const navSections = [
  {
    label: 'Operations',
    items: [
      { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/admin/dealers', label: 'Dealers', icon: Users },
      { path: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
      { path: '/admin/addons', label: 'Addons', icon: Package },
    ]
  },
  {
    label: 'Support',
    items: [
      { path: '/admin/support', label: 'Tickets', icon: LifeBuoy },
      { path: '/admin/broadcast', label: 'Broadcast', icon: Megaphone },
      { path: '/admin/reports', label: 'Platform Reports', icon: BarChart2 },
      { path: '/admin/analytics', label: 'Analytics', icon: PieChart },
    ]
  },
  {
    label: 'System',
    items: [
      { path: '/admin/settings', label: 'Settings', icon: Settings },
      { path: '/admin/audit', label: 'Audit Log', icon: Shield, requiresRole: 'super_admin' as const },
    ]
  }
];

const AdminSidebar: React.FC = () => {
  const { adminUser, logout } = useAdminAuthStore();
  const location = useLocation();

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img src="/logo.png" alt="AquaDealer Logo" style={{ height: '24px', width: 'auto', objectFit: 'contain' }} />
        <span style={{ fontSize: '16px', fontWeight: 800 }}>AquaDealer Admin</span>
      </div>

      <nav className="flex-1 py-2">
        {navSections.map((section) => (
          <div key={section.label}>
            <div className="admin-nav-section">{section.label}</div>
            {section.items
              .filter(item => {
                if ('requiresRole' in item && item.requiresRole) {
                  return adminUser?.role === item.requiresRole;
                }
                return true;
              })
              .map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`admin-nav-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
                >
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              ))
            }
          </div>
        ))}
      </nav>

      <div className="p-4 border-t" style={{ borderColor: 'var(--admin-border)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
            {adminUser?.name?.charAt(0) || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--admin-text)' }}>
              {adminUser?.name}
            </p>
            <span className={`admin-role-badge ${adminUser?.role}`}>
              {adminUser?.role?.replace('_', ' ')}
            </span>
          </div>
        </div>
        <button
          onClick={logout}
          className="admin-btn admin-btn-ghost w-full justify-start gap-2 text-sm"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
