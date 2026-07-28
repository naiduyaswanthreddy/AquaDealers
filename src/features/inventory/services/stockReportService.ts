import { supabase } from '@/lib/supabase';

export interface StockLedgerItem {
  inventoryId: string;
  productName: string;
  unit: string | null;
  companyName: string;
  category: string;
  currentStock: number;
  totalOut: number;
  farmers: {
    farmerName: string;
    quantity: number;
  }[];
}

export async function getStockLedgerReport(
  dealerId: string,
  startDate: string,
  endDate: string
): Promise<StockLedgerItem[]> {
  const startObj = new Date(startDate);
  startObj.setHours(0, 0, 0, 0);
  const endObj = new Date(endDate);
  endObj.setHours(23, 59, 59, 999);

  // 1. Fetch all inventory for this dealer
  const { data: inventoryData, error: inventoryErr } = await supabase
    .from('inventory')
    .select('id, quantity_in_stock, products(name, type, company, unit)')
    .eq('dealer_id', dealerId);

  if (inventoryErr) throw inventoryErr;

  // Initialize the result map with all inventory items
  const stockMap = new Map<string, { productName: string, unit: string | null, companyName: string, category: string, currentStock: number, totalOut: number, farmersMap: Map<string, number> }>();
  
  (inventoryData || []).forEach(inv => {
    const prod = inv.products as any;
    stockMap.set(inv.id, {
      productName: prod?.name || 'Unknown Product',
      unit: prod?.unit || null,
      companyName: prod?.company || '',
      category: prod?.type || 'General',
      currentStock: Number(inv.quantity_in_stock) || 0,
      totalOut: 0,
      farmersMap: new Map<string, number>()
    });
  });

  // 2. Get all bill movements in the date range
  const { data: movements, error: movementsErr } = await supabase
    .from('inventory_movements')
    .select('inventory_id, quantity_change, reference_id, inventory(products(name, type, company, unit))')
    .eq('dealer_id', dealerId)
    .eq('reference_type', 'bill')
    .gte('created_at', startObj.toISOString())
    .lte('created_at', endObj.toISOString());

  if (movementsErr) throw movementsErr;

  if (movements && movements.length > 0) {
    const billIds = Array.from(new Set(movements.map(m => m.reference_id).filter(Boolean))) as string[];

    const { data: bills, error: billsErr } = await supabase
      .from('bills')
      .select('id, farmer_name_snapshot')
      .eq('dealer_id', dealerId)
      .in('id', billIds);

    if (billsErr) throw billsErr;

    const billMap = new Map(bills?.map(b => [b.id, b.farmer_name_snapshot]));

    movements.forEach(m => {
      const quantity = Math.abs(Number(m.quantity_change));
      const farmerName = billMap.get(m.reference_id as string) || 'Walk-in Customer';

      if (!stockMap.has(m.inventory_id)) {
        const inv = m.inventory as any;
        stockMap.set(m.inventory_id, {
          productName: inv?.products?.name || 'Unknown Product',
          unit: inv?.products?.unit || null,
          companyName: inv?.products?.company || '',
          category: inv?.products?.type || 'General',
          currentStock: 0,
          totalOut: 0,
          farmersMap: new Map<string, number>()
        });
      }

      const item = stockMap.get(m.inventory_id)!;
      item.totalOut += quantity;
      
      const currentQty = item.farmersMap.get(farmerName) || 0;
      item.farmersMap.set(farmerName, currentQty + quantity);
    });
  }

  const result: StockLedgerItem[] = [];
  stockMap.forEach((value, key) => {
    const farmers = Array.from(value.farmersMap.entries())
      .map(([farmerName, quantity]) => ({ farmerName, quantity }))
      .sort((a, b) => b.quantity - a.quantity);

    result.push({
      inventoryId: key,
      productName: value.productName,
      unit: value.unit,
      companyName: value.companyName,
      category: value.category,
      currentStock: value.currentStock,
      totalOut: value.totalOut,
      farmers
    });
  });

  return result.sort((a, b) => b.totalOut - a.totalOut);
}
