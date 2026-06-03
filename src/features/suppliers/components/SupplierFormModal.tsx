import React from 'react';
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCreateSupplier, useUpdateSupplier } from '../hooks/useSuppliers';
import { useAuthStore } from '@/stores/authStore';
import { SupplierItem, SupplierInsert } from '../types';
import { Modal } from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { toast } from 'sonner';

interface SupplierFormModalProps {
  supplier?: SupplierItem | null;
  onClose: () => void;
}

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({ supplier, onClose }) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { mutateAsync: createSupplier, isPending: isCreating } = useCreateSupplier();
  const { mutateAsync: updateSupplier, isPending: isUpdating } = useUpdateSupplier();
  const isPending = isCreating || isUpdating;

  const { register, handleSubmit, formState: { errors } } = useForm<SupplierInsert>({
    defaultValues: {
      dealer_id: user?.id || '',
      name: supplier?.name || '',
      company: supplier?.company || '',
      phone: supplier?.phone || '',
      gstin: supplier?.gstin || '',
      address: supplier?.address || '',
      credit_days: supplier?.credit_days || 0,
      opening_balance: supplier?.opening_balance || 0,
      notes: supplier?.notes || '',
    }
  });

  const onSubmit = async (data: SupplierInsert) => {
    try {
      if (supplier) {
        await updateSupplier({ ...data, id: supplier.id });
        toast.success(t('suppliers.updateSuccess'));
      } else {
        await createSupplier(data);
        toast.success(t('suppliers.addSuccess'));
      }
      onClose();
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={supplier ? t('suppliers.editSupplier') : t('suppliers.addSupplier')}
      footerButtons={[
        { label: t('common.cancel'), onClick: onClose, variant: 'outline' },
        { label: t('common.save'), onClick: handleSubmit(onSubmit) as any, loading: isPending }
      ]}
    >
      <form id="supplier-form" className="space-y-4">
        <Input
          label={t('suppliers.name')}
          {...register('name', { required: t('common.required') })}
          error={errors.name?.message}
        />
        
        <Input
          label={t('suppliers.company')}
          {...register('company')}
          error={errors.company?.message}
        />

        <Input
          label={t('suppliers.phone')}
          {...register('phone')}
          error={errors.phone?.message}
        />

        <Input
          label="GSTIN"
          {...register('gstin')}
          error={errors.gstin?.message}
        />

        <Input
          label={t('suppliers.address')}
          {...register('address')}
          error={errors.address?.message}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Credit Days"
            type="number"
            {...register('credit_days', { valueAsNumber: true })}
            error={errors.credit_days?.message}
          />

          <Input
            label="Opening Due"
            type="number"
            {...register('opening_balance', { valueAsNumber: true })}
            error={errors.opening_balance?.message}
          />
        </div>
        
        <Input
          label={t('common.notes')}
          {...register('notes')}
          error={errors.notes?.message}
        />
      </form>
    </Modal>
  );
};
