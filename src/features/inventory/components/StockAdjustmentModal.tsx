import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useAdjustStock } from '../hooks/useInventory';
import { InventoryItem } from '../types';

// UI Components
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface StockAdjustmentModalProps {
  item: InventoryItem;
  onClose: () => void;
}

interface AdjustmentForm {
  adjustment_qty: number;
  reason: string;
}

const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({ item, onClose }) => {
  const { t } = useTranslation();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AdjustmentForm>({
    defaultValues: {
      adjustment_qty: 0,
      reason: '',
    }
  });

  const { mutateAsync: adjustStock } = useAdjustStock();

  const onSubmit = async (data: AdjustmentForm) => {
    try {
      await adjustStock({
        inventoryId: item.id,
        currentQty: item.quantity_in_stock || 0,
        adjustmentQty: Number(data.adjustment_qty),
        reason: data.reason,
      });
      onClose();
    } catch (error) {
      console.error('Failed to adjust stock:', error);
      alert(t('common.error'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">
            {t('inventory.adjustStock')}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 bg-gray-50 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-blue-50/50 border-b">
          <p className="text-sm font-medium text-gray-700">{item.product.name}</p>
          <p className="text-xs text-gray-500">{item.product.company} • {item.product.type}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm text-gray-600">{t('inventory.currentStock')}:</span>
            <span className="font-bold text-gray-900">{item.quantity_in_stock} {item.product.unit}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <Input
            label={t('inventory.adjustmentQuantity')}
            type="number"
            {...register('adjustment_qty', { 
              required: t('common.required'),
              validate: (val) => {
                const newQty = (item.quantity_in_stock || 0) + Number(val);
                return newQty >= 0 || t('inventory.errorNegativeStock');
              }
            })}
            error={errors.adjustment_qty?.message}
            placeholder="+10 or -5"
            helperText={t('inventory.adjustmentHelper')}
          />
          
          <Input
            label={t('inventory.reason')}
            {...register('reason', { required: t('common.required') })}
            error={errors.reason?.message}
            placeholder={t('inventory.reasonPlaceholder')}
          />

          <div className="pt-4 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockAdjustmentModal;
