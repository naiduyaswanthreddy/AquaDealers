import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { InventoryItem } from '../types';
import { inventoryService } from '../services/inventoryService';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { inventoryKeys } from '../hooks/useInventory';

interface DeleteProductModalProps {
  item: InventoryItem;
  onClose: () => void;
  onSuccess?: () => void;
}

export const DeleteProductModal: React.FC<DeleteProductModalProps> = ({ item, onClose, onSuccess }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const handleDelete = async () => {
    if (!user?.id) return;
    try {
      setIsDeleting(true);
      const result = await inventoryService.deleteProduct(item.product.id, user.id);
      
      if (result.softDeleted) {
        toast.success('Product archived. It cannot be permanently deleted because it has billing history.');
      } else {
        toast.success('Product deleted successfully');
      }

      // Revalidate inventory cache
      queryClient.invalidateQueries({ queryKey: inventoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.details() });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.products() });
      
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete product');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Delete Product" className="max-w-md">
      <div className="p-4 sm:p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 mb-6">
          <Trash2 className="h-8 w-8 text-rose-600" />
        </div>
        
        <h3 className="text-xl font-black text-slate-900 mb-2">
          Delete {item.product.name}?
        </h3>
        
        <p className="text-slate-500 font-medium mb-6">
          Are you sure you want to delete this product? This action cannot be undone. 
          If the product has existing sales or purchase history, it will be safely archived instead to preserve your records.
        </p>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6 flex items-start gap-3 text-left">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-800">What may be affected</h4>
            <ul className="mt-2 space-y-1 text-xs font-medium text-amber-700">
              <li>Current stock: {item.quantity_in_stock} {item.product.unit}</li>
              <li>Lots/batches: {item.inventory_lots?.length || 0}</li>
              <li>Purchase and bill history will be preserved.</li>
              <li>If history exists, the product will be archived instead of permanently deleted.</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
            onClick={handleDelete}
            loading={isDeleting}
          >
            Delete Product
          </Button>
        </div>
      </div>
    </Modal>
  );
};
