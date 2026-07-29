import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCheckout } from './useCheckout';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '@/stores/authStore';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }) },
    from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), lte: vi.fn().mockResolvedValue({ data: [] }) })),
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useCheckout credit limit guard', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'u1', bill_signature_enabled: false } as any });
    useCartStore.setState({
      items: [{ inventory_id: 'i1', product_id: 'p1', product_name: 'Feed', hsn_code: '', quantity: 1, base_unit_price: 100, discount_percentage: 0, gst_rate: 0, mrp: null, discount_source: 'default', discount_label: '', default_discount_percentage: 0, farmer_discount_percentage: 0, product_type: 'feed' } as any],
      farmerId: 'f1',
      farmerName: 'Ravi',
      farmerTotalDue: 9000,
      farmerCreditLimit: 9000, // below projectedDue (9100) so the guard actually fires
      amountPaid: 0,
      paymentType: 'credit',
      discountAmount: 0,
      settlementDiscountAmount: 0,
    } as any);
  });

  it('blocks checkout with a warning instead of silently overriding the limit', async () => {
    const { result } = renderHook(() => useCheckout(), { wrapper });
    await act(async () => {
      await result.current.handleCheckout({
        totals: { subtotal: 100, gstAmount: 0, total: 100 },
        onSuccess: vi.fn(),
      });
    });
    expect(result.current.creditLimitWarning?.show).toBe(true);
    expect(result.current.creditLimitWarning?.projectedDue).toBe(9100);
  });
});
