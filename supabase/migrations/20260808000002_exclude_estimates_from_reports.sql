-- Patch the profit report and sales register RPCs to exclude estimate bills.
-- Estimates are draft quotes: their revenue is not real, no stock was consumed,
-- and including them inflates every financial metric in these reports.

-- ── 1. get_profit_report_data ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_profit_report_data(
    p_dealer_id   UUID,
    p_branch_id   UUID,
    p_start_date  DATE,
    p_end_date    DATE,
    p_page        INT     DEFAULT 1,
    p_page_size   INT     DEFAULT 15,
    p_sort_by     TEXT    DEFAULT 'profit',
    p_sort_dir    TEXT    DEFAULT 'desc',
    p_search      TEXT    DEFAULT ''
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    v_total_revenue      NUMERIC := 0;
    v_total_cost         NUMERIC := 0;
    v_gross_profit       NUMERIC := 0;
    v_total_expenses     NUMERIC := 0;
    v_total_returns      NUMERIC := 0;
    v_net_profit         NUMERIC := 0;
    v_daily_profits      JSONB;
    v_items              JSONB;
    v_top5               JSONB;
    v_total_items        BIGINT  := 0;
    v_total_pages        INT     := 0;
    v_missing_cost_count BIGINT  := 0;
    v_offset             INT;
BEGIN
    v_offset := (p_page - 1) * p_page_size;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses
    FROM expenses
    WHERE dealer_id = p_dealer_id
      AND expense_date >= p_start_date AND expense_date <= p_end_date
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_returns
    FROM bill_returns
    WHERE dealer_id = p_dealer_id
      AND return_date >= p_start_date AND return_date <= p_end_date
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    SELECT
        COALESCE(SUM(bi.quantity * bi.unit_price), 0),
        COALESCE(SUM(bi.quantity * COALESCE(i.cost_price, 0)), 0),
        COALESCE(SUM((bi.quantity * bi.unit_price) - (bi.quantity * COALESCE(i.cost_price, 0))), 0),
        COUNT(CASE WHEN (p_search = '' OR bi.product_name_snapshot ILIKE '%' || p_search || '%') THEN bi.id END),
        COUNT(CASE WHEN COALESCE(i.cost_price, 0) = 0 THEN bi.id END)
    INTO v_total_revenue, v_total_cost, v_gross_profit, v_total_items, v_missing_cost_count
    FROM bills b
    JOIN bill_items bi ON bi.bill_id = b.id
    LEFT JOIN inventory i ON bi.inventory_id_snapshot = i.id
    WHERE b.dealer_id = p_dealer_id
      AND b.bill_date >= p_start_date AND b.bill_date <= p_end_date
      AND b.status = 'active'
      AND COALESCE(b.is_estimate, false) = false
      AND (p_branch_id IS NULL OR b.branch_id = p_branch_id);

    v_net_profit  := v_gross_profit - v_total_expenses - v_total_returns;
    v_total_pages := GREATEST(1, CEIL(v_total_items::NUMERIC / NULLIF(p_page_size, 0)));

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object('date', ds.date, 'profit', ds.profit)
        ORDER BY ds.date
    ), '[]'::jsonb)
    INTO v_daily_profits
    FROM (
        SELECT b.bill_date AS date,
               SUM((bi.quantity * bi.unit_price) - (bi.quantity * COALESCE(i.cost_price, 0))) AS profit
        FROM bills b
        JOIN bill_items bi ON bi.bill_id = b.id
        LEFT JOIN inventory i ON bi.inventory_id_snapshot = i.id
        WHERE b.dealer_id = p_dealer_id
          AND b.bill_date >= p_start_date AND b.bill_date <= p_end_date
          AND b.status = 'active'
          AND COALESCE(b.is_estimate, false) = false
          AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
        GROUP BY b.bill_date
    ) ds;

    SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb)
    INTO v_top5
    FROM (
        SELECT jsonb_build_object(
            'product_name', COALESCE(bi.product_name_snapshot, 'Unknown'),
            'profit', SUM((bi.quantity * bi.unit_price) - (bi.quantity * COALESCE(i.cost_price, 0))),
            'revenue', SUM(bi.quantity * bi.unit_price),
            'quantity', SUM(bi.quantity)
        ) AS row_data
        FROM bills b
        JOIN bill_items bi ON bi.bill_id = b.id
        LEFT JOIN inventory i ON bi.inventory_id_snapshot = i.id
        WHERE b.dealer_id = p_dealer_id
          AND b.bill_date >= p_start_date AND b.bill_date <= p_end_date
          AND b.status = 'active'
          AND COALESCE(b.is_estimate, false) = false
          AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
        GROUP BY bi.product_name_snapshot
        ORDER BY SUM((bi.quantity * bi.unit_price) - (bi.quantity * COALESCE(i.cost_price, 0))) DESC
        LIMIT 5
    ) sub;

    SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) INTO v_items
    FROM (
        SELECT jsonb_build_object(
            'id', bi.id,
            'product_name', COALESCE(bi.product_name_snapshot, 'Unknown'),
            'quantity', bi.quantity,
            'unit_price', bi.unit_price,
            'cost_price', COALESCE(i.cost_price, 0),
            'revenue', (bi.quantity * bi.unit_price),
            'cost', (bi.quantity * COALESCE(i.cost_price, 0)),
            'profit', ((bi.quantity * bi.unit_price) - (bi.quantity * COALESCE(i.cost_price, 0))),
            'bill_number', b.bill_number,
            'bill_id', b.id
        ) AS row_data
        FROM bills b
        JOIN bill_items bi ON bi.bill_id = b.id
        LEFT JOIN inventory i ON bi.inventory_id_snapshot = i.id
        WHERE b.dealer_id = p_dealer_id
          AND b.bill_date >= p_start_date AND b.bill_date <= p_end_date
          AND b.status = 'active'
          AND COALESCE(b.is_estimate, false) = false
          AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
          AND (p_search = '' OR bi.product_name_snapshot ILIKE '%' || p_search || '%')
        ORDER BY
            CASE WHEN p_sort_by = 'profit'   AND p_sort_dir = 'desc' THEN ((bi.quantity * bi.unit_price) - (bi.quantity * COALESCE(i.cost_price, 0))) END DESC,
            CASE WHEN p_sort_by = 'profit'   AND p_sort_dir = 'asc'  THEN ((bi.quantity * bi.unit_price) - (bi.quantity * COALESCE(i.cost_price, 0))) END ASC,
            CASE WHEN p_sort_by = 'revenue'  AND p_sort_dir = 'desc' THEN (bi.quantity * bi.unit_price) END DESC,
            CASE WHEN p_sort_by = 'revenue'  AND p_sort_dir = 'asc'  THEN (bi.quantity * bi.unit_price) END ASC,
            CASE WHEN p_sort_by = 'quantity' AND p_sort_dir = 'desc' THEN bi.quantity::NUMERIC END DESC,
            CASE WHEN p_sort_by = 'quantity' AND p_sort_dir = 'asc'  THEN bi.quantity::NUMERIC END ASC,
            CASE WHEN p_sort_by = 'margin'   AND p_sort_dir = 'desc' THEN
                CASE WHEN (bi.quantity * bi.unit_price) > 0 THEN
                    ((bi.quantity * bi.unit_price) - (bi.quantity * COALESCE(i.cost_price, 0))) / (bi.quantity * bi.unit_price)
                ELSE -1 END
            END DESC,
            CASE WHEN p_sort_by = 'margin'   AND p_sort_dir = 'asc'  THEN
                CASE WHEN (bi.quantity * bi.unit_price) > 0 THEN
                    ((bi.quantity * bi.unit_price) - (bi.quantity * COALESCE(i.cost_price, 0))) / (bi.quantity * bi.unit_price)
                ELSE -1 END
            END ASC,
            ((bi.quantity * bi.unit_price) - (bi.quantity * COALESCE(i.cost_price, 0))) DESC
        LIMIT p_page_size OFFSET v_offset
    ) sub2;

    RETURN jsonb_build_object(
        'items',            v_items,
        'totalRevenue',     v_total_revenue,
        'totalCost',        v_total_cost,
        'grossProfit',      v_gross_profit,
        'expenses',         v_total_expenses,
        'returns',          v_total_returns,
        'netProfit',        v_net_profit,
        'dailyProfits',     v_daily_profits,
        'top5Products',     v_top5,
        'totalItems',       v_total_items,
        'totalPages',       v_total_pages,
        'missingCostCount', v_missing_cost_count
    );
