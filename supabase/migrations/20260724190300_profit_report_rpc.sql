CREATE OR REPLACE FUNCTION get_profit_report_data(
    p_dealer_id UUID,
    p_branch_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_page INT,
    p_page_size INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    v_total_revenue NUMERIC := 0;
    v_total_cost NUMERIC := 0;
    v_gross_profit NUMERIC := 0;
    v_total_expenses NUMERIC := 0;
    v_total_returns NUMERIC := 0;
    v_net_profit NUMERIC := 0;
    v_daily_profits JSONB;
    v_items JSONB;
    v_total_items BIGINT := 0;
    v_total_pages INT := 0;
    v_offset INT;
BEGIN
    v_offset := (p_page - 1) * p_page_size;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses
    FROM expenses
    WHERE dealer_id = p_dealer_id
      AND expense_date >= p_start_date
      AND expense_date <= p_end_date
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_returns
    FROM bill_returns
    WHERE dealer_id = p_dealer_id
      AND return_date >= p_start_date
      AND return_date <= p_end_date
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    SELECT
        COALESCE(SUM(bi.quantity * bi.unit_price), 0),
        COALESCE(SUM(bi.quantity * COALESCE(i.cost_price, 0)), 0),
        COALESCE(SUM((bi.quantity * bi.unit_price) - (bi.quantity * COALESCE(i.cost_price, 0))), 0),
        COUNT(bi.id)
    INTO v_total_revenue, v_total_cost, v_gross_profit, v_total_items
    FROM bills b
    JOIN bill_items bi ON bi.bill_id = b.id
    LEFT JOIN inventory i ON bi.inventory_id_snapshot = i.id
    WHERE b.dealer_id = p_dealer_id
      AND b.bill_date >= p_start_date
      AND b.bill_date <= p_end_date
      AND b.status = 'active'
      AND (p_branch_id IS NULL OR b.branch_id = p_branch_id);

    v_net_profit := v_gross_profit - v_total_expenses - v_total_returns;
    v_total_pages := GREATEST(1, CEIL(v_total_items::NUMERIC / NULLIF(p_page_size, 0)));

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object('date', ds.date, 'profit', ds.profit)
        ORDER BY ds.date
    ), '[]'::jsonb)
    INTO v_daily_profits
    FROM (
        SELECT
            b.bill_date AS date,
            SUM((bi.quantity * bi.unit_price) - (bi.quantity * COALESCE(i.cost_price, 0))) AS profit
        FROM bills b
        JOIN bill_items bi ON bi.bill_id = b.id
        LEFT JOIN inventory i ON bi.inventory_id_snapshot = i.id
        WHERE b.dealer_id = p_dealer_id
          AND b.bill_date >= p_start_date
          AND b.bill_date <= p_end_date
          AND b.status = 'active'
          AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
        GROUP BY b.bill_date
    ) ds;

    SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) INTO v_items
    FROM (
        SELECT jsonb_build_object(
            'id', bi.id,
            'product_name', bi.product_name_snapshot,
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
          AND b.bill_date >= p_start_date
          AND b.bill_date <= p_end_date
          AND b.status = 'active'
          AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
        ORDER BY ((bi.quantity * bi.unit_price) - (bi.quantity * COALESCE(i.cost_price, 0))) DESC
        LIMIT p_page_size
        OFFSET v_offset
    ) sub;

    RETURN jsonb_build_object(
        'items',        v_items,
        'totalRevenue', v_total_revenue,
        'totalCost',    v_total_cost,
        'grossProfit',  v_gross_profit,
        'expenses',     v_total_expenses,
        'returns',      v_total_returns,
        'netProfit',    v_net_profit,
        'dailyProfits', v_daily_profits,
        'totalItems',   v_total_items,
        'totalPages',   v_total_pages
    );
END;
$func$;