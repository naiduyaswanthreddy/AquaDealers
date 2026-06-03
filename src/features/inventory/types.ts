import { Bill, Inventory, InventoryLot, InventoryMovement, Product, StockPurchase, Supplier } from '@/types/database';

export interface InventoryItem extends Inventory {
  product: Product;
}

export interface InventoryMovementDetail extends InventoryMovement {
  bill?: Pick<Bill, 'id' | 'bill_number' | 'bill_date' | 'farmer_name_snapshot' | 'status'> | null;
  purchase?: (Pick<
    StockPurchase,
    | 'id'
    | 'purchase_date'
    | 'invoice_number'
    | 'supplier_id'
    | 'total_amount'
    | 'quantity'
    | 'batch_number'
    | 'expiry_date'
    | 'cost_price_per_unit'
    | 'is_paid'
    | 'notes'
  > & {
    supplier_name?: string | null;
  }) | null;
}

export interface InventoryMonthlySeriesItem {
  month: string;
  received: number;
  sold: number;
  adjustedIn: number;
  adjustedOut: number;
  cancelledBack: number;
  net: number;
}

export interface InventoryDetailData {
  inventory: InventoryItem;
  lots: InventoryLot[];
  movements: InventoryMovementDetail[];
  summary: {
    currentStock: number;
    lowStockThreshold: number | null;
    availableLots: number;
    totalReceived: number;
    totalIssued: number;
    totalAdjustedIn: number;
    totalAdjustedOut: number;
    estimatedStockValue: number | null;
    lastMovementAt: string | null;
  };
  monthlySeries: InventoryMonthlySeriesItem[];
}

export interface PurchaseDetailData {
  purchase: StockPurchase;
  product?: Product | null;
  supplier?: Pick<Supplier, 'id' | 'name' | 'phone' | 'company'> | null;
  linkedLot?: InventoryLot | null;
  linkedMovements: InventoryMovementDetail[];
}

export interface StockAdjustmentData {
  inventory_id: string;
  adjustment_qty: number; // positive for addition, negative for reduction
  reason: string;
}
