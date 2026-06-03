import { supabase } from '@/lib/supabase';

export interface StockLedgerItem {
  inventoryId: string;
  productName: string;
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

  // Get all bill movements in the date range
  const { data: movements, error: movementsErr } = await supabase
    .from('inventory_movements')
    .select('inventory_id, quantity_change, reference_id, inventory(products(name))')
    .eq('dealer_id', dealerId)
    .eq('reference_type', 'bill')
    .gte('created_at', startObj.toISOString())
    .lte('created_at', endObj.toISOString());

  if (movementsErr) throw movementsErr;

  if (!movements || movements.length === 0) {
    return [];
  }

  const billIds = Array.from(new Set(movements.map(m => m.reference_id).filter(Boolean))) as string[];

  const { data: bills, error: billsErr } = await supabase
    .from('bills')
    .select('id, farmer_name_snapshot')
    .eq('dealer_id', dealerId)
    .in('id', billIds);

  if (billsErr) throw billsErr;

  const billMap = new Map(bills?.map(b => [b.id, b.farmer_name_snapshot]));

  const stockMap = new Map<string, { productName: string, totalOut: number, farmersMap: Map<string, number> }>();

  movements.forEach(m => {
    const inv = m.inventory as any;
    const productName = inv?.products?.name || 'Unknown Product';
    const quantity = Math.abs(Number(m.quantity_change));
    const farmerName = billMap.get(m.reference_id as string) || 'Walk-in Customer';

    if (!stockMap.has(m.inventory_id)) {
      stockMap.set(m.inventory_id, {
        productName,
        totalOut: 0,
        farmersMap: new Map<string, number>()
      });
    }

    const item = stockMap.get(m.inventory_id)!;
    item.totalOut += quantity;
    
    const currentQty = item.farmersMap.get(farmerName) || 0;
    item.farmersMap.set(farmerName, currentQty + quantity);
  });

  const result: StockLedgerItem[] = [];
  stockMap.forEach((value, key) => {
    const farmers = Array.from(value.farmersMap.entries())
      .map(([farmerName, quantity]) => ({ farmerName, quantity }))
      .sort((a, b) => b.quantity - a.quantity);

    result.push({
      inventoryId: key,
      productName: value.productName,
      totalOut: value.totalOut,
      farmers
    });
  });

  return result.sort((a, b) => b.totalOut - a.totalOut);
}
