-- Atomically inserts an expense row and its cash_book entry in a single transaction,
-- eliminating the compensating-delete race window in the client-side implementation.
CREATE OR REPLACE FUNCTION record_expense_v1(p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO expenses (dealer_id, branch_id, category, description, amount, paid_via, expense_date)
  VALUES (
    (p_payload->>'dealer_id')::uuid,
    NULLIF(p_payload->>'branch_id', '')::uuid,
    p_payload->>'category',
    p_payload->>'description',
    (p_payload->>'amount')::numeric,
    COALESCE(NULLIF(p_payload->>'paid_via', ''), 'cash'),
    (p_payload->>'expense_date')::date
  ) RETURNING id INTO v_id;

  INSERT INTO cash_book (dealer_id, branch_id, entry_type, source, amount, notes, entry_date)
  VALUES (
    (p_payload->>'dealer_id')::uuid,
    NULLIF(p_payload->>'branch_id', '')::uuid,
    'expense',
    'general_expense',
    (p_payload->>'amount')::numeric,
    '[' || (p_payload->>'category') || '] ' || (p_payload->>'description'),
    (p_payload->>'expense_date')::date
  );

  RETURN v_id;
END;
$$;
