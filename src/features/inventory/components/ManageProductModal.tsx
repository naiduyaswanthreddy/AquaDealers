import React, { useState } from 'react';
import { Edit2, Trash2, SlidersHorizontal, Info, X } from 'lucide-react';
import { Modal } from '@/components/ui';
import { InventoryItem } from '../types';
import { EditInventoryModal } from './EditInventoryModal';
import { DeleteProductModal } from './DeleteProductModal';
import StockAdjustmentModal from './StockAdjustmentModal';

interface ManageProductModalProps {
  item: InventoryItem;
  onClose: () => void;
  onDeleteSuccess?: () => void;
}

export const ManageProductModal: React.FC<ManageProductModalProps> = ({ item, onClose, onDeleteSuccess }) => {
  const [activeModal, setActiveModal] = useState<'edit' | 'delete' | 'adjust' | null>(null);

  if (activeModal === 'edit') {
    return (
      <EditInventoryModal
        isOpen={true}
        onClose={onClose}
        inventoryId={item.id}
        productId={item.product_id}
        productType={item.product.type}
        initialData={{
          selling_price: item.selling_price,
          cost_price: item.cost_price,
          min_stock_alert: item.min_stock_alert || 0,
          medicine_discount_percentage: item.product.medicine_discount_percentage,
          image_url: item.image_url,
        }}
      />
    );
  }

  if (activeModal === 'delete') {
    return <DeleteProductModal item={item} onClose={onClose} onSuccess={onDeleteSuccess} />;
  }

  if (activeModal === 'adjust') {
    return <StockAdjustmentModal item={item} onClose={onClose} />;
  }

  return (
    <Modal isOpen onClose={onClose} title="Manage Product" className="max-w-sm">
      <div className="p-4 flex flex-col gap-3">
        <button
          onClick={() => setActiveModal('edit')}
          className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Edit2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Edit Details</h4>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Change price, min stock & info</p>
          </div>
        </button>

        <button
          onClick={() => setActiveModal('adjust')}
          className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Adjust Stock</h4>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Manually increase or decrease</p>
          </div>
        </button>

        <button
          onClick={() => setActiveModal('delete')}
          className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-rose-300 hover:bg-rose-50 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Delete Product</h4>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Remove or archive product</p>
          </div>
        </button>
      </div>
    </Modal>
  );
};
