CREATE OR REPLACE FUNCTION public.recalculate_farmer_due_v1(p_farmer_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_due NUMERIC;
BEGIN
  SELECT GREATEST(0,
    COALESCE(f.opening_balance, 0)
    + COALESCE((SELECT SUM(b.balance_due) FROM public.bills b WHERE b.farmer_id=f.id AND b.deleted_at IS NULL AND b.status<>'cancelled'), 0)
    - COALESCE((
      SELECT SUM(p.amount-COALESCE((SELECT SUM(a.allocated_amount) FROM public.payment_allocations a WHERE a.payment_id=p.id),0))
      FROM public.payments p
      WHERE p.farmer_id=f.id OR p.bill_id IN (SELECT id FROM public.bills WHERE farmer_id=f.id AND deleted_at IS NULL)
    ), 0)
    - COALESCE(f.return_credit_balance, 0)
  ) INTO v_due FROM public.farmers f WHERE f.id=p_farmer_id FOR UPDATE;
  UPDATE public.farmers SET total_due=v_due WHERE id=p_farmer_id;
  RETURN v_due;
END; $$;

SELECT public.recalculate_farmer_due_v1(id) FROM public.farmers;
NOTIFY pgrst, 'reload schema';
