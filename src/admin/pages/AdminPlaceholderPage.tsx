import React from 'react';
import { useLocation } from 'react-router-dom';

const AdminPlaceholderPage: React.FC = () => {
  const location = useLocation();
  const pageName = location.pathname.split('/').filter(Boolean).pop() || 'Page';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 400,
      gap: 16,
    }}>
      <div style={{
        fontSize: 48,
        opacity: 0.3,
      }}>
        🚧
      </div>
      <h2 style={{
        fontSize: 20,
        fontWeight: 700,
        color: 'var(--admin-text)',
        textTransform: 'capitalize',
      }}>
        {pageName.replace(/-/g, ' ')}
      </h2>
      <p style={{
        color: 'var(--admin-text-muted)',
        fontSize: 14,
      }}>
        This module is under construction.
      </p>
    </div>
  );
};

export default AdminPlaceholderPage;
