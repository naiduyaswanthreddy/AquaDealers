import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentStep } from './PaymentStep';
import { useCartStore } from '../stores/cartStore';

describe('PaymentStep settlement discount', () => {
  beforeEach(() => {
    useCartStore.setState({
      items: [{ inventory_id: 'i1', product_id: 'p1', product_name: 'Feed', hsn_code: '', quantity: 1, base_unit_price: 1000, discount_percentage: 0, gst_rate: 0, mrp: null, discount_source: 'default', discount_label: '', default_discount_percentage: 0, farmer_discount_percentage: 0, product_type: 'feed' } as any],
      farmerId: null,
      farmerName: null,
      farmerTotalDue: 0,
      farmerCreditLimit: 0,
      amountPaid: 1000,
      paymentType: 'cash',
      discountAmount: 0,
      settlementDiscountAmount: 0,
      notes: '',
      upiRef: '',
      chequeNumber: '',
      gstEnabled: false,
    } as any);
  });

  it('does not overwrite a manually-typed partial amount when a settlement discount is added', () => {
    render(<PaymentStep onNext={() => {}} />);
    const amountInput = screen.getByDisplayValue('1000');
    fireEvent.change(amountInput, { target: { value: '600' } });

    const discountInput = screen.getAllByPlaceholderText('0.00')[1];
    fireEvent.change(discountInput, { target: { value: '50' } });

    expect(useCartStore.getState().amountPaid).toBe(600);
  });

  it('still auto-fills amountPaid when the dealer has not touched it', () => {
    render(<PaymentStep onNext={() => {}} />);
    const discountInput = screen.getAllByPlaceholderText('0.00')[1];
    fireEvent.change(discountInput, { target: { value: '50' } });
    expect(useCartStore.getState().amountPaid).toBe(950);
  });
});
