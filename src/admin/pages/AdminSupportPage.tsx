import React, { useState } from 'react';
import { useAdminTickets, useResolveTicket } from '@/admin/hooks/useAdminCommunication';
import { useAdminAuthStore } from '@/admin/stores/adminAuthStore';
import { LifeBuoy, CheckCircle, Clock, Send } from 'lucide-react';
import { SupportTicket } from '@/admin/types';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { useLoadMoreList } from '@/lib/useLoadMoreList';

const AdminSupportPage: React.FC = () => {
  const [filter, setFilter] = useState<'open' | 'resolved'>('open');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState('');

  const { adminUser } = useAdminAuthStore();
  const { data: tickets, isLoading } = useAdminTickets(filter);
  const { mutateAsync: resolveTicket, isPending } = useResolveTicket();
  const pagedTickets = useLoadMoreList(tickets || [], {
    initialCount: 8,
    step: 8,
    resetDeps: [filter, tickets?.length || 0],
  });

  const handleResolve = async () => {
    if (!selectedTicket || !reply.trim() || !adminUser) return;
    try {
      await resolveTicket({
        ticketId: selectedTicket.id,
        reply,
        adminId: adminUser.id,
      });
      setSelectedTicket(null);
      setReply('');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: 'calc(100vh - 120px)' }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <LifeBuoy size={22} /> Support Inbox
        </h1>
        <p style={{ color: 'var(--admin-text-muted)', fontSize: 14 }}>
          Manage and respond to dealer help requests.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>
        {/* Ticket List (Left Column) */}
        <div className="admin-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--admin-border)' }}>
            <button
              onClick={() => setFilter('open')}
              style={{
                flex: 1, padding: 12, background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer',
                color: filter === 'open' ? 'var(--admin-accent)' : 'var(--admin-text-muted)',
                borderBottom: filter === 'open' ? '2px solid var(--admin-accent)' : '2px solid transparent'
              }}
            >
              Open Tickets
            </button>
            <button
              onClick={() => setFilter('resolved')}
              style={{
                flex: 1, padding: 12, background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer',
                color: filter === 'resolved' ? 'var(--admin-text)' : 'var(--admin-text-muted)',
                borderBottom: filter === 'resolved' ? '2px solid var(--admin-text)' : '2px solid transparent'
              }}
            >
              Resolved
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isLoading ? (
               <div style={{ padding: 40, textAlign: 'center' }}>
                 <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
               </div>
            ) : tickets?.length === 0 ? (
               <div style={{ padding: 40, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
                 {filter === 'open' ? 'Inbox Zero! 🎉 No open tickets.' : 'No resolved tickets found.'}
               </div>
            ) : (
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                 {pagedTickets.visibleItems.map(ticket => (
                   <div 
                     key={ticket.id}
                     onClick={() => { setSelectedTicket(ticket); setReply(''); }}
                     style={{
                       padding: 16,
                       borderBottom: '1px solid var(--admin-border)',
                       background: selectedTicket?.id === ticket.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                       cursor: 'pointer'
                     }}
                   >
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                       <span style={{ fontWeight: 600, fontSize: 13 }}>{ticket.subject}</span>
                       <span style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>
                         {new Date(ticket.created_at).toLocaleDateString()}
                       </span>
                     </div>
                     <p style={{ fontSize: 12, color: 'var(--admin-text-muted)', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                       {ticket.message}
                     </p>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                       <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--admin-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 'bold' }}>
                         {ticket.dealers?.name?.charAt(0)}
                       </div>
                       <span style={{ fontSize: 11 }}>{ticket.dealers?.shop_name}</span>
                     </div>
                   </div>
                 ))}
               </div>
            )}
            <ListLoadMore
              shown={pagedTickets.visibleCount}
              total={pagedTickets.totalCount}
              onLoadMore={pagedTickets.loadMore}
              label="Load more tickets"
            />
          </div>
        </div>

        {/* Ticket Detail (Right Column) */}
        <div className="admin-card" style={{ flex: 1.5, display: 'flex', flexDirection: 'column', padding: 0 }}>
          {selectedTicket ? (
            <>
              <div style={{ padding: 24, borderBottom: '1px solid var(--admin-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selectedTicket.subject}</h2>
                    <p style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>
                      Ticket #{selectedTicket.id.slice(0, 8)} • Opened {new Date(selectedTicket.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`admin-badge ${selectedTicket.status === 'open' ? 'pro' : 'basic'}`}>
                    {selectedTicket.status === 'open' ? <><Clock size={12}/> Open</> : <><CheckCircle size={12}/> Resolved</>}
                  </span>
                </div>
                
                <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontSize: 14, lineHeight: 1.5 }}>
                  {selectedTicket.message}
                </div>
              </div>

              <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
                {selectedTicket.status === 'resolved' ? (
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-success)', marginBottom: 12 }}>
                      Resolution Reply
                    </h3>
                    <div style={{ padding: 16, background: 'var(--admin-success-bg)', border: '1px solid var(--admin-success)', borderRadius: 8, color: 'var(--admin-text)', fontSize: 14, lineHeight: 1.5 }}>
                      {selectedTicket.admin_reply}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Your Reply</h3>
                    <textarea 
                      className="admin-input" 
                      rows={6}
                      placeholder="Type your resolution reply here. This will be visible to the dealer and mark the ticket as resolved."
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      style={{ resize: 'vertical' }}
                    />
                    <button 
                      className="admin-btn admin-btn-primary" 
                      style={{ alignSelf: 'flex-end' }}
                      onClick={handleResolve}
                      disabled={isPending || !reply.trim()}
                    >
                      {isPending ? 'Resolving...' : <><Send size={16}/> Resolve Ticket</>}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-text-muted)' }}>
              Select a ticket to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSupportPage;
