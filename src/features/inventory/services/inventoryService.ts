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
  let totalExpired = 0;

  movements.forEach((movement) => {
    const monthKey = getMonthKey(movement.created_at);
    const monthEntry = monthlyMap.get(monthKey) || {
      month: formatMonthLabel(monthKey),
      received: 0,
      sold: 0,
      adjustedIn: 0,
      adjustedOut: 0,
      cancelledBack: 0,
      expired: 0,
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
    } else if (movement.reference_type === 'expiry') {
      monthEntry.expired += quantity;
      totalExpired += quantity;
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
      monthEntry.adjustedOut -
      monthEntry.expired;

    monthlyMap.set(monthKey, monthEntry);
  });

  const estimatedPrice = Number(inventory.selling_price || inventory.product.default_price || 0);
  const availableLots = lots.filter((lot) => Number(lot.remaining_quantity || 0) > 0 && !lot.is_expired).length;
  const expiredLots = lots.filter((lot) => lot.is_expired).length;

  // Robust fallback: if movements are empty or don't cover the lots, calculate from lots
  const totalReceivedFromLots = lots.reduce((acc, lot) => acc + Number(lot.quantity_received || 0), 0);
  const finalTotalReceived = Math.max(totalReceived, totalReceivedFromLots);

  return {
    summary: {
      currentStock: Number(inventory.quantity_in_stock || 0),
      lowStockThreshold: inventory.min_stock_alert ?? null,
      availableLots,
      expiredLots,
      totalReceived: finalTotalReceived,
      totalIssued,
      totalExpired,
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
      outOfStockOnly?: boolean;
    }
  ): Promise<{ data: InventoryItem[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('inventory')
      .select('*, products!inner(*), inventory_lots(*)', { count: 'exact' })
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
    
    if (options?.outOfStockOnly) {
      results = results.filter((item) => (item.quantity_in_stock || 0) <= 0);
    } else if (options?.lowStockOnly) {
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
   * Fetch all products for the dealer
   */
  async getProducts(dealerId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('dealer_id', dealerId)
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
    
    // Initialize empty inventory record
    if (data) {
      const { error: invError } = await supabase
        .from('inventory')
        .insert({
          dealer_id: data.dealer_id,
          product_id: data.id,
          quantity_in_stock: 0,
          medicine_discount_percentage: data.medicine_discount_percentage || 0,
          min_stock_alert: 0
        });
      if (invError) console.error('Failed to create initial inventory record', invError);
    }
    
    return data as Product;
  },

  /**
   * Create multiple products in bulk
   */
  async createProducts(products: ProductInsert[]): Promise<Product[]> {
    if (!products.length) return [];
    const { data, error } = await supabase
      .from('products')
      .insert(products)
      .select();
      
    if (error) throw error;
    
    // Initialize empty inventory records for bulk created products
    if (data && data.length > 0) {
      const inventoryRecords = data.map(p => ({
        dealer_id: p.dealer_id,
        product_id: p.id,
        quantity_in_stock: 0,
        medicine_discount_percentage: p.medicine_discount_percentage || 0,
        min_stock_alert: 0
      }));
      
      const { error: invError } = await supabase
        .from('inventory')
        .insert(inventoryRecords);
        
      if (invError) console.error('Failed to create initial inventory records', invError);
    }
    
    return data as Product[];
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
    reason: string,
    lotId?: string | null
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
        lot_id: lotId || null,
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
    endDate: string,
    options?: {
      newUnitPrice?: number | null;
      oldUnitPrice?: number | null;
    }
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
      p_new_unit_price: options?.newUnitPrice ?? null,
      p_old_unit_price: options?.oldUnitPrice ?? null,
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
      oldUnitPrice?: number | null;
      newUnitPrice?: number | null;
    }[]
  ): Promise<void> {
    for (const adj of adjustments) {
      if (adj.totalAdjustment <= 0) continue;

      const rateLabel = adj.oldUnitPrice && adj.newUnitPrice
        ? ` (Rs ${adj.oldUnitPrice} -> Rs ${adj.newUnitPrice})`
        : '';

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
            product_name: `Rate difference: ${adj.productName}${rateLabel}`,
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
      mrp?: number | null;
      image_url?: string | null;
    }
  ): Promise<void> {
    const { error } = await supabase
      .from('inventory')
      .update(updates)
      .eq('id', inventoryId)
      .eq('dealer_id', dealerId);

    if (error) throw error;
  },

  async updateInventoryLotPricing(
    lotId: string,
    dealerId: string,
    updates: {
      selling_price: number;
      medicine_discount_percentage: number;
      final_unit_price: number;
      mrp?: number | null;
      cost_price?: number | null;
      batch_number?: string | null;
      expiry_date?: string | null;
    }
  ): Promise<void> {
    const { error } = await supabase
      .from('inventory_lots')
      .update(updates)
      .eq('id', lotId)
      .eq('dealer_id', dealerId);

    if (error) throw error;
  },

  /**
   * Delete a product and its associated inventory.
   * Attempt hard delete first. If foreign key constraints prevent it, fallback to soft delete.
   */
  async deleteProduct(productId: string, dealerId: string): Promise<{ success: boolean; softDeleted?: boolean }> {
    // Attempt hard delete from products (cascade should handle inventory if configured, otherwise we delete inventory first)
    // Actually, inventory has a FK to products. Deleting product might fail if it's referenced in bills.
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
      .eq('dealer_id', dealerId);

    if (error) {
      if (error.code === '23503') { // Foreign key constraint violation
        // Fallback to soft delete
        const { error: softDeleteError } = await supabase
          .from('products')
          .update({ is_active: false })
          .eq('id', productId)
          .eq('dealer_id', dealerId);

        if (softDeleteError) throw softDeleteError;
        return { success: true, softDeleted: true };
      }
      throw error;
    }

    return { success: true, softDeleted: false };
  },

  async updateProduct(productId: string, updates: Partial<Product>): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;
    return data as Product;
  },

  /**
   * Process all expired inventory lots for a dealer.
   * Finds lots where expiry_date < today, zeros remaining_quantity,
   * reduces inventory.quantity_in_stock, and logs movements.
   * Returns the number of lots processed.
   */
  async processExpiredLots(dealerId: string): Promise<number> {
    const { data, error } = await supabase.rpc('process_expired_inventory_lots', {
      p_dealer_id: dealerId,
    });

    if (error) throw error;
    return (data as number) || 0;
  },

  /**
   * Manually mark a single lot as expired.
   */
  async markLotAsExpired(dealerId: string, lotId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_lot_as_expired', {
      p_dealer_id: dealerId,
      p_lot_id: lotId,
    });

    if (error) throw error;
  },
};
