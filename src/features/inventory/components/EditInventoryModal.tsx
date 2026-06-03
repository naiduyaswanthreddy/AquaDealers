import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useUpdateInventory } from '../hooks/useInventory';
import { toast } from 'sonner';

interface EditInventoryForm {
  selling_price: number;
  cost_price: number;
  min_stock_alert: number;
  medicine_discount_percentage: number;
  mrp: number;
}

interface EditInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryId: string;
  productId?: string;
  productType?: string;
  initialData: {
    selling_price: number | null;
    cost_price: number | null;
    min_stock_alert: number;
    medicine_discount_percentage?: number;
  };
}

export const EditInventoryModal: React.FC<EditInventoryModalProps> = ({ 
  isOpen, 
  onClose, 
  inventoryId,
  productId,
  productType,
  initialData 
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutateAsync: updateInventory, isPending } = useUpdateInventory();
  const isMedicine = productType === 'medicine';

  // Reverse-calculate MRP from selling_price and discount
  const initialDiscount = initialData.medicine_discount_percentage || 0;
  const initialSellingPrice = initialData.selling_price || 0;
  const initialMrp = initialDiscount > 0 && initialDiscount < 100
    ? Number((initialSellingPrice / (1 - initialDiscount / 100)).toFixed(2))
    : initialSellingPrice;

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<EditInventoryForm>({
    defaultValues: {
      selling_price: initialSellingPrice,
      cost_price: initialData.cost_price || 0,
      min_stock_alert: initialData.min_stock_alert || 0,
      medicine_discount_percentage: initialDiscount,
      mrp: initialMrp,
    }
  });

  useEffect(() => {
    if (isOpen) {
      const disc = initialData.medicine_discount_percentage || 0;
      const sp = initialData.selling_price || 0;
      const mrp = disc > 0 && disc < 100
        ? Number((sp / (1 - disc / 100)).toFixed(2))
        : sp;
      reset({
        selling_price: sp,
        cost_price: initialData.cost_price || 0,
        min_stock_alert: initialData.min_stock_alert || 0,
        medicine_discount_percentage: disc,
        mrp: mrp,
      });
    }
  }, [isOpen, initialData, reset]);

  const watchMrp = watch('mrp');
  const watchDiscount = watch('medicine_discount_percentage');

  // Auto-calculate selling_price when MRP or discount changes (for medicine only)
  useEffect(() => {
    if (!isMedicine) return;
    const mrp = Number(watchMrp) || 0;
    const discount = Number(watchDiscount) || 0;
    if (mrp > 0) {
      setValue('selling_price', Number((mrp * (1 - discount / 100)).toFixed(2)));
    }
  }, [watchMrp, watchDiscount, isMedicine, setValue]);

  const onSubmit = async (data: EditInventoryForm) => {
    try {
      await updateInventory({
        inventoryId,
        updates: {
          selling_price: data.selling_price || null,
          cost_price: data.cost_price || null,
          min_stock_alert: Number(data.min_stock_alert) || 0,
          ...(isMedicine ? { medicine_discount_percentage: data.medicine_discount_percentage || 0 } : {}),
        },
      });
      toast.success(t('inventory.updatedSuccessfully', 'Inventory details updated successfully'));
      
      const diff = (data.selling_price || 0) - initialSellingPrice;
      if (diff > 0 && productId) {
        const applyDiff = window.confirm(
          `You increased the price by ₹${diff.toFixed(2)}.\n\nWould you like to open the Rate Difference tool to apply this extra charge to farmers who bought this on credit?`
        );
        if (applyDiff) {
          onClose();
          navigate('/inventory/rate-adjustment', { 
            state: { productId, rateDifference: diff } 
          });
          return;
        }
      }
      
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update inventory details');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('inventory.editDetails', 'Edit Inventory Details')}
      footerButtons={[
        { label: t('common.cancel', 'Cancel'), onClick: onClose, variant: 'outline' },
        { label: t('common.save', 'Save Changes'), onClick: handleSubmit(onSubmit), variant: 'primary', loading: isPending },
      ]}
    >
      <div className="space-y-4 p-5 sm:p-6">
        {isMedicine && (
          <>
            <Input
              label="MRP (₹)"
              type="number"
              step="0.01"
              {...register('mrp', { valueAsNumber: true, min: 0 })}
              error={errors.mrp?.message}
            />

            <Input
              label="Medicine Discount %"
              type="number"
              step="0.01"
              {...register('medicine_discount_percentage', { valueAsNumber: true, min: 0, max: 100 })}
              error={errors.medicine_discount_percentage?.message}
            />
          </>
        )}

        <Input
          label={t('inventory.sellingPrice', 'Selling Price')}
          type="number"
          step="0.01"
          {...register('selling_price', { valueAsNumber: true, min: 0 })}
          error={errors.selling_price?.message}
          disabled={isMedicine && (Number(watchMrp) > 0)}
        />
        
        <Input
          label={t('inventory.costPrice', 'Cost Price')}
          type="number"
          step="0.01"
          {...register('cost_price', { valueAsNumber: true, min: 0 })}
          error={errors.cost_price?.message}
        />
        
        <Input
          label={t('inventory.minStockAlert', 'Low Stock Alert Threshold')}
          type="number"
          step="1"
          {...register('min_stock_alert', { valueAsNumber: true, min: 0 })}
          error={errors.min_stock_alert?.message}
        />

        {isMedicine && Number(watchMrp) > 0 && (
          <p className="text-xs text-text-secondary bg-blue-50 rounded-xl px-3 py-2">
            Selling Price = MRP ({watchMrp}) × (1 - {watchDiscount}%) = <strong>₹{(Number(watchMrp) * (1 - Number(watchDiscount) / 100)).toFixed(2)}</strong>
          </p>
        )}
      </div>
    </Modal>
  );
};

export default EditInventoryModal;
