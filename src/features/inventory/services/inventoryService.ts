import { supabase } from '@/lib/supabase';
import {
  InventoryDetailData,
  InventoryItem,
  InventoryMonthlySeriesItem,
  InventoryMovementDetail,
  PurchaseDetailData,
} from '../types';
import { Bill, InventoryLot, InventoryMovement, Product, ProductInsert, StockPurchase, Supplier } from '@/types/database';

const getMonthKey = (dateValue: string) => {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
};

const mapInventoryItem = (item: any): InventoryItem => ({
  ...item,
  product: item.products as Product,
});

const buildInventoryAnalytics = (
  inventory: InventoryItem,
  lots: InventoryLot[],
  movements: InventoryMovementDetail[]
): Pick<InventoryDetailData, 'summary' | 'monthlySeries'> => {
  const monthlyMap = new Map<string, InventoryMonthlySeriesItem>();
  let totalReceived = 0;
  let totalIssued = 0;
  let totalAdjustedIn = 0;
  let totalAdjustedOut = 0;

  movements.forEach((movement) => {
    const monthKey = getMonthKey(movement.created_at);
    const monthEntry = monthlyMap.get(monthKey) || {
      month: formatMonthLabel(monthKey),
      received: 0,
      sold: 0,
      adjustedIn: 0,
      adjustedOut: 0,
      cancelledBack: 0,
      net: 0,
    };

    const quantity = Math.abs(Number(movement.quantity_change || 0));

    if (movement.reference_type === 'purchase') {
      monthEntry.received += quantity;
      totalReceived += quantity;
    } else if (movement.reference_type === 'bill') {
      monthEntry.sold += quantity;
      totalIssued += quantity;
    } else if (movement.reference_type === 'bill_cancellation') {
      monthEntry.cancelledBack += quantity;
      totalReceived += quantity;
    } else if (movement.reference_type === 'manual_adjustment') {
      if (movement.quantity_change >= 0) {
        monthEntry.adjustedIn += quantity;
        totalAdjustedIn += quantity;
      } else {
        monthEntry.adjustedOut += quantity;
        totalAdjustedOut += quantity;
      }
    }

    monthEntry.net =
      monthEntry.received +
      monthEntry.adjustedIn +
      monthEntry.cancelledBack -
      monthEntry.sold -
      monthEntry.adjustedOut;

    monthlyMap.set(monthKey, monthEntry);
  });

  const estimatedPrice = Number(inventory.selling_price || inventory.product.default_price || 0);
  const availableLots = lots.filter((lot) => Number(lot.remaining_quantity || 0) > 0).length;

  // Robust fallback: if movements are empty or don't cover the lots, calculate from lots
  const totalReceivedFromLots = lots.reduce((acc, lot) => acc + Number(lot.quantity_received || 0), 0);
  const finalTotalReceived = Math.max(totalReceived, totalReceivedFromLots);

  return {
    summary: {
      currentStock: Number(inventory.quantity_in_stock || 0),
      lowStockThreshold: inventory.min_stock_alert ?? null,
      availableLots,
      totalReceived: finalTotalReceived,
      totalIssued,
      totalAdjustedIn,
      totalAdjustedOut,
      estimatedStockValue: estimatedPrice > 0 ? estimatedPrice * Number(inventory.quantity_in_stock || 0) : null,
      lastMovementAt: movements[0]?.created_at ?? null,
    },
    monthlySeries: Array.from(monthlyMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, value]) => value),
  };
};

const enrichInventoryMovements = (
  movements: InventoryMovement[],
  bills: Bill[],
  purchases: StockPurchase[],
  suppliers: Supplier[]
): InventoryMovementDetail[] => {
  const billMap = new Map(bills.map((bill) => [bill.id, bill]));
  const purchaseMap = new Map(purchases.map((purchase) => [purchase.id, purchase]));
  const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier]));

  return movements.map((movement) => {
    const bill = movement.reference_id ? billMap.get(movement.reference_id) : null;
    const purchase = movement.reference_id ? purchaseMap.get(movement.reference_id) : null;
    const purchaseSupplier = purchase?.supplier_id ? supplierMap.get(purchase.supplier_id) : null;

    return {
      ...movement,
      bill: bill
        ? {
            id: bill.id,
            bill_number: bill.bill_number,
            bill_date: bill.bill_date,
            farmer_name_snapshot: bill.farmer_name_snapshot,
            status: bill.status,
          }
        : null,
      purchase: purchase
        ? {
            id: purchase.id,
            purchase_date: purchase.purchase_date,
            invoice_number: purchase.invoice_number,
            supplier_id: purchase.supplier_id,
            supplier_name: purchaseSupplier?.name ?? null,
            total_amount: purchase.total_amount,
            quantity: purchase.quantity,
            batch_number: purchase.batch_number,
            expiry_date: purchase.expiry_date,
            cost_price_per_unit: purchase.cost_price_per_unit,
            is_paid: purchase.is_paid,
            notes: purchase.notes,
          }
        : null,
    };
  });
};

