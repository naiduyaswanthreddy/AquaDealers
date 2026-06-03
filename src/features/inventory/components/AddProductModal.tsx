import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useCreateProduct } from '../hooks/useInventory';
import { toast } from 'sonner';

interface AddProductForm {
  name: string;
  type: string;
  company: string;
  unit: string;
  gst_rate: number;
  medicine_discount_percentage: number;
}

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (productId: string) => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { mutateAsync: createProduct, isPending } = useCreateProduct();
  
  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<AddProductForm>({
    defaultValues: {
      type: 'feed',
      gst_rate: 0,
      unit: 'Bag',
      medicine_discount_percentage: 0,
    }
  });

  const watchType = watch('type');

  const onSubmit = async (data: AddProductForm) => {
    try {
      const newProduct = await createProduct({
        ...data,
        is_active: true,
        track_expiry: data.type === 'medicine',
        medicine_discount_percentage: Number(data.medicine_discount_percentage || 0),
      });
      toast.success('Product created successfully');
      reset();
      onSuccess?.(newProduct.id);
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create product');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Product"
      footerButtons={[
        { label: t('common.cancel'), onClick: onClose, variant: 'outline' },
        { label: t('common.save'), onClick: handleSubmit(onSubmit), variant: 'primary', loading: isPending },
      ]}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            {...register('type', {
              onChange: (e) => {
                if (e.target.value === 'feed') {
                  setValue('unit', 'Bag');
                  setValue('medicine_discount_percentage', 0);
                }
              }
            })}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
          >
            <option value="feed">Feed</option>
            <option value="medicine">Medicine</option>
          </select>
        </div>

        <Input
          label="Product Name"
          {...register('name', { required: t('common.required') })}
          error={errors.name?.message}
          placeholder="e.g. Vannamei Feed 2mm"
        />

        <Input
          label="Company (Optional)"
          {...register('company')}
          placeholder="e.g. Avanti"
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Unit"
            {...register('unit', { required: t('common.required') })}
            placeholder="e.g. kg, L, bags"
            error={errors.unit?.message}
          />
          <Input
            label="GST Rate (%)"
            type="number"
            min="0"
            step="0.1"
            {...register('gst_rate')}
          />
        </div>

        {watchType === 'medicine' && (
          <Input
            label="Default Discount (%)"
            type="number"
            min="0"
            max="100"
            step="0.1"
            {...register('medicine_discount_percentage')}
          />
        )}
      </form>
    </Modal>
  );
};
