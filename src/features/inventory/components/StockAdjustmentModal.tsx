import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  lot_id: string;
  reason: string;
}

const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({ item, onClose }) => {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AdjustmentForm>({
    defaultValues: {
      adjustment_qty: 0,
      lot_id: '',
      reason: '',
    }
  });

  const { mutateAsync: adjustStock } = useAdjustStock();
  const activeLots = (item.inventory_lots || []).filter((lot) => Number(lot.remaining_quantity || 0) > 0);
  const requiresLotSelection = (adjustmentQty: number) => adjustmentQty < 0 && activeLots.length > 1;

  const onSubmit = async (data: AdjustmentForm) => {
    try {
      const adjustmentQty = Number(data.adjustment_qty);
      if (requiresLotSelection(adjustmentQty) && !data.lot_id) {
        alert('Please select which batch/lot is being adjusted.');
        return;
      }
      await adjustStock({
        inventoryId: item.id,
        currentQty: item.quantity_in_stock || 0,
        adjustmentQty,
        reason: data.reason,
        lotId: data.lot_id || null,
      });
      onClose();
    } catch (error) {
      console.error('Failed to adjust stock:', error);
      alert(t('common.error'));
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[24px] shadow-2xl overflow-hidden animate-slide-up">
        {/* Mobile Drag Indicator */}
        <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-6 pt-3 pb-5">
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
            {t('inventory.adjustStock', 'Adjust Stock')}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">

            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-y border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">{item.product.name}</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">{item.product.company} • {item.product.type}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t('inventory.currentStock', 'Current Stock')}</p>
            <p className="text-xl font-black text-slate-900 leading-none">
              {item.quantity_in_stock} <span className="text-xs font-semibold text-slate-500">{item.product.unit}</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col max-h-[70vh]">
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {t('inventory.adjustmentQuantity', 'Quantity Change')}
              </label>
              <Input
                type="number"
                {...register('adjustment_qty', { 
                  required: t('common.required', 'Required'),
                  validate: (val) => {
                    const newQty = (item.quantity_in_stock || 0) + Number(val);
                    return newQty >= 0 || t('inventory.errorNegativeStock', 'Cannot reduce below 0');
                  }
                })}
                error={errors.adjustment_qty?.message}
                placeholder="+10 (add) or -5 (deduct)"
                helperText="Note: Quantity Change can be + or - numbers"
                className="text-lg font-bold"
              />
            </div>

            {activeLots.length > 1 && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Batch / Lot
                </label>
                <select
                  {...register('lot_id', {
                    validate: (value, formValues) => {
                      return !requiresLotSelection(Number(formValues.adjustment_qty)) || Boolean(value) || 'Select a lot';
                    },
                  })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition-all focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Use FIFO / select lot</option>
                  {activeLots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.batch_number || 'Unlabelled lot'} - {lot.remaining_quantity} {item.product.unit}
                    </option>
                  ))}
                </select>
                {errors.lot_id?.message ? (
                  <p className="text-xs font-semibold text-red-500">{errors.lot_id.message}</p>
                ) : (
                  <p className="text-xs font-medium text-slate-500">
                    Required when reducing stock from an item with multiple batches.
                  </p>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {t('inventory.reason', 'Reason for Adjustment')}
              </label>
              <Input
                {...register('reason', { required: t('common.required', 'Required') })}
                error={errors.reason?.message}
                placeholder={t('inventory.reasonPlaceholder', 'e.g., Damaged, Expired, Manual Count')}
              />
            </div>
          </div>

          <div className="p-4 bg-white border-t border-slate-100 flex gap-3 shrink-0 pb-safe">
            <Button type="button" variant="outline" className="flex-1 rounded-xl h-12 font-bold" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" variant="primary" className="flex-1 rounded-xl h-12 font-bold bg-blue-600 hover:bg-blue-700 text-white" loading={isSubmitting}>
              {t('common.save', 'Save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
};

export default StockAdjustmentModal;
