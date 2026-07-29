import { describe, it, expect, beforeEach } from 'vitest';

describe('impersonation read-only guard', () => {
  beforeEach(async () => {
    const mod = await import('./supabase');
    (mod as any).setImpersonating(false);
  });

  it('blocks a mutating table request while impersonating', async () => {
    const { setImpersonating } = await import('./supabase') as any;
    setImpersonating(true);
    const { isBlockedByImpersonation } = await import('./supabase') as any;
    expect(isBlockedByImpersonation('https://x.supabase.co/rest/v1/dealers?id=eq.1', 'PATCH')).toBe(true);
  });

  it('allows GET requests while impersonating', async () => {
    const { setImpersonating, isBlockedByImpersonation } = await import('./supabase') as any;
    setImpersonating(true);
    expect(isBlockedByImpersonation('https://x.supabase.co/rest/v1/dealers?id=eq.1', 'GET')).toBe(false);
  });

  it('allows read-style RPCs (get_*) while impersonating', async () => {
    const { setImpersonating, isBlockedByImpersonation } = await import('./supabase') as any;
    setImpersonating(true);
    expect(isBlockedByImpersonation('https://x.supabase.co/rest/v1/rpc/get_dashboard_aggregates', 'POST')).toBe(false);
  });

  it('blocks write-style RPCs while impersonating', async () => {
    const { setImpersonating, isBlockedByImpersonation } = await import('./supabase') as any;
    setImpersonating(true);
    expect(isBlockedByImpersonation('https://x.supabase.co/rest/v1/rpc/create_bill', 'POST')).toBe(true);
  });

  it('does not block anything when not impersonating', async () => {
    const { setImpersonating, isBlockedByImpersonation } = await import('./supabase') as any;
    setImpersonating(false);
    expect(isBlockedByImpersonation('https://x.supabase.co/rest/v1/dealers?id=eq.1', 'PATCH')).toBe(false);
  });
});