END;
$func$;

-- ── 2. get_sales_register_data ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_sales_register_data(
    p_dealer_id    UUID,
    p_branch_id    UUID,
    p_start_date   DATE,
    p_end_date     DATE,
    p_page         INT     DEFAULT 1,
    p_page_size    INT     DEFAULT 20,
    p_sort_by      TEXT    DEFAULT 'date',
    p_sort_dir     TEXT    DEFAULT 'desc',
    p_search       TEXT    DEFAULT '',
    p_payment_status TEXT  DEFAULT 'all',
    p_payment_mode TEXT    DEFAULT 'all'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    v_total_bills       BIGINT  := 0;
    v_total_revenue     NUMERIC := 0;
    v_total_gst         NUMERIC := 0;
    v_total_qty         NUMERIC := 0;
    v_paid_count        BIGINT  := 0;
    v_unpaid_count      BIGINT  := 0;
    v_partial_count     BIGINT  := 0;
    v_total_outstanding NUMERIC := 0;
    v_daily_revenue     JSONB;
    v_payment_split     JSONB;
    v_items             JSONB;
    v_total_items       BIGINT  := 0;
    v_total_pages       INT     := 0;
    v_offset            INT;
BEGIN
    v_offset := (p_page - 1) * p_page_size;

    SELECT
        COUNT(b.id),
        COALESCE(SUM(b.subtotal), 0),
        COALESCE(SUM(b.gst_amount), 0),
        COALESCE(SUM(b.balance_due), 0),
        COUNT(CASE WHEN b.balance_due <= 0 THEN 1 END),
        COUNT(CASE WHEN b.balance_due > 0 AND b.amount_paid = 0 THEN 1 END),
        COUNT(CASE WHEN b.balance_due > 0 AND b.amount_paid > 0 THEN 1 END)
    INTO v_total_bills, v_total_revenue, v_total_gst, v_total_outstanding, v_paid_count, v_unpaid_count, v_partial_count
    FROM bills b
    WHERE b.dealer_id = p_dealer_id
      AND b.bill_date >= p_start_date AND b.bill_date <= p_end_date
      AND b.status != 'cancelled'
      AND COALESCE(b.is_estimate, false) = false
      AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
      AND (p_search = '' OR (
          b.bill_number ILIKE '%' || p_search || '%' OR
          COALESCE(b.farmer_name_snapshot, '') ILIKE '%' || p_search || '%'
      ))
      AND (
          p_payment_status = 'all' OR
          (p_payment_status = 'paid' AND b.balance_due <= 0) OR
          (p_payment_status = 'unpaid' AND b.balance_due > 0 AND b.amount_paid = 0) OR
          (p_payment_status = 'partial' AND b.balance_due > 0 AND b.amount_paid > 0)
      )
      AND (
          p_payment_mode = 'all' OR
          COALESCE(b.payment_type, CASE WHEN b.amount_paid > 0 THEN 'cash' ELSE 'credit' END) ILIKE '%' || p_payment_mode || '%'
      );

    SELECT COALESCE(SUM(bi.quantity), 0)
    INTO v_total_qty
    FROM bills b
    JOIN bill_items bi ON bi.bill_id = b.id
    WHERE b.dealer_id = p_dealer_id
      AND b.bill_date >= p_start_date AND b.bill_date <= p_end_date
      AND b.status != 'cancelled'
      AND COALESCE(b.is_estimate, false) = false
      AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
      AND (p_search = '' OR (
          b.bill_number ILIKE '%' || p_search || '%' OR
          COALESCE(b.farmer_name_snapshot, '') ILIKE '%' || p_search || '%' OR
          COALESCE(bi.product_name_snapshot, '') ILIKE '%' || p_search || '%'
      ))
      AND (
          p_payment_status = 'all' OR
          (p_payment_status = 'paid' AND b.balance_due <= 0) OR
          (p_payment_status = 'unpaid' AND b.balance_due > 0 AND b.amount_paid = 0) OR
          (p_payment_status = 'partial' AND b.balance_due > 0 AND b.amount_paid > 0)
      )
      AND (
          p_payment_mode = 'all' OR
          COALESCE(b.payment_type, CASE WHEN b.amount_paid > 0 THEN 'cash' ELSE 'credit' END) ILIKE '%' || p_payment_mode || '%'
      );

    SELECT COUNT(DISTINCT b.id)
    INTO v_total_items
    FROM bills b
    LEFT JOIN bill_items bi ON bi.bill_id = b.id
    WHERE b.dealer_id = p_dealer_id
      AND b.bill_date >= p_start_date AND b.bill_date <= p_end_date
      AND b.status != 'cancelled'
      AND COALESCE(b.is_estimate, false) = false
      AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
      AND (p_search = '' OR (
          b.bill_number ILIKE '%' || p_search || '%' OR
          COALESCE(b.farmer_name_snapshot, '') ILIKE '%' || p_search || '%' OR
          COALESCE(bi.product_name_snapshot, '') ILIKE '%' || p_search || '%'
      ))
      AND (
          p_payment_status = 'all' OR
          (p_payment_status = 'paid' AND b.balance_due <= 0) OR
          (p_payment_status = 'unpaid' AND b.balance_due > 0 AND b.amount_paid = 0) OR
          (p_payment_status = 'partial' AND b.balance_due > 0 AND b.amount_paid > 0)
      )
      AND (
          p_payment_mode = 'all' OR
          COALESCE(b.payment_type, CASE WHEN b.amount_paid > 0 THEN 'cash' ELSE 'credit' END) ILIKE '%' || p_payment_mode || '%'
      );

    v_total_pages := GREATEST(1, CEIL(v_total_items::NUMERIC / NULLIF(p_page_size, 0)));

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object('date', ds.date, 'revenue', ds.revenue)
        ORDER BY ds.date
    ), '[]'::jsonb)
    INTO v_daily_revenue
    FROM (
        SELECT b.bill_date AS date,
               SUM(b.subtotal) AS revenue
        FROM bills b
        WHERE b.id IN (
            SELECT DISTINCT b_inner.id
            FROM bills b_inner
            LEFT JOIN bill_items bi_inner ON bi_inner.bill_id = b_inner.id
            WHERE b_inner.dealer_id = p_dealer_id
              AND b_inner.bill_date >= p_start_date AND b_inner.bill_date <= p_end_date
              AND b_inner.status != 'cancelled'
              AND COALESCE(b_inner.is_estimate, false) = false
              AND (p_branch_id IS NULL OR b_inner.branch_id = p_branch_id)
              AND (p_search = '' OR (
                  b_inner.bill_number ILIKE '%' || p_search || '%' OR
                  COALESCE(b_inner.farmer_name_snapshot, '') ILIKE '%' || p_search || '%' OR
                  COALESCE(bi_inner.product_name_snapshot, '') ILIKE '%' || p_search || '%'
              ))
              AND (
                  p_payment_status = 'all' OR
                  (p_payment_status = 'paid' AND b_inner.balance_due <= 0) OR
                  (p_payment_status = 'unpaid' AND b_inner.balance_due > 0 AND b_inner.amount_paid = 0) OR
                  (p_payment_status = 'partial' AND b_inner.balance_due > 0 AND b_inner.amount_paid > 0)
              )
              AND (
                  p_payment_mode = 'all' OR
                  COALESCE(b_inner.payment_type, CASE WHEN b_inner.amount_paid > 0 THEN 'cash' ELSE 'credit' END) ILIKE '%' || p_payment_mode || '%'
              )
        )
        GROUP BY b.bill_date
    ) ds;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object('mode', ds.mode, 'amount', ds.amount)
        ORDER BY ds.amount DESC
    ), '[]'::jsonb)
    INTO v_payment_split
    FROM (
        SELECT COALESCE(NULLIF(b.payment_type, ''), CASE WHEN b.amount_paid > 0 THEN 'cash' ELSE 'credit' END) AS mode,
               SUM(b.total) AS amount
        FROM bills b
        WHERE b.id IN (
            SELECT DISTINCT b_inner.id
            FROM bills b_inner
            LEFT JOIN bill_items bi_inner ON bi_inner.bill_id = b_inner.id
            WHERE b_inner.dealer_id = p_dealer_id
              AND b_inner.bill_date >= p_start_date AND b_inner.bill_date <= p_end_date
              AND b_inner.status != 'cancelled'
              AND COALESCE(b_inner.is_estimate, false) = false
              AND (p_branch_id IS NULL OR b_inner.branch_id = p_branch_id)
              AND (p_search = '' OR (
                  b_inner.bill_number ILIKE '%' || p_search || '%' OR
                  COALESCE(b_inner.farmer_name_snapshot, '') ILIKE '%' || p_search || '%' OR
                  COALESCE(bi_inner.product_name_snapshot, '') ILIKE '%' || p_search || '%'
              ))
              AND (
                  p_payment_status = 'all' OR
                  (p_payment_status = 'paid' AND b_inner.balance_due <= 0) OR
                  (p_payment_status = 'unpaid' AND b_inner.balance_due > 0 AND b_inner.amount_paid = 0) OR
                  (p_payment_status = 'partial' AND b_inner.balance_due > 0 AND b_inner.amount_paid > 0)
              )
              AND (
                  p_payment_mode = 'all' OR
                  COALESCE(b_inner.payment_type, CASE WHEN b_inner.amount_paid > 0 THEN 'cash' ELSE 'credit' END) ILIKE '%' || p_payment_mode || '%'
              )
        )
        GROUP BY COALESCE(NULLIF(b.payment_type, ''), CASE WHEN b.amount_paid > 0 THEN 'cash' ELSE 'credit' END)
    ) ds;

    SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) INTO v_items
    FROM (
        SELECT jsonb_build_object(
            'id', b.id,
            'date', b.bill_date,
            'invoiceNo', b.bill_number,
            'customerName', COALESCE(b.farmer_name_snapshot, 'Walk-in Customer'),
            'taxableValue', b.subtotal,
            'gstAmount', b.gst_amount,
            'totalAmount', b.subtotal + b.gst_amount,
            'amountPaid', b.amount_paid,
            'balanceDue', b.balance_due,
            'paymentMode', COALESCE(NULLIF(b.payment_type, ''), CASE WHEN b.amount_paid > 0 THEN 'cash' ELSE 'credit' END),
            'itemsString', (
                SELECT string_agg(bi_sub.product_name_snapshot, ', ')
                FROM bill_items bi_sub WHERE bi_sub.bill_id = b.id
            ),
            'totalQty', (
                SELECT COALESCE(SUM(bi_sub.quantity), 0)
                FROM bill_items bi_sub WHERE bi_sub.bill_id = b.id
            )
        ) AS row_data
        FROM bills b
        WHERE b.id IN (
            SELECT DISTINCT b_inner.id
            FROM bills b_inner
            LEFT JOIN bill_items bi_inner ON bi_inner.bill_id = b_inner.id
            WHERE b_inner.dealer_id = p_dealer_id
              AND b_inner.bill_date >= p_start_date AND b_inner.bill_date <= p_end_date
              AND b_inner.status != 'cancelled'
              AND COALESCE(b_inner.is_estimate, false) = false
              AND (p_branch_id IS NULL OR b_inner.branch_id = p_branch_id)
              AND (p_search = '' OR (
                  b_inner.bill_number ILIKE '%' || p_search || '%' OR
                  COALESCE(b_inner.farmer_name_snapshot, '') ILIKE '%' || p_search || '%' OR
                  COALESCE(bi_inner.product_name_snapshot, '') ILIKE '%' || p_search || '%'
              ))
              AND (
                  p_payment_status = 'all' OR
                  (p_payment_status = 'paid' AND b_inner.balance_due <= 0) OR
                  (p_payment_status = 'unpaid' AND b_inner.balance_due > 0 AND b_inner.amount_paid = 0) OR
                  (p_payment_status = 'partial' AND b_inner.balance_due > 0 AND b_inner.amount_paid > 0)
              )
              AND (
                  p_payment_mode = 'all' OR
                  COALESCE(b_inner.payment_type, CASE WHEN b_inner.amount_paid > 0 THEN 'cash' ELSE 'credit' END) ILIKE '%' || p_payment_mode || '%'
              )
        )
        ORDER BY
            CASE WHEN p_sort_by = 'date'     AND p_sort_dir = 'desc' THEN b.bill_date END DESC,
            CASE WHEN p_sort_by = 'date'     AND p_sort_dir = 'asc'  THEN b.bill_date END ASC,
            CASE WHEN p_sort_by = 'amount'   AND p_sort_dir = 'desc' THEN (b.subtotal + b.gst_amount) END DESC,
            CASE WHEN p_sort_by = 'amount'   AND p_sort_dir = 'asc'  THEN (b.subtotal + b.gst_amount) END ASC,
            CASE WHEN p_sort_by = 'customer' AND p_sort_dir = 'desc' THEN COALESCE(b.farmer_name_snapshot, '') END DESC,
            CASE WHEN p_sort_by = 'customer' AND p_sort_dir = 'asc'  THEN COALESCE(b.farmer_name_snapshot, '') END ASC,
            b.created_at DESC
        LIMIT p_page_size OFFSET v_offset
    ) sub;

    RETURN jsonb_build_object(
        'items',      v_items,
        'summary',    jsonb_build_object(
            'totalBills',       v_total_bills,
            'totalRevenue',     v_total_revenue,
            'totalGst',         v_total_gst,
            'totalQty',         v_total_qty,
            'paidCount',        v_paid_count,
            'unpaidCount',      v_unpaid_count,
            'partialCount',     v_partial_count,
            'totalOutstanding', v_total_outstanding
        ),
        'charts',     jsonb_build_object(
            'dailyRevenue', v_daily_revenue,
            'paymentSplit', v_payment_split
        ),
        'pagination', jsonb_build_object(
            'totalItems',  v_total_items,
            'totalPages',  v_total_pages,
            'currentPage', p_page
        )
    );
END;
$func$;

NOTIFY pgrst, 'reload schema';
