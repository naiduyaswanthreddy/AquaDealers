import React, { useState } from 'react';
import { useAdminBroadcasts, useSendBroadcast } from '@/admin/hooks/useAdminCommunication';
import { useAdminAuthStore } from '@/admin/stores/adminAuthStore';
import { Megaphone, Send, Users, Smartphone, MessageSquare } from 'lucide-react';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { useLoadMoreList } from '@/lib/useLoadMoreList';

const AdminBroadcastPage: React.FC = () => {
  const [message, setMessage] = useState('');
  const [targetSegment, setTargetSegment] = useState<'all' | 'trial' | 'basic' | 'pro'>('all');
  const [channel, setChannel] = useState<'in_app' | 'whatsapp' | 'both'>('in_app');
  
  const { adminUser } = useAdminAuthStore();
  const { data: broadcasts, isLoading } = useAdminBroadcasts();
  const { mutateAsync: sendBroadcast, isPending } = useSendBroadcast();
  const pagedBroadcasts = useLoadMoreList(broadcasts || [], {
    initialCount: 6,
    step: 6,
    resetDeps: [broadcasts?.length || 0],
  });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !adminUser) return;
    
    if (!confirm(`Are you sure you want to send this ${channel} broadcast to ${targetSegment} dealers?`)) {
      return;
    }

    try {
      await sendBroadcast({
        message,
        targetSegment,
        channel,
        adminId: adminUser.id,
      });
      setMessage('');
    } catch (err) {
      console.error(err);
      alert('Failed to send broadcast');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: 'calc(100vh - 120px)' }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Megaphone size={22} /> Broadcast Messages
        </h1>
        <p style={{ color: 'var(--admin-text-muted)', fontSize: 14 }}>
          Send announcements, app updates, or warnings to dealer segments.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>
        {/* Compose Form */}
        <div className="admin-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>New Broadcast</h2>
          
          <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
            <div>
              <label className="admin-label">Message Content</label>
              <textarea
                className="admin-input"
                rows={6}
                placeholder="Type your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
              <p style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginTop: 4 }}>
                Keep it concise so it works well across in-app and WhatsApp delivery.
              </p>
            </div>

            <div>
              <label className="admin-label">Target Segment</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { id: 'all', label: 'All Dealers', icon: Users },
                  { id: 'trial', label: 'Trial Plans', icon: Users },
                  { id: 'basic', label: 'Basic Plans', icon: Users },
                  { id: 'pro', label: 'Pro Plans', icon: Users },
                ].map(seg => (
                  <label key={seg.id} style={{ 
                    display: 'flex', alignItems: 'center', gap: 8, padding: 12, 
                    border: '1px solid var(--admin-border)', borderRadius: 8, cursor: 'pointer',
                    background: targetSegment === seg.id ? 'rgba(56, 139, 253, 0.1)' : 'transparent',
                    borderColor: targetSegment === seg.id ? 'var(--admin-primary)' : 'var(--admin-border)'
                  }}>
                    <input 
                      type="radio" 
                      name="segment" 
                      value={seg.id} 
                      checked={targetSegment === seg.id} 
                      onChange={(e) => setTargetSegment(e.target.value as any)}
                      style={{ display: 'none' }}
                    />
                    <seg.icon size={16} color={targetSegment === seg.id ? 'var(--admin-primary)' : 'var(--admin-text-muted)'} />
                    <span style={{ fontSize: 13, fontWeight: targetSegment === seg.id ? 600 : 400 }}>{seg.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="admin-label">Delivery Channel</label>
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { id: 'in_app', label: 'In-App', icon: Smartphone },
                  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                  { id: 'both', label: 'Both', icon: MessageSquare },
                ].map(ch => (
                  <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="channel" 
                      value={ch.id} 
                      checked={channel === ch.id} 
                      onChange={(e) => setChannel(e.target.value as any)}
                    />
                    <ch.icon size={14} color="var(--admin-text-muted)" />
                    <span style={{ fontSize: 13 }}>{ch.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ flex: 1 }} />

            <button 
              type="submit" 
              className="admin-btn admin-btn-primary" 
              style={{ padding: 14 }}
              disabled={isPending || !message.trim()}
            >
              {isPending ? 'Sending...' : <><Send size={16} /> Send Broadcast</>}
            </button>
          </form>
        </div>

        {/* History */}
        <div className="admin-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Broadcast History</h2>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isLoading ? (
               <div style={{ padding: 40, textAlign: 'center' }}>
                 <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
               </div>
            ) : broadcasts?.length === 0 ? (
              <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
                No broadcasts sent yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pagedBroadcasts.visibleItems.map(b => (
                  <div key={b.id} style={{ padding: 16, border: '1px solid var(--admin-border)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span className="admin-badge basic">{b.target_segment}</span>
                        <span className="admin-badge trial">{b.channel}</span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>
                        {b.sent_at ? new Date(b.sent_at).toLocaleString() : 'Unknown time'}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--admin-text)', marginBottom: 12, lineHeight: 1.4 }}>
                      {b.message}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--admin-text-muted)' }}>
                      <span>Sent by {b.admin?.name || 'System'}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Users size={12}/> Delivered to {b.delivery_count} dealers
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <ListLoadMore
              shown={pagedBroadcasts.visibleCount}
              total={pagedBroadcasts.totalCount}
              onLoadMore={pagedBroadcasts.loadMore}
              label="Load more broadcasts"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminBroadcastPage;
