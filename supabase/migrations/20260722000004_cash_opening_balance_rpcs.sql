-- Server-side opening balance for the cash book ledger (simple income/expense net sum).
-- Replaces client-side paginated loop in getCashBookEntries.
CREATE OR REPLACE FUNCTION get_cash_book_opening_balance_v1(
  p_dealer_id  uuid,
  p_branch_id  uuid,
  p_before_date date
) RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(SUM(
    CASE WHEN entry_type = 'income' THEN amount ELSE -amount END
  ), 0)
  FROM cash_book
  WHERE dealer_id = p_dealer_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND entry_date < p_before_date;
$$;

-- Server-side cash-classified opening balance for daily cash clarity.
-- Mirrors the client-side classifyCashEntry + counterCashChange logic:
--   income via cash/empty   →  +amount
--   income via upi/cheque   →  0
--   expense via cash/empty  →  -amount
--   expense via non-cash    →  0
-- Replaces the unbounded .lte('entry_date', date) fetch in getDailyCashClarity.
CREATE OR REPLACE FUNCTION get_cash_clarity_opening_v1(
  p_dealer_id  uuid,
  p_branch_id  uuid,
  p_date       date
) RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN cb.entry_type = 'income' THEN
        CASE
          WHEN LOWER(TRIM(COALESCE(p.method, sp.method, 'cash')))
               IN ('upi','gpay','phonepe','paytm','cheque','check') THEN 0
          ELSE cb.amount
        END
      ELSE
        CASE
          WHEN LOWER(TRIM(COALESCE(p.method, sp.method, 'cash')))
               NOT IN ('cash','') THEN 0
          ELSE -cb.amount
        END
    END
  ), 0)
  FROM cash_book cb
  LEFT JOIN payments p          ON p.id  = cb.reference_id
  LEFT JOIN supplier_payments sp ON sp.id = cb.reference_id
  WHERE cb.dealer_id = p_dealer_id
    AND (p_branch_id IS NULL OR cb.branch_id = p_branch_id)
    AND cb.entry_date < p_date;
$$;
