import React, { useState } from 'react';
import { useExtendSubscription } from '@/admin/hooks/useAdminSubscriptions';
import { useAdminDealers } from '@/admin/hooks/useAdminDealers';
import { X, Save } from 'lucide-react';
import { useAdminAuthStore } from '@/admin/stores/adminAuthStore';

interface ExtendSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDealerId: string | null;
}

const ExtendSubscriptionModal: React.FC<ExtendSubscriptionModalProps> = ({ isOpen, onClose, defaultDealerId }) => {
  const { adminUser } = useAdminAuthStore();
  const { mutateAsync: extendSub, isPending } = useExtendSubscription();
  const { data: dealers } = useAdminDealers({ status: 'active' }); // Only active dealers can be extended

  const [dealerId, setDealerId] = useState(defaultDealerId || '');
  const [planName, setPlanName] = useState('basic');
  const [days, setDays] = useState(30);
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!dealerId) {
      setError('Please select a dealer.');
      return;
    }
    
    if (!adminUser) {
        setError("Admin user not found. Please log in again.");
        return;
    }

    try {
      await extendSub({
        dealerId,
        planName,
        days,
        amountPaid: parseFloat(amountPaid) || 0,
        paymentMethod,
        notes,
        grantedBy: adminUser.id,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to extend subscription.');
    }
  };

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal">
        <div className="admin-modal-header">
          <h2 className="admin-card-title">Grant / Extend Subscription</h2>
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

            {!defaultDealerId && (
              <div>
                <label className="admin-label">Select Dealer</label>
                <select 
                  className="admin-select" 
                  value={dealerId} 
                  onChange={(e) => setDealerId(e.target.value)}
                  style={{ width: '100%' }}
                  required
                >
                  <option value="">-- Choose a dealer --</option>
                  {(dealers?.data || []).map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.shop_name}) - {d.phone}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label className="admin-label">Plan</label>
                <select 
                  className="admin-select" 
                  value={planName} 
                  onChange={(e) => setPlanName(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="trial">Trial</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="pro_plus">Pro+</option>
                </select>
              </div>
              <div>
                <label className="admin-label">Duration (Days)</label>
                <select 
                  className="admin-select" 
                  value={days} 
                  onChange={(e) => setDays(Number(e.target.value))}
                  style={{ width: '100%' }}
                >
                  <option value={15}>15 Days</option>
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days</option>
                  <option value={180}>180 Days</option>
                  <option value={365}>365 Days</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label className="admin-label">Amount Paid (₹)</label>
                <input 
                  type="number" 
                  className="admin-input" 
                  value={amountPaid} 
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="0 for comp/free"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="admin-label">Payment Method</label>
                <select 
                  className="admin-select" 
                  value={paymentMethod} 
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="complimentary">Complimentary / Free</option>
                </select>
              </div>
            </div>

            <div>
              <label className="admin-label">Admin Notes</label>
              <textarea 
                className="admin-input" 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for extension or payment ref..."
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

          </div>
          <div className="admin-modal-footer">
            <button type="button" onClick={onClose} className="admin-btn admin-btn-outline">
              Cancel
            </button>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={isPending}>
              {isPending ? 'Processing...' : <><Save size={16} /> Grant Access</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExtendSubscriptionModal;
