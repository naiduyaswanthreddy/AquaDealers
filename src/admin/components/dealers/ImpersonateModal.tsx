import React, { useState } from 'react';
import { useAdminAuthStore } from '@/admin/stores/adminAuthStore';
import { adminImpersonationService } from '@/admin/services/adminImpersonationService';
import { X, Eye } from 'lucide-react';
import { Dealer } from '@/types/database';

interface ImpersonateModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealer: Dealer;
}

const ImpersonateModal: React.FC<ImpersonateModalProps> = ({ isOpen, onClose, dealer }) => {
  const { adminUser } = useAdminAuthStore();
  const [reason, setReason] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A valid reason is required for audit logs.');
      return;
    }
    
    if (!adminUser) {
      setError('Admin session not found.');
      return;
    }

    try {
      setIsPending(true);
      setError('');
      
      await adminImpersonationService.initiateImpersonation(
        adminUser.id,
        adminUser.name,
        dealer.id,
        reason
      );
      
      // Impersonation is set in the main authStore. 
      // Open the main app in a new tab to avoid messing up the admin portal state
      window.open('/', '_blank');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to initiate impersonation.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal">
        <div className="admin-modal-header">
          <h2 className="admin-card-title">Impersonate Dealer</h2>
          <button onClick={onClose} className="admin-btn-ghost" style={{ padding: 4, background: 'transparent', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="admin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{ padding: 12, background: 'var(--admin-danger-bg)', color: 'var(--admin-danger)', borderRadius: 8, fontSize: 13 }}>
                {error}
              </div>
            )}
            
            <p style={{ fontSize: 14, color: 'var(--admin-text-muted)', lineHeight: 1.5 }}>
              You are about to log in as <strong>{dealer.name} ({dealer.shop_name})</strong>. 
              This action is strictly logged and you will be operating in <strong>Read-Only Mode</strong>.
            </p>

            <div>
              <label className="admin-label">Reason for Impersonation (Required)</label>
              <textarea 
                className="admin-input" 
                value={reason} 
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Investigating ticket #1234 regarding missing bill..."
                rows={3}
                required
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>
          <div className="admin-modal-footer">
            <button type="button" onClick={onClose} className="admin-btn admin-btn-outline">
              Cancel
            </button>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={isPending || !reason.trim()}>
              {isPending ? 'Initiating...' : <><Eye size={16} /> Login as {dealer.name.split(' ')[0]}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ImpersonateModal;
