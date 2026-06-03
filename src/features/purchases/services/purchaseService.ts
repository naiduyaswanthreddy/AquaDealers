import { inventoryService } from '@/features/inventory/services/inventoryService';
import { PurchaseDetailData } from '@/features/inventory/types';

export const purchaseService = {
  async getPurchaseDetail(purchaseId: string, dealerId: string): Promise<PurchaseDetailData> {
    return inventoryService.getPurchaseDetail(purchaseId, dealerId);
  },
};

export default purchaseService;
