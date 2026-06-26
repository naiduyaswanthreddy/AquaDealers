import React from 'react';
import { useForm } from 'react-hook-form';
import { Camera, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCreateSupplier, useUpdateSupplier } from '../hooks/useSuppliers';
import { useAuthStore } from '@/stores/authStore';
import { SupplierItem, SupplierInsert } from '../types';
import { Modal } from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import { supabase } from '@/lib/supabase';
import { deleteOldImage } from '@/lib/imageUtils';

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
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(supplier?.photo_url || null);
  const [showPhotoOptions, setShowPhotoOptions] = React.useState(false);
  const [isCompressingPhoto, setIsCompressingPhoto] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<SupplierInsert>({
    defaultValues: {
      dealer_id: user?.id || '',
      name: supplier?.name || '',
      company: supplier?.company || '',
      phone: supplier?.phone || '',
      alternate_phone: supplier?.alternate_phone || '',
      photo_url: supplier?.photo_url || null,
      gstin: supplier?.gstin || '',
      address: supplier?.address || '',
      credit_days: supplier?.credit_days || 0,
      opening_balance: supplier?.opening_balance || 0,
      notes: supplier?.notes || '',
    }
  });

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressingPhoto(true);
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.05,
        maxWidthOrHeight: 500,
        useWebWorker: true,
        fileType: 'image/webp',
        initialQuality: 0.6,
      });
      setPhotoFile(compressedFile);
      setPhotoPreview(URL.createObjectURL(compressedFile));
    } catch (error) {
      console.error('Error compressing supplier photo:', error);
      toast.error('Failed to process supplier photo');
    } finally {
      setIsCompressingPhoto(false);
      setShowPhotoOptions(false);
    }
  };

  const uploadSupplierPhoto = async (supplierId: string) => {
    if (!photoFile) return supplier?.photo_url || null;

    if (supplier?.photo_url) {
      await deleteOldImage('product-images', supplier.photo_url);
    }

    const filePath = `suppliers/${supplierId}.webp`;
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, photoFile, { upsert: true, cacheControl: '3600' });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    return `${publicUrlData.publicUrl}?t=${Date.now()}`;
  };

  const onSubmit = async (data: SupplierInsert) => {
    try {
      if (supplier) {
        const photoUrl = await uploadSupplierPhoto(supplier.id);
        await updateSupplier({ ...data, photo_url: photoUrl, id: supplier.id });
        toast.success(t('suppliers.updateSuccess'));
      } else {
        const created = await createSupplier(data);
        if (photoFile) {
          const photoUrl = await uploadSupplierPhoto(created.id);
          await updateSupplier({ id: created.id, photo_url: photoUrl });
        }
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
        <div className="relative flex flex-col items-center">
          <button
            type="button"
            onClick={() => setShowPhotoOptions((value) => !value)}
            className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-50 shadow-sm transition-colors hover:border-slate-300"
          >
            {photoPreview ? (
              <img src={photoPreview} alt="Supplier" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-8 w-8 text-slate-300" />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
              <Camera className="h-6 w-6 text-white" />
            </span>
            {isCompressingPhoto ? (
              <span className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </span>
            ) : null}
          </button>

          {showPhotoOptions ? (
            <div className="absolute top-28 z-10 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Camera className="h-4 w-4 text-slate-500" />
                Take Photo
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ImageIcon className="h-4 w-4 text-slate-500" />
                Choose from Gallery
              </button>
            </div>
          ) : null}

          <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handlePhotoChange} />
          <input ref={cameraInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={handlePhotoChange} />
        </div>

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t('suppliers.phone')}
            {...register('phone')}
            error={errors.phone?.message}
          />

          <Input
            label="Phone 2"
            {...register('alternate_phone')}
            error={errors.alternate_phone?.message}
          />
        </div>

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
