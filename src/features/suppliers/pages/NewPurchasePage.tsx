import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { ArrowLeft, PackagePlus } from 'lucide-react';
import { useRecordPurchase, useRecordPayment, useSuppliers } from '../hooks/useSuppliers';
import { useProducts } from '@/features/inventory/hooks/useInventory';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { PurchasePayload } from '../types';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/layout/SectionCard';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { SearchableSelect } from '@/components/ui';
import { toast } from 'sonner';
import { AddProductModal } from '@/features/inventory/components/AddProductModal';

interface PurchaseForm {
  supplier_id: string;
  product_id: string;
  quantity: number;
  cost_price_per_unit: number;
  selling_price: number;
  mrp?: number;
  medicine_discount_percentage: number;
  gst_rate: number;
  gst_amount: number;
  purchase_date: string;
  invoice_number: string;
  batch_number: string;
  expiry_date: string;
  is_paid: boolean;
  amount_paid?: number;
  payment_method: string;
}

const NewPurchasePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const supplierIdParam = searchParams.get('supplier');

  const { user } = useAuthStore();
  const { activeBranch } = useBranchStore();
  const { data: suppliers } = useSuppliers();
  const { data: products } = useProducts();
  const { mutateAsync: recordPurchase, isPending } = useRecordPurchase();
  const { mutateAsync: recordPayment } = useRecordPayment();
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [productTypeFilter, setProductTypeFilter] = useState<'feed' | 'medicine'>('feed');

  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<PurchaseForm>({
    defaultValues: {
      supplier_id: supplierIdParam || '',
      product_id: '',
      quantity: 1,
      cost_price_per_unit: 0,
      selling_price: 0,
      medicine_discount_percentage: 0,
      mrp: 0,
      gst_rate: 0,
      gst_amount: 0,
      purchase_date: new Date().toISOString().slice(0, 10),
      invoice_number: '',
      batch_number: '',
      expiry_date: '',
      is_paid: true,
      amount_paid: 0,
      payment_method: 'cash',
    }
  });

  // Clear product selection when type filter changes
  useEffect(() => {
    setValue('product_id', '');
  }, [productTypeFilter, setValue]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((p) => p.type === productTypeFilter);
  }, [products, productTypeFilter]);

  const watchQuantity = watch('quantity');
  const watchCostPrice = watch('cost_price_per_unit');
  const watchProductId = watch('product_id');
  const watchGstRate = watch('gst_rate');
  const selectedProduct = products?.find((product) => product.id === watchProductId);
  const isMedicineProduct = selectedProduct?.type === 'medicine';

  // Load default product GST rate and discount when selected product changes
  useEffect(() => {
    if (selectedProduct) {
      setValue('gst_rate', selectedProduct.gst_rate);
      if (selectedProduct.type === 'medicine' && selectedProduct.medicine_discount_percentage !== undefined) {
        setValue('medicine_discount_percentage', selectedProduct.medicine_discount_percentage);
      }
    }
  }, [selectedProduct, setValue]);

  // Automatically compute GST Amount whenever quantity, cost price, or rate changes
  useEffect(() => {
    const qty = Number(watchQuantity) || 0;
    const cost = Number(watchCostPrice) || 0;
    const rate = Number(watchGstRate) || 0;
    const subtotal = qty * cost;
    if (subtotal >= 0) {
      const amount = (subtotal * rate) / 100;
      setValue('gst_amount', Number(amount.toFixed(2)));
    }
  }, [watchQuantity, watchCostPrice, watchGstRate, setValue]);

  useEffect(() => {
    if (!isMedicineProduct) {
      setValue('medicine_discount_percentage', 0);
    }
  }, [isMedicineProduct, setValue]);

  const onSubmit = async (data: PurchaseForm) => {
    if (!user?.id) return;
    try {
      const subtotal = data.quantity * data.cost_price_per_unit;
      const total_amount = subtotal + data.gst_amount;

      await recordPurchase({
        dealer_id: user.id,
        branch_id: activeBranch?.id,
        product_id: data.product_id,
        supplier_id: data.supplier_id,
        quantity: data.quantity,
        cost_price_per_unit: data.cost_price_per_unit,
        gst_amount: data.gst_amount,
        total_amount,
        purchase_date: data.purchase_date,
        invoice_number: data.invoice_number || null,
        batch_number: data.batch_number || null,
        expiry_date: data.expiry_date || null,
        is_paid: data.is_paid,
        selling_price: data.selling_price || undefined,
        mrp: data.mrp || undefined,
        medicine_discount_percentage: isMedicineProduct ? data.medicine_discount_percentage || 0 : 0,
        notes: null,
        payment_method: data.payment_method,
      });

      if (!data.is_paid && data.amount_paid && data.amount_paid > 0) {
        await recordPayment({
          supplierId: data.supplier_id,
          amount: data.amount_paid,
          method: data.payment_method,
          notes: `Partial payment for invoice ${data.invoice_number || 'N/A'}`
        });
      }

      toast.success(t('suppliers.purchaseSuccess', 'Purchase recorded successfully'));
      navigate('/suppliers');
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    }
  };

  const totalAmount = (Number(watchQuantity) || 0) * (Number(watchCostPrice) || 0) + (Number(watch('gst_amount')) || 0);

  return (
    <PageShell width="wide">
      <PageHeader title={t('suppliers.newPurchase')} onBack={() => navigate(-1)} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <SectionCard title="Supplier & Product">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('suppliers.supplier')}</label>
              <select
                {...register('supplier_id', { required: t('common.required') })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
              >
                <option value="">{t('suppliers.selectSupplier')}</option>
                {suppliers?.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.company ? `(${s.company})` : ''}</option>
                ))}
              </select>
              {errors.supplier_id && <p className="text-red-500 text-xs mt-1">{errors.supplier_id.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Type</label>
              <div className="flex p-1.5 bg-slate-100 rounded-xl shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => setProductTypeFilter('feed')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${
                    productTypeFilter === 'feed'
                      ? '!bg-blue-600 !text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }`}
                >
                  Feed Bag
                </button>
                <button
                  type="button"
                  onClick={() => setProductTypeFilter('medicine')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${
                    productTypeFilter === 'medicine'
                      ? '!bg-blue-600 !text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }`}
                >
                  Medicine
                </button>
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  {productTypeFilter === 'feed' ? 'Feed Product' : 'Medicine Product'}
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(true)}
                  className="text-primary text-xs font-bold hover:underline flex items-center gap-1"
                >
                  <PackagePlus className="w-3.5 h-3.5" />
                  {t('inventory.newProduct', 'New Product')}
                </button>
              </div>
              <Controller
                name="product_id"
                control={control}
                rules={{ required: t('common.required') }}
                render={({ field }) => (
                  <SearchableSelect
                    options={filteredProducts.map(p => ({
                      value: p.id,
                      label: p.name,
                      subLabel: p.company || p.type
                    }))}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={
                      productTypeFilter === 'feed'
                        ? 'Select Feed Product'
                        : 'Select Medicine Product'
                    }
                    error={errors.product_id?.message}
                  />
                )}
              />
            </div>

            <Input
              label={t('suppliers.invoiceNumber')}
              {...register('invoice_number')}
              placeholder="INV-..."
            />

            <Input
              label={t('suppliers.purchaseDate')}
              type="date"
              {...register('purchase_date', { required: t('common.required') })}
            />
          </div>
        </SectionCard>

        <SectionCard title="Pricing & Quantities">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Input
              label={t('billing.qty')}
              type="number"
              min="1"
              step="any"
              {...register('quantity', { required: t('common.required'), min: 1 })}
              error={errors.quantity?.message}
            />

            <Input
              label="MRP (₹)"
              type="number"
              min="0"
              step="any"
              {...register('mrp', {
                onChange: (e) => {
                  const mrp = Number(e.target.value) || 0;
                  const discount = Number(watch('medicine_discount_percentage')) || 0;
                  if (mrp > 0 && isMedicineProduct) {
                    setValue('selling_price', Number((mrp * (1 - discount / 100)).toFixed(2)));
                  }
                }
              })}
            />

            <Input
              label={t('suppliers.costPrice')}
              type="number"
              min="0"
              step="any"
              {...register('cost_price_per_unit', { required: t('common.required') })}
              error={errors.cost_price_per_unit?.message}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-gray-100">


            {isMedicineProduct && (
              <Input
                label="Medicine Discount %"
                type="number"
                min="0"
                max="100"
                step="any"
                {...register('medicine_discount_percentage', {
                  onChange: (e) => {
                    const discount = Number(e.target.value) || 0;
                    const mrp = Number(watch('mrp')) || 0;
                    if (mrp > 0) {
                      setValue('selling_price', Number((mrp * (1 - discount / 100)).toFixed(2)));
                    }
                  }
                })}
              />
            )}

            <Input
              label={t('suppliers.sellingPrice')}
              type="number"
              min="0"
              step="any"
              placeholder="To update catalog price"
              {...register('selling_price')}
            />

            <Input
              label={t('inventory.batchNumber', 'Batch Number')}
              {...register('batch_number')}
            />

            <Input
              label={t('inventory.expiryDate', 'Expiry Date')}
              type="date"
              {...register('expiry_date')}
            />
          </div>
        </SectionCard>

        <SectionCard title="Payment Details">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row gap-4 w-full">
              <div className="flex-1">
                <Input
                  label="GST Rate (%)"
                  type="number"
                  min="0"
                  step="any"
                  {...register('gst_rate', {
                    onChange: (e) => {
                      const rate = Number(e.target.value) || 0;
                      const qty = Number(watchQuantity) || 0;
                      const cost = Number(watchCostPrice) || 0;
                      const subtotal = qty * cost;
                      if (subtotal > 0) {
                        const amount = (subtotal * rate) / 100;
                        setValue('gst_amount', Number(amount.toFixed(2)));
                      }
                    }
                  })}
                />
              </div>

              <div className="flex-1">
                <Input
                  label={t('billing.gstAmount', 'GST Amount (₹)')}
                  type="number"
                  min="0"
                  step="any"
                  {...register('gst_amount', {
                    onChange: (e) => {
                      const amount = Number(e.target.value) || 0;
                      const qty = Number(watchQuantity) || 0;
                      const cost = Number(watchCostPrice) || 0;
                      const subtotal = qty * cost;
                      if (subtotal > 0) {
                        const rate = (amount / subtotal) * 100;
                        setValue('gst_rate', Number(rate.toFixed(2)));
                      }
                    }
                  })}
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full">
              <div className="flex flex-col gap-3 w-full md:w-auto p-4 bg-gray-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('is_paid')}
                      className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="font-medium text-gray-900">{t('suppliers.paidInFull')}</span>
                  </label>
                  {!watch('is_paid') && (
                    <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-md font-bold">
                      {t('suppliers.willAddToSupplierDue', 'Will add to Supplier Due')}
                    </span>
                  )}
                </div>

                {!watch('is_paid') && (
                  <div className="mt-2 w-full min-w-[260px] animate-fade-in">
                    <Input
                      label="Amount Paid (₹)"
                      type="number"
                      min="0"
                      max={totalAmount}
                      step="any"
                      placeholder="Enter partial amount paid, if any"
                      {...register('amount_paid', {
                        min: { value: 0, message: 'Amount paid cannot be negative' },
                        max: { value: totalAmount, message: 'Amount paid cannot exceed total amount' }
                      })}
                      error={errors.amount_paid?.message}
                    />
                  </div>
                )}
                
                {(watch('is_paid') || (Number(watch('amount_paid')) > 0)) && (
                  <div className="mt-4 w-full min-w-[260px] animate-fade-in">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('billing.paymentMethod', 'Payment Method')}</label>
                    <select
                      {...register('payment_method')}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all shadow-sm"
                    >
                      <option value="cash">{t('billing.cash', 'Counter Cash')}</option>
                      <option value="upi">UPI / Online</option>
                      <option value="bank_transfer">{t('billing.bankTransfer', 'Bank Transfer')}</option>
                      <option value="cheque">{t('billing.cheque', 'Cheque')}</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="text-right w-full md:w-auto bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <p className="text-sm font-medium text-blue-600 mb-1">{t('billing.total')}</p>
                <p className="text-4xl font-black text-blue-700">₹{totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="pt-2 flex gap-4 sticky bottom-4 z-10 bg-white/80 backdrop-blur p-4 rounded-2xl shadow-lg border border-gray-100 mt-8">
          <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(-1)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" className="flex-1" size="lg" loading={isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>

      <AddProductModal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        onSuccess={(productId) => {
          setValue('product_id', productId);
        }}
      />
    </PageShell>
  );
};

export default NewPurchasePage;
