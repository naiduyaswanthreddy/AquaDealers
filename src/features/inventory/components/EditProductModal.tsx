import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useProducts, useUpdateProduct } from '../hooks/useInventory';
import { toast } from 'sonner';

interface EditProductForm {
  name: string;
  company: string;
  unit: string;
  gst_rate: number;
}

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
}

export const EditProductModal: React.FC<EditProductModalProps> = ({ isOpen, onClose, productId }) => {
  const { t } = useTranslation();
  const { data: products } = useProducts();
  const { mutateAsync: updateProduct, isPending } = useUpdateProduct();

  const product = products?.find(p => p.id === productId);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditProductForm>();

  useEffect(() => {
    if (product) {
      reset({
        name: product.name || '',
        company: product.company || '',
        unit: product.unit || '',
        gst_rate: product.gst_rate || 0,
      });
    }
  }, [product, reset]);

  const onSubmit = async (data: EditProductForm) => {
    try {
      await updateProduct({
        productId,
        updates: {
          name: data.name,
          company: data.company,
          unit: data.unit,
          gst_rate: data.gst_rate,
        }
      });
      toast.success('Product updated successfully');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update product');
    }
  };

  if (!product) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Product Details"
      footerButtons={[
        { label: t('common.cancel'), onClick: onClose, variant: 'outline' },
        { label: t('common.save'), onClick: handleSubmit(onSubmit) as any, loading: isPending }
      ]}
    >
      <form className="space-y-4">
        <Input
          label="Product Name"
          {...register('name', { required: t('common.required') })}
          error={errors.name?.message}
        />
        
        <Input
          label="Company (Optional)"
          {...register('company')}
          error={errors.company?.message}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Unit (e.g. Bag, Box)"
            {...register('unit')}
            error={errors.unit?.message}
          />
          <Input
            label="GST Rate (%)"
            type="number"
            min="0"
            step="0.1"
            {...register('gst_rate', { valueAsNumber: true })}
            error={errors.gst_rate?.message}
          />
        </div>
      </form>
    </Modal>
  );
};
