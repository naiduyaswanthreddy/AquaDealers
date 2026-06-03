import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAdminAuthStore } from '@/admin/stores/adminAuthStore';
import AdminSidebar from '@/admin/components/layout/AdminSidebar';
import AdminTopBar from '@/admin/components/layout/AdminTopBar';
import '@/admin/styles/admin.css';

const AdminLayout: React.FC = () => {
  const { isAuthenticated } = useAdminAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="admin-root">
      <AdminSidebar />
      <AdminTopBar />
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
