CREATE OR REPLACE FUNCTION public.recalculate_farmer_due_v1(p_farmer_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_due NUMERIC;
BEGIN
  SELECT GREATEST(0,
    COALESCE(f.opening_balance, 0)
    + COALESCE((SELECT SUM(b.balance_due) FROM public.bills b WHERE b.farmer_id=f.id AND b.deleted_at IS NULL AND b.status<>'cancelled'), 0)
    - COALESCE((SELECT SUM(p.amount)-COALESCE(SUM(a.allocated_amount),0) FROM public.payments p LEFT JOIN public.payment_allocations a ON a.payment_id=p.id WHERE p.farmer_id=f.id), 0)
    - COALESCE(f.return_credit_balance, 0)
  ) INTO v_due FROM public.farmers f WHERE f.id=p_farmer_id FOR UPDATE;
  UPDATE public.farmers SET total_due=v_due WHERE id=p_farmer_id;
  RETURN v_due;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_recalculate_farmer_due_from_bill_v1()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.recalculate_farmer_due_v1(COALESCE(NEW.farmer_id, OLD.farmer_id));
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE OR REPLACE FUNCTION public.trg_recalculate_farmer_due_from_payment_v1()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP<>'INSERT' AND OLD.farmer_id IS NOT NULL THEN PERFORM public.recalculate_farmer_due_v1(OLD.farmer_id); END IF;
  IF TG_OP<>'DELETE' AND NEW.farmer_id IS NOT NULL THEN PERFORM public.recalculate_farmer_due_v1(NEW.farmer_id); END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE OR REPLACE FUNCTION public.trg_recalculate_farmer_due_from_allocation_v1()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_farmer_id UUID;
BEGIN
  SELECT farmer_id INTO v_farmer_id FROM public.payments WHERE id=COALESCE(NEW.payment_id,OLD.payment_id);
  IF v_farmer_id IS NOT NULL THEN PERFORM public.recalculate_farmer_due_v1(v_farmer_id); END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS farmer_due_from_bill ON public.bills;
CREATE TRIGGER farmer_due_from_bill AFTER INSERT OR UPDATE OF balance_due,status OR DELETE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.trg_recalculate_farmer_due_from_bill_v1();
DROP TRIGGER IF EXISTS farmer_due_from_payment ON public.payments;
CREATE TRIGGER farmer_due_from_payment AFTER INSERT OR UPDATE OF amount,farmer_id OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.trg_recalculate_farmer_due_from_payment_v1();
DROP TRIGGER IF EXISTS farmer_due_from_payment_allocation ON public.payment_allocations;
CREATE TRIGGER farmer_due_from_payment_allocation AFTER INSERT OR UPDATE OF allocated_amount OR DELETE ON public.payment_allocations FOR EACH ROW EXECUTE FUNCTION public.trg_recalculate_farmer_due_from_allocation_v1();

SELECT public.recalculate_farmer_due_v1(id) FROM public.farmers;
NOTIFY pgrst, 'reload schema';
