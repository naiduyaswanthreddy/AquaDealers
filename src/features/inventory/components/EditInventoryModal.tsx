import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useUpdateInventory, useUpdateProduct } from '../hooks/useInventory';
import { toast } from 'sonner';
import { ArrowDownLeft, ArrowUpRight, Camera, Image as ImageIcon } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { supabase } from '@/lib/supabase';
import { deleteOldImage } from '@/lib/imageUtils';
import { PlanGate } from '@/components/auth/PlanGate';

interface EditInventoryForm {
  selling_price: number;
  cost_price: number;
  min_stock_alert: number;
  medicine_discount_percentage: number;
  cost_percentage: number;
  mrp: number;
  product_name: string;
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
    image_url?: string | null;
    product_name?: string;
  };
}

export const EditInventoryModal: React.FC<EditInventoryModalProps> = ({ 
  isOpen, 
  onClose, 
  inventoryId,
  productId,
  initialData 
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutateAsync: updateInventory, isPending: isUpdatingInventory } = useUpdateInventory();
  const { mutateAsync: updateProduct, isPending: isUpdatingProduct } = useUpdateProduct();
  const isPending = isUpdatingInventory || isUpdatingProduct;

  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(initialData.image_url || null);
  const [isCompressing, setIsCompressing] = React.useState(false);
  const [showImageOptions, setShowImageOptions] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const options = {
        maxSizeMB: 0.05, // ~50KB target
        maxWidthOrHeight: 500,
        useWebWorker: true,
        fileType: "image/webp",
        initialQuality: 0.6,
      };
      
      const compressedFile = await imageCompression(file, options);
      setImageFile(compressedFile);
      setImagePreview(URL.createObjectURL(compressedFile));
    } catch (error) {
      console.error('Error compressing image:', error);
      toast.error('Failed to process image');
    } finally {
      setIsCompressing(false);
      setShowImageOptions(false);
    }
  };

  // Reverse-calculate MRP from selling_price and discount
  const initialDiscount = initialData.medicine_discount_percentage || 0;
  const initialSellingPrice = initialData.selling_price || 0;
  const initialMrp = initialDiscount > 0 && initialDiscount < 100
    ? Number((initialSellingPrice / (1 - initialDiscount / 100)).toFixed(2))
    : initialSellingPrice;

  const calculateCostPercentage = (mrp?: number, costPrice?: number | null) => {
    const numericMrp = Number(mrp) || 0;
    const numericCostPrice = Number(costPrice) || 0;
    if (numericMrp <= 0 || numericCostPrice < 0) return 0;
    return Number((((numericMrp - numericCostPrice) / numericMrp) * 100).toFixed(2));
  };

  const calculateCostPrice = (mrp?: number, costPercentage?: number) => {
    const numericMrp = Number(mrp) || 0;
    const numericCostPercentage = Number(costPercentage) || 0;
    if (numericMrp <= 0 || numericCostPercentage < 0) return 0;
    return Number((numericMrp * (1 - numericCostPercentage / 100)).toFixed(2));
  };

  const toNullableNumber = (value: number | undefined) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<EditInventoryForm>({
    defaultValues: {
      selling_price: initialSellingPrice,
      cost_price: initialData.cost_price || 0,
      cost_percentage: calculateCostPercentage(initialMrp, initialData.cost_price),
      min_stock_alert: initialData.min_stock_alert || 0,
      medicine_discount_percentage: initialDiscount,
      mrp: initialMrp,
      product_name: initialData.product_name || '',
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
        cost_percentage: calculateCostPercentage(mrp, initialData.cost_price),
        min_stock_alert: initialData.min_stock_alert || 0,
        medicine_discount_percentage: disc,
        mrp: mrp,
        product_name: initialData.product_name || '',
      });
      setImagePreview(initialData.image_url || null);
      setImageFile(null);
    }
  }, [isOpen, initialData, reset]);

  const watchMrp = watch('mrp');
  const watchDiscount = watch('medicine_discount_percentage');
  const watchCostDiscount = watch('cost_percentage');

  useEffect(() => {
    const mrp = Number(watchMrp) || 0;
    const discount = Number(watchDiscount) || 0;
    if (mrp > 0) {
      setValue('selling_price', Number((mrp * (1 - discount / 100)).toFixed(2)));
    }
  }, [watchMrp, watchDiscount, setValue]);

  useEffect(() => {
    const mrp = Number(watchMrp) || 0;
    const dealerDiscount = Number(watchCostDiscount) || 0;
    if (mrp > 0) {
      setValue('cost_price', calculateCostPrice(mrp, dealerDiscount));
    }
  }, [watchMrp, watchCostDiscount, setValue]);

  const onSubmit = async (data: EditInventoryForm) => {
    try {
      setIsUploading(true);
      let uploadedImageUrl = initialData.image_url;

      if (imageFile && inventoryId) {
        if (initialData.image_url) {
          await deleteOldImage('product-images', initialData.image_url);
        }

        const fileName = `${inventoryId}.webp`;
        const filePath = `products/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, imageFile, { upsert: true, cacheControl: '3600' });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        uploadedImageUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
      }

      await updateInventory({
        inventoryId,
        updates: {
          selling_price: toNullableNumber(data.selling_price),
          cost_price: toNullableNumber(data.cost_price),
          mrp: toNullableNumber(data.mrp),
          min_stock_alert: Number(data.min_stock_alert) || 0,
          medicine_discount_percentage: Number.isFinite(Number(data.medicine_discount_percentage))
            ? Number(data.medicine_discount_percentage)
            : 0,
          ...(uploadedImageUrl !== undefined ? { image_url: uploadedImageUrl } : {}),
        },
      });

      if (productId && data.product_name && data.product_name !== initialData.product_name) {
        await updateProduct({ productId, updates: { name: data.product_name } });
      }

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
    } finally {
      setIsUploading(false);
    }
  };

  const currentProductName = watch('product_name') || initialData.product_name;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={currentProductName ? `Edit ${currentProductName}` : t('inventory.editDetails', 'Edit Inventory Details')}
      footerButtons={[
        { label: t('common.cancel', 'Cancel'), onClick: onClose, variant: 'outline' },
        { label: t('common.save', 'Save Changes'), onClick: handleSubmit(onSubmit), variant: 'primary', loading: isPending || isUploading },
      ]}
    >
      <div className="space-y-4 p-5 sm:p-6">
        {productId && (
          <PlanGate feature="product_image" showOverlay>
            <div className="flex flex-col items-center justify-center mb-6 relative">
              <div className="relative group">
              <div 
                onClick={() => setShowImageOptions(!showImageOptions)}
                className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-50 flex items-center justify-center cursor-pointer relative shadow-sm hover:border-slate-300 transition-colors"
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Product" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-300" />
                )}
                
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                
                {isCompressing && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>
            
            {showImageOptions && (
              <div className="absolute top-28 z-10 w-48 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-fade-in">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 border-b border-slate-100"
                >
                  <Camera className="w-4 h-4 text-slate-500" />
                  Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <ImageIcon className="w-4 h-4 text-slate-500" />
                  Choose from Gallery
                </button>
              </div>
            )}

            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageChange}
            />
            <input 
              type="file" 
              ref={cameraInputRef} 
              className="hidden" 
              accept="image/*" 
              capture="environment"
              onChange={handleImageChange}
            />
          </div>
          </PlanGate>
        )}

        {productId && (
          <Input
            label={t('inventory.productName', 'Product Name')}
            {...register('product_name')}
            error={errors.product_name?.message}
          />
        )}

        <>
            <Input
              label="MRP (₹)"
              type="number"
              step="0.01"
              {...register('mrp', { valueAsNumber: true, min: 0 })}
              error={errors.mrp?.message}
            />

            <Input
              label="Discount % (Farmer Discount %)"
              type="number"
              step="0.01"
              leftIcon={<ArrowUpRight className="h-4 w-4 text-emerald-600" />}
              {...register('medicine_discount_percentage', { valueAsNumber: true, min: 0, max: 100 })}
              error={errors.medicine_discount_percentage?.message}
            />
        </>

        <Input
          label={t('inventory.sellingPrice', 'Selling Price')}
          type="number"
          step="0.01"
          leftIcon={<ArrowUpRight className="h-4 w-4 text-emerald-600" />}
          {...register('selling_price', { valueAsNumber: true, min: 0 })}
          error={errors.selling_price?.message}
        />

        <Input
          label="Cost Discount % (Dealer Discount %)"
          type="number"
          step="0.01"
          leftIcon={<ArrowDownLeft className="h-4 w-4 text-sky-600" />}
          {...register('cost_percentage', { valueAsNumber: true, min: 0, max: 100 })}
          error={errors.cost_percentage?.message}
        />
        
        <Input
          label={t('inventory.costPrice', 'Cost Price')}
          type="number"
          step="0.01"
          leftIcon={<ArrowDownLeft className="h-4 w-4 text-sky-600" />}
          {...register('cost_price', { valueAsNumber: true, min: 0 })}
          onChange={(event) => {
            const value = event.target.valueAsNumber;
            setValue('cost_price', value);
            setValue('cost_percentage', calculateCostPercentage(Number(watchMrp), value));
          }}
          error={errors.cost_price?.message}
        />
        
        <Input
          label={t('inventory.minStockAlert', 'Low Stock Alert Threshold')}
          type="number"
          step="1"
          {...register('min_stock_alert', { valueAsNumber: true, min: 0 })}
          error={errors.min_stock_alert?.message}
        />

        {Number(watchMrp) > 0 && (
          <p className="text-xs text-text-secondary bg-blue-50 rounded-xl px-3 py-2">
            Selling Price = MRP ({watchMrp}) × (1 - {watchDiscount}%) = <strong>₹{(Number(watchMrp) * (1 - Number(watchDiscount) / 100)).toFixed(2)}</strong>
          </p>
        )}
      </div>
    </Modal>
  );
};

export default EditInventoryModal;
