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
    v_total_revenue     NUMERIC := 0;
    v_total_cost        NUMERIC := 0;
    v_gross_profit      NUMERIC := 0;
    v_total_expenses    NUMERIC := 0;
    v_total_returns     NUMERIC := 0;
    v_net_profit        NUMERIC := 0;
    v_daily_profits     JSONB;
    v_items             JSONB;
    v_top5              JSONB;
    v_total_items       BIGINT  := 0;
    v_total_pages       INT     := 0;
    v_missing_cost_count BIGINT := 0;
    v_offset            INT;
BEGIN
    v_offset := (p_page - 1) * p_page_size;

    -- Expenses
    SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses
    FROM expenses
    WHERE dealer_id = p_dealer_id
      AND expense_date >= p_start_date AND expense_date <= p_end_date
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    -- Returns
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_returns
    FROM bill_returns
    WHERE dealer_id = p_dealer_id
      AND return_date >= p_start_date AND return_date <= p_end_date
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    -- Totals (across ALL items, no search filter for aggregates)
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
      AND (p_branch_id IS NULL OR b.branch_id = p_branch_id);

    v_net_profit  := v_gross_profit - v_total_expenses - v_total_returns;
    v_total_pages := GREATEST(1, CEIL(v_total_items::NUMERIC / NULLIF(p_page_size, 0)));

    -- Daily profits for line chart
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
          AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
        GROUP BY b.bill_date
    ) ds;

    -- Top 5 products by profit (for bar chart)
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
          AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
        GROUP BY bi.product_name_snapshot
        ORDER BY SUM((bi.quantity * bi.unit_price) - (bi.quantity * COALESCE(i.cost_price, 0))) DESC
        LIMIT 5
    ) sub;

    -- Paginated + filtered + sorted items
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