export const inventoryService = {
  async getInventory(
    dealerId: string,
    branchId?: string | null,
    options?: { 
      page?: number; 
      limit?: number;
      searchQuery?: string;
      productType?: string;
      lowStockOnly?: boolean;
    }
  ): Promise<{ data: InventoryItem[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('inventory')
      .select('*, products!inner(*)', { count: 'exact' })
      .eq('dealer_id', dealerId)
      .order('updated_at', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    
    if (options?.searchQuery) {
      const search = options.searchQuery.toLowerCase();
      query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%`, { referencedTable: 'products' });
    }

    if (options?.productType && options.productType !== 'all') {
      query = query.eq('products.type', options.productType);
    }

    // Since lowStock logic involves comparing quantity_in_stock <= min_stock_alert, 
    // and both columns are on the inventory table, we can write a raw sql or filter it if we pull it.
    // Supabase JS doesn't support comparing two columns directly without a view/rpc. 
    // For now, we will return the query as is. If lowStockOnly is needed server-side, 
    // it requires an RPC or raw SQL. We will filter client-side for this specific edge case or ignore.
    
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;

    let results = (data || []).map(mapInventoryItem) as InventoryItem[];
    
    if (options?.lowStockOnly) {
      results = results.filter((item) => (item.quantity_in_stock || 0) <= (item.min_stock_alert || 0));
    }

    return {
      data: results,
      total: count || 0,
    };
  },

  async getInventoryDetail(
    inventoryId: string,
    dealerId: string,
    branchId?: string | null
  ): Promise<InventoryDetailData> {
    let inventoryQuery = supabase
      .from('inventory')
      .select('*, products(*)')
      .eq('id', inventoryId)
      .eq('dealer_id', dealerId);

    if (branchId) {
      inventoryQuery = inventoryQuery.eq('branch_id', branchId);
    }

    const { data: inventoryData, error: inventoryError } = await inventoryQuery.single();
    if (inventoryError) throw inventoryError;

    const inventory = mapInventoryItem(inventoryData);

    const { data: lotsData, error: lotsError } = await supabase
      .from('inventory_lots')
      .select('*')
      .eq('inventory_id', inventoryId)
      .eq('dealer_id', dealerId)
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .order('received_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (lotsError) throw lotsError;

    const { data: movementData, error: movementError } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('inventory_id', inventoryId)
      .eq('dealer_id', dealerId)
      .order('created_at', { ascending: false });

    if (movementError) throw movementError;

    const billIds = Array.from(
      new Set(
        (movementData || [])
          .filter((movement) => ['bill', 'bill_cancellation'].includes(movement.reference_type))
          .map((movement) => movement.reference_id)
          .filter(Boolean)
      )
    ) as string[];

    const purchaseIds = Array.from(
      new Set(
        (movementData || [])
          .filter((movement) => movement.reference_type === 'purchase')
          .map((movement) => movement.reference_id)
          .filter(Boolean)
      )
    ) as string[];

    const [{ data: billsData, error: billsError }, { data: purchaseData, error: purchaseError }] =
      await Promise.all([
        billIds.length
          ? supabase
              .from('bills')
              .select('id, bill_number, bill_date, farmer_name_snapshot, status')
              .in('id', billIds)
          : Promise.resolve({ data: [], error: null }),
        purchaseIds.length
          ? supabase.from('stock_purchases').select('*').in('id', purchaseIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (billsError) throw billsError;
    if (purchaseError) throw purchaseError;

    const supplierIds = Array.from(
      new Set((purchaseData || []).map((purchase) => purchase.supplier_id).filter(Boolean))
    ) as string[];

    const { data: supplierData, error: supplierError } = supplierIds.length
      ? await supabase.from('suppliers').select('id, name, phone, company').in('id', supplierIds)
      : { data: [], error: null };

    if (supplierError) throw supplierError;

    const movements = enrichInventoryMovements(
      (movementData || []) as InventoryMovement[],
      (billsData || []) as Bill[],
      (purchaseData || []) as StockPurchase[],
      (supplierData || []) as Supplier[]
    );

    const analytics = buildInventoryAnalytics(inventory, (lotsData || []) as InventoryLot[], movements);

    return {
      inventory,
      lots: (lotsData || []) as InventoryLot[],
      movements,
      summary: analytics.summary,
      monthlySeries: analytics.monthlySeries,
    };
  },

  async getPurchaseDetail(purchaseId: string, dealerId: string): Promise<PurchaseDetailData> {
    const { data: purchaseData, error: purchaseError } = await supabase
      .from('stock_purchases')
      .select('*')
      .eq('id', purchaseId)
      .eq('dealer_id', dealerId)
      .single();

    if (purchaseError) throw purchaseError;

    const purchase = purchaseData as StockPurchase;

    const [{ data: productData, error: productError }, { data: supplierData, error: supplierError }] =
      await Promise.all([
        supabase.from('products').select('*').eq('id', purchase.product_id).maybeSingle(),
        purchase.supplier_id
          ? supabase.from('suppliers').select('id, name, phone, company').eq('id', purchase.supplier_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

    if (productError) throw productError;
    if (supplierError) throw supplierError;

    const { data: lotData, error: lotError } = await supabase
      .from('inventory_lots')
      .select('*')
      .eq('stock_purchase_id', purchaseId)
      .eq('dealer_id', dealerId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (lotError) throw lotError;

    const { data: movementData, error: movementError } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('reference_type', 'purchase')
      .eq('reference_id', purchaseId)
      .eq('dealer_id', dealerId)
      .order('created_at', { ascending: false });

    if (movementError) throw movementError;

    const linkedMovements = enrichInventoryMovements(
      (movementData || []) as InventoryMovement[],
      [],
      [purchase],
      supplierData ? [supplierData as Supplier] : []
    );

    return {
      purchase,
      product: (productData as Product | null) ?? null,
      supplier: supplierData ? (supplierData as Pick<Supplier, 'id' | 'name' | 'phone' | 'company'>) : null,
      linkedLot: (lotData as InventoryLot | null) ?? null,
      linkedMovements,
    };
  },

  /**
   * Fetch all products from master catalog
   */
  async getProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name');
      
    if (error) throw error;
    return data as Product[];
  },

  /**
   * Create a new product in the master catalog
   */
  async createProduct(product: ProductInsert): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();
      
    if (error) throw error;
    return data as Product;
  },

  /**
   * Adjust stock quantity through the inventory adjustment RPC so lots and
   * movement history stay in sync with the visible stock figure.
   */
  async adjustStock(
    inventoryId: string,
    dealerId: string,
    currentQty: number,
    adjustmentQty: number,
    reason: string
  ): Promise<void> {
    const newQty = currentQty + adjustmentQty;
    
    if (newQty < 0) {
      throw new Error('Stock quantity cannot be less than 0');
    }

    const { error: invError } = await supabase.rpc('adjust_inventory_stock_v1', {
      p_payload: {
        inventory_id: inventoryId,
        dealer_id: dealerId,
        adjustment_qty: adjustmentQty,
        reason,
      },
    });

    if (invError) throw invError;
  },

  /**
   * Update the min stock alert threshold for an inventory item.
   */
  async updateAlertThreshold(
    inventoryId: string,
    dealerId: string,
    minStockAlert: number
  ): Promise<void> {
    const { error } = await supabase
      .from('inventory')
      .update({ min_stock_alert: minStockAlert })
      .eq('id', inventoryId)
      .eq('dealer_id', dealerId);

    if (error) throw error;
  },

  /**
   * Get target farmers for rate adjustment based on product and date range
   */
  async getRateAdjustmentTargets(
    dealerId: string,
    productId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    farmer_id: string;
    farmer_name: string;
    farmer_phone: string;
    total_quantity: number;
    avg_unit_price: number;
    bill_count: number;
  }[]> {
    const { data, error } = await supabase.rpc('get_rate_adjustment_targets', {
      p_dealer_id: dealerId,
      p_product_id: productId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) throw error;
    return data || [];
  },

  /**
   * Apply rate difference adjustment for multiple farmers
   */
  async applyRateAdjustments(
    dealerId: string,
    branchId: string | null,
    adjustments: {
      farmerId: string;
      farmerName: string;
      productId: string;
      productName: string;
      totalBags: number;
      rateDifference: number;
      totalAdjustment: number;
    }[]
  ): Promise<void> {
    for (const adj of adjustments) {
      if (adj.totalAdjustment <= 0) continue;

      const payload = {
        dealer_id: dealerId,
        branch_id: branchId,
        farmer_id: adj.farmerId,
        farmer_name_snapshot: adj.farmerName,
        bill_date: new Date().toISOString(),
        subtotal: adj.totalAdjustment,
        gst_amount: 0,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        discount_amount: 0,
        total: adj.totalAdjustment,
        amount_paid: 0,
        type: 'adjustment',
        notes: `Rate adjustment for ${adj.productName} (${adj.totalBags} qty @ ₹${adj.rateDifference} difference)`,
        items: [
          {
            product_id: adj.productId,
            product_name: adj.productName,
            quantity: adj.totalBags,
            unit_price: adj.rateDifference, // This acts as the difference per bag
            gst_rate: 0,
          }
        ]
      };

      const { error } = await supabase.rpc('create_bill_v3', {
        p_payload: payload,
      });

      if (error) throw error;
    }
  },

  /**
   * Update the inventory item details
   */
  async updateInventory(
    inventoryId: string,
    dealerId: string,
    updates: {
      selling_price?: number | null;
      cost_price?: number | null;
      min_stock_alert?: number;
      medicine_discount_percentage?: number;
    }
  ): Promise<void> {
    const { error } = await supabase
      .from('inventory')
      .update(updates)
      .eq('id', inventoryId)
      .eq('dealer_id', dealerId);

    if (error) throw error;
  }
};
