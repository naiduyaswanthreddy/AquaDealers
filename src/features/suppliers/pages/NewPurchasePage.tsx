import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { ArrowDownLeft, ArrowUpRight, PackagePlus, Plus, Trash2, TrendingUp } from 'lucide-react';
import { useRecordPurchase, useRecordPayment, useSuppliers, useRecordSupplierCharge } from '../hooks/useSuppliers';
import { useInventory, useProducts } from '@/features/inventory/hooks/useInventory';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/layout/SectionCard';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Modal, SearchableSelect } from '@/components/ui';
import { toast } from 'sonner';
import { AddProductModal } from '@/features/inventory/components/AddProductModal';
import { EditProductModal } from '@/features/inventory/components/EditProductModal';
import { formatCurrency } from '@/lib/utils';

interface PurchaseItemForm {
  product_id: string;
  quantity?: number;
  cost_percentage?: number;
  cost_price_per_unit?: number;
  selling_price?: number;
  mrp?: number;
  medicine_discount_percentage?: number;
  gst_rate?: number;
  gst_amount?: number;
  batch_number: string;
  expiry_date: string;
}

interface PurchaseForm {
  supplier_id: string;
  purchase_date: string;
  invoice_number: string;
  is_paid: boolean;
  amount_paid?: number;
  additional_charges?: number;
  payment_method: string;
  notes?: string;
  items: PurchaseItemForm[];
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
  const { data: inventory = [] } = useInventory();
  const { mutateAsync: recordPurchase, isPending } = useRecordPurchase();
  const { mutateAsync: recordPayment } = useRecordPayment();
  const { mutateAsync: recordSupplierCharge } = useRecordSupplierCharge();
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [rateAdjustmentPrompts, setRateAdjustmentPrompts] = useState<{
    productId: string;
    productName: string;
    oldUnitPrice: number;
    newUnitPrice: number;
    rateDifference: number;
  }[]>([]);
  
  const { register, handleSubmit, watch, control, setValue, formState: { errors } } = useForm<PurchaseForm>({
    defaultValues: {
      supplier_id: supplierIdParam || '',
      purchase_date: new Date().toISOString().split('T')[0],
      invoice_number: '',
      is_paid: false,
      amount_paid: '' as any,
      additional_charges: '' as any,
      payment_method: 'upi',
      items: [
        {
          product_id: '',
          quantity: '' as any,
          cost_percentage: '' as any,
          cost_price_per_unit: '' as any,
          selling_price: '' as any,
          mrp: '' as any,
          medicine_discount_percentage: '' as any,
          gst_rate: '' as any,
          gst_amount: '' as any,
          batch_number: '',
          expiry_date: '',
        }
      ]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const watchItems = watch('items');
  const watchIsPaid = watch('is_paid');

  const calculateItemGst = (costPrice: number, quantity: number, gstRate: number) => {
    return (costPrice * quantity * gstRate) / 100;
  };

  const calculateSellingPrice = (mrp?: number, discount?: number) => {
    const numericMrp = Number(mrp) || 0;
    const numericDiscount = Math.min(Math.max(Number(discount) || 0, 0), 100);
    if (numericMrp <= 0) return undefined;
    return Number((numericMrp * (1 - numericDiscount / 100)).toFixed(2));
  };

  const calculateCostPrice = (mrp?: number, costPercentage?: number) => {
    const numericMrp = Number(mrp) || 0;
    const numericCostPercentage = Number(costPercentage) || 0;
    if (numericMrp <= 0 || numericCostPercentage < 0) return undefined;
    // Cost% represents the margin/discount from MRP
    // When MRP=100 and cost%=40, cost price = 100 - (100 * 40/100) = 60
    return Number((numericMrp * (1 - numericCostPercentage / 100)).toFixed(2));
  };

  const calculateCostPercentage = (mrp?: number, costPrice?: number) => {
    const numericMrp = Number(mrp) || 0;
    const numericCostPrice = Number(costPrice) || 0;
    if (numericMrp <= 0 || numericCostPrice < 0) return undefined;
    // Cost% = (MRP - Cost Price) / MRP * 100
    return Number((((numericMrp - numericCostPrice) / numericMrp) * 100).toFixed(2));
  };

  const normalizeNumber = (value: number | undefined, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  };

  const getStoredInventoryForProduct = (productId: string) =>
    inventory.find((item) => item.product_id === productId);

  const handleProductSelect = (index: number, productId: string) => {
    const product = products?.find(p => p.id === productId);
    const storedInventory = getStoredInventoryForProduct(productId);
    const enteredItem = watchItems.find((item, itemIndex) => itemIndex !== index && item.product_id === productId);
    setValue(`items.${index}.product_id`, productId);
    if (product) {
      const mrp = Number(enteredItem?.mrp || storedInventory?.mrp || product.default_price || 0) || undefined;
      const discount = Number(enteredItem?.medicine_discount_percentage ?? storedInventory?.medicine_discount_percentage ?? product.medicine_discount_percentage ?? 0);
      const fallbackSellingPrice = Number(enteredItem?.selling_price || storedInventory?.selling_price || product.default_price || 0) || undefined;
      
      // Only auto-calculate selling price if it's currently empty, to allow manual override
      const currentSellingPrice = Number(watchItems[index]?.selling_price);
      let sellingPrice = fallbackSellingPrice;
      if (!currentSellingPrice) {
        sellingPrice = calculateSellingPrice(mrp, discount) ?? fallbackSellingPrice;
      } else {
        sellingPrice = currentSellingPrice;
      }
      const costPrice = Number(enteredItem?.cost_price_per_unit || storedInventory?.cost_price || 0) || undefined;
      const costPercentage = Number(enteredItem?.cost_percentage) || calculateCostPercentage(mrp, costPrice);
      setValue(`items.${index}.cost_percentage`, costPercentage);
      setValue(`items.${index}.cost_price_per_unit`, costPrice);
      setValue(`items.${index}.mrp`, mrp);
      setValue(`items.${index}.medicine_discount_percentage`, discount);
      setValue(`items.${index}.selling_price`, sellingPrice);
      setValue(`items.${index}.gst_rate`, Number(enteredItem?.gst_rate || product.gst_rate || 0) || undefined);
      
      const quantity = watchItems[index]?.quantity || 1;
      const gstRate = Number(enteredItem?.gst_rate || product.gst_rate || 0);
      const gstAmount = calculateItemGst(costPrice || 0, quantity, gstRate);
      setValue(`items.${index}.gst_amount`, gstAmount);
    }
  };

  const handleQuantityOrPriceChange = (index: number) => {
    const item = watchItems[index];
    if (item) {
      const gstAmount = calculateItemGst(item.cost_price_per_unit || 0, item.quantity || 0, item.gst_rate || 0);
      setValue(`items.${index}.gst_amount`, gstAmount);
    }
  };

  const handleCostPercentageChange = (index: number, value: number) => {
    const item = watchItems[index];
    if (!item) return;

    const costPrice = calculateCostPrice(item.mrp, value);
    setValue(`items.${index}.cost_price_per_unit`, costPrice);
    setValue(
      `items.${index}.gst_amount`,
      calculateItemGst(costPrice || 0, item.quantity || 0, item.gst_rate || 0)
    );
  };

  const handleCostPriceChange = (index: number, value: number) => {
    const item = watchItems[index];
    if (!item) return;

    setValue(`items.${index}.cost_percentage`, calculateCostPercentage(item.mrp, value));
    setValue(
      `items.${index}.gst_amount`,
      calculateItemGst(value || 0, item.quantity || 0, item.gst_rate || 0)
    );
  };

  const handlePricingChange = (
    index: number,
    nextValues: Partial<Pick<PurchaseItemForm, 'mrp' | 'medicine_discount_percentage'>> = {}
  ) => {
    const item = watchItems[index];
    if (!item) return;
    const sellingPrice = calculateSellingPrice(
      nextValues.mrp ?? item.mrp,
      nextValues.medicine_discount_percentage ?? item.medicine_discount_percentage
    );
    setValue(`items.${index}.selling_price`, sellingPrice);

    if (nextValues.mrp != null) {
      if (item.cost_percentage) {
        const costPrice = calculateCostPrice(nextValues.mrp, item.cost_percentage);
        setValue(`items.${index}.cost_price_per_unit`, costPrice);
        setValue(
          `items.${index}.gst_amount`,
          calculateItemGst(costPrice || 0, item.quantity || 0, item.gst_rate || 0)
        );
      } else if (item.cost_price_per_unit) {
        setValue(`items.${index}.cost_percentage`, calculateCostPercentage(nextValues.mrp, item.cost_price_per_unit));
      }
    }
  };

  const handleSellingPriceChange = (index: number, newSellingPrice: number) => {
    const item = watchItems[index];
    if (!item || !item.mrp || item.mrp <= 0) return;
    const newDiscount = ((item.mrp - newSellingPrice) / item.mrp) * 100;
    setValue(`items.${index}.medicine_discount_percentage`, Number(newDiscount.toFixed(2)));
    setValue(`items.${index}.selling_price`, newSellingPrice);
  };

  const onSubmit = async (data: PurchaseForm) => {
    if (!user?.id) return;
    if (data.items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    try {
      let totalBillAmount = 0;
      const adjustmentPrompts: typeof rateAdjustmentPrompts = [];

      for (const item of data.items) {
        const product = products?.find(p => p.id === item.product_id);
        const isMedicine = product?.type === 'medicine';
        
        const quantity = normalizeNumber(item.quantity);
        const costPrice = normalizeNumber(item.cost_price_per_unit);
        const gstAmount = normalizeNumber(item.gst_amount);
        const subtotal = quantity * costPrice;
        const total_amount = subtotal + gstAmount;
        totalBillAmount += total_amount;

        const purchaseResult = await recordPurchase({
          dealer_id: user.id,
          branch_id: activeBranch?.id,
          product_id: item.product_id,
          supplier_id: data.supplier_id,
          quantity,
          cost_price_per_unit: costPrice,
          gst_amount: gstAmount,
          total_amount,
          purchase_date: data.purchase_date,
          invoice_number: data.invoice_number || null,
          batch_number: item.batch_number || null,
          expiry_date: item.expiry_date || null,
          is_paid: data.is_paid,
          selling_price: normalizeNumber(item.selling_price, normalizeNumber(item.mrp)) || undefined,
          mrp: normalizeNumber(item.mrp) || undefined,
          medicine_discount_percentage: isMedicine ? normalizeNumber(item.medicine_discount_percentage) : 0,
          notes: data.notes || null,
          payment_method: data.payment_method,
        });

        if (
          purchaseResult.rate_adjustment_required &&
          purchaseResult.previous_final_unit_price != null &&
          purchaseResult.new_final_unit_price != null &&
          Number(purchaseResult.rate_difference || 0) > 0
        ) {
          adjustmentPrompts.push({
            productId: item.product_id,
            productName: product?.name || 'Selected product',
            oldUnitPrice: Number(purchaseResult.previous_final_unit_price),
            newUnitPrice: Number(purchaseResult.new_final_unit_price),
            rateDifference: Number(purchaseResult.rate_difference),
          });
        }
      }

      if (!data.is_paid && data.amount_paid && data.amount_paid > 0) {
        await recordPayment({
          supplierId: data.supplier_id,
          amount: data.amount_paid,
          method: data.payment_method,
          notes: `Partial payment for invoice ${data.invoice_number || 'N/A'}`
        });
      }

      if (data.additional_charges && data.additional_charges > 0) {
        await recordSupplierCharge({
          supplierId: data.supplier_id,
          amount: data.additional_charges,
          notes: `Additional charges for invoice ${data.invoice_number || 'N/A'}`
        });
      }

      toast.success(t('suppliers.purchaseSuccess', 'Purchase recorded successfully'));
      if (adjustmentPrompts.length > 0) {
        setRateAdjustmentPrompts(adjustmentPrompts);
      } else {
        navigate('/suppliers');
      }
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    }
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let gst = 0;
    let profit = 0;
    watchItems?.forEach(item => {
      const itemSubtotal = (Number(item.quantity) || 0) * (Number(item.cost_price_per_unit) || 0);
      const itemProfit = ((Number(item.selling_price) || 0) - (Number(item.cost_price_per_unit) || 0)) * (Number(item.quantity) || 0);
      subtotal += itemSubtotal;
      gst += (Number(item.gst_amount) || 0);
      profit += itemProfit;
    });
    
    // We add additional charges to the overall total to display it clearly,
    // though the purchase items will only reflect their respective subtotals and gst.
    const addCharges = Number(watch('additional_charges')) || 0;
    
    return { subtotal, gst, profit, addCharges, total: subtotal + gst + addCharges };
  }, [watchItems, watch('additional_charges')]);

  return (
    <PageShell width="wide">
      <PageHeader title="New Purchase Bill" onBack={() => navigate(-1)} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <SectionCard title="Invoice Details">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

            <Input
              label={t('suppliers.invoiceNumber', 'Invoice Number')}
              {...register('invoice_number')}
              error={errors.invoice_number?.message}
            />

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">{t('suppliers.purchaseDate', 'Purchase Date')}</label>
              <Controller
                control={control}
                name="purchase_date"
                rules={{ required: t('common.required') }}
                render={({ field }) => (
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t('suppliers.purchaseDate', 'Purchase Date')}
                  />
                )}
              />
              {errors.purchase_date && <p className="text-xs text-red-500 mt-1">{errors.purchase_date.message}</p>}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Items">
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={() => setIsAddProductModalOpen(true)}
              className="text-primary text-xs font-bold hover:underline flex items-center gap-1"
            >
              <PackagePlus className="w-4 h-4" />
              New Product
            </button>
          </div>
          <div className="space-y-4">
            {fields.map((field, index) => {
              const product = products?.find(p => p.id === watchItems[index]?.product_id);
              const isMedicine = product?.type === 'medicine';
              const discount = Number(watchItems[index]?.medicine_discount_percentage) || 0;
              const mrp = Number(watchItems[index]?.mrp) || 0;
              const costPrice = Number(watchItems[index]?.cost_price_per_unit) || 0;
              const sellingPrice = Number(watchItems[index]?.selling_price) || calculateSellingPrice(mrp, discount) || 0;
              const itemProfit = (sellingPrice - costPrice) * (Number(watchItems[index]?.quantity) || 0);

              return (
                <div key={field.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50 relative">
                  {fields.length > 1 && (
                    <div className="absolute top-4 right-4">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className={fields.length > 1 ? "md:col-span-11" : "md:col-span-12"}>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-3">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Product</label>
                            {watchItems[index]?.product_id && (
                              <button
                                type="button"
                                onClick={() => setEditingProductId(watchItems[index].product_id)}
                                className="text-[10px] text-blue-600 hover:underline font-bold uppercase tracking-wider"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                          <Controller
                            name={`items.${index}.product_id`}
                            control={control}
                            rules={{ required: true }}
                            render={({ field: { value } }) => (
                              <SearchableSelect
                                options={(products || []).map(p => ({
                                  value: p.id,
                                  label: `${p.name} - ${p.unit || 'Unit'}`,
                                  subLabel: p.company || p.type
                                }))}
                                value={value}
                                onChange={(val) => handleProductSelect(index, val)}
                                placeholder="Select product..."
                              />
                            )}
                          />
                        </div>
                        <div className="md:col-span-1">
                          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Qty</label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            {...register(`items.${index}.quantity`, { 
                              required: true,
                              valueAsNumber: true,
                              onChange: () => handleQuantityOrPriceChange(index) 
                            })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">MRP</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Enter MRP"
                            {...register(`items.${index}.mrp`, {
                              required: true,
                              valueAsNumber: true,
                              onChange: (event) => handlePricingChange(index, { mrp: event.target.valueAsNumber })
                            })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="mb-1 flex items-center gap-1 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                            Discount % (Farmer Discount %)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder="Discount"
                            {...register(`items.${index}.medicine_discount_percentage`, {
                              valueAsNumber: true,
                              onChange: (event) => handlePricingChange(index, { medicine_discount_percentage: event.target.valueAsNumber })
                            })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="mb-1 flex items-center gap-1 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                            Sell Price
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            {...register(`items.${index}.selling_price`, { 
                              valueAsNumber: true,
                              onChange: (event) => handleSellingPriceChange(index, event.target.valueAsNumber)
                            })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="mb-1 flex items-center gap-1 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            <ArrowDownLeft className="h-3.5 w-3.5 text-sky-600" />
                            Cost Discount % (Dealer Discount %)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Cost %"
                            {...register(`items.${index}.cost_percentage`, {
                              valueAsNumber: true,
                              onChange: (event) => handleCostPercentageChange(index, event.target.valueAsNumber)
                            })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="mb-1 flex items-center gap-1 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            <ArrowDownLeft className="h-3.5 w-3.5 text-sky-600" />
                            Cost Price
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Enter cost"
                            {...register(`items.${index}.cost_price_per_unit`, { 
                              valueAsNumber: true,
                              onChange: (event) => handleCostPriceChange(index, event.target.valueAsNumber)
                            })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          />
                        </div>


                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">GST Rate (%)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            {...register(`items.${index}.gst_rate`, {
                              valueAsNumber: true,
                              onChange: () => handleQuantityOrPriceChange(index)
                            })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">GST Amt</label>
                          <input
                            type="number"
                            step="0.01"
                            readOnly
                            {...register(`items.${index}.gst_amount`, { valueAsNumber: true })}
                            className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 outline-none"
                          />
                        </div>
                        {mrp > 0 && (
                          <div className="md:col-span-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                            Selling price = {formatCurrency(mrp)} - {discount}% = {formatCurrency(sellingPrice)}
                            <span className={itemProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                              Profit: {formatCurrency(itemProfit)}
                            </span>
                          </div>
                        )}
                        
                        {isMedicine && (
                          <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Batch No.</label>
                            <input
                              type="text"
                              {...register(`items.${index}.batch_number`)}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                          </div>
                        )}
                        {isMedicine && (
                          <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Expiry Date</label>
                            <Controller
                              control={control}
                              name={`items.${index}.expiry_date`}
                              render={({ field }) => (
                                <DatePicker
                                  value={field.value || ''}
                                  onChange={field.onChange}
                                  placeholder="Expiry Date"
                                />
                              )}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => append({
                product_id: '',
                quantity: 1,
                cost_percentage: undefined,
                cost_price_per_unit: undefined,
                selling_price: undefined,
                mrp: undefined,
                medicine_discount_percentage: undefined,
                gst_rate: undefined,
                gst_amount: undefined,
                batch_number: '',
                expiry_date: '',
              })}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Item
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Payment & Summary">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  {...register('is_paid')}
                  className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-900">{t('suppliers.fullyPaid', 'Fully Paid')}</span>
              </label>

              {!watchIsPaid && (
                <Input
                  label={t('suppliers.amountPaid', 'Amount Paid')}
                  type="number"
                  min="0"
                  max={totals.total}
                  step="0.01"
                  {...register('amount_paid')}
                  helperText="Leave empty if unpaid"
                />
              )}
              
              <Input
                label="Additional Charges"
                type="number"
                min="0"
                step="0.01"
                {...register('additional_charges')}
                helperText="Extra charges (e.g. transport). Adds to total due."
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.paymentMethod', 'Payment Method')}</label>
                <select
                  {...register('payment_method')}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                >
                  <option value="upi">UPI / Online</option>
                  <option value="cash">{t('common.cash', 'Counter Cash')}</option>
                  <option value="bank_transfer">{t('common.bankTransfer', 'Bank Transfer')}</option>
                  <option value="cheque">{t('common.cheque', 'Cheque')}</option>
                </select>
              </div>

              <div className="col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4 mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.notes', 'Notes (Optional)')}</label>
                <textarea
                  {...register('notes')}
                  placeholder="Any additional information..."
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all resize-none"
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-gray-600">
                  <span>Total GST</span>
                  <span className="font-medium">{formatCurrency(totals.gst)}</span>
                </div>
                {totals.addCharges > 0 && (
                  <div className="flex justify-between items-center text-gray-600">
                    <span>Additional Charges</span>
                    <span className="font-medium text-amber-600">+{formatCurrency(totals.addCharges)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-gray-600">
                  <span>Profit Amount</span>
                  <span className={totals.profit >= 0 ? 'font-bold text-emerald-700' : 'font-bold text-red-600'}>
                    {formatCurrency(totals.profit)}
                  </span>
                </div>
                <div className="pt-3 border-t border-gray-200 flex justify-between items-center text-lg font-black text-gray-900">
                  <span>Total Amount</span>
                  <span className="text-blue-600">{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              disabled={isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              loading={isPending}
            >
              {t('common.save', 'Save Purchase Bill')}
            </Button>
          </div>
        </SectionCard>
      </form>

      <AddProductModal 
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
      />

      {editingProductId && (
        <EditProductModal
          isOpen={true}
          onClose={() => setEditingProductId(null)}
          productId={editingProductId}
        />
      )}

      <Modal
        isOpen={rateAdjustmentPrompts.length > 0}
        onClose={() => navigate('/suppliers')}
        title="Apply credit rate adjustment?"
        className="max-w-xl"
      >
        <div className="space-y-4 p-4">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <TrendingUp className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-bold">New purchase price is higher.</div>
              <div className="mt-1">You can add the rate difference to unpaid credit farmer bills now, or use manual rate adjustment later.</div>
            </div>
          </div>

          <div className="space-y-2">
            {rateAdjustmentPrompts.map((prompt) => (
              <div key={prompt.productId} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                <div>
                  <div className="font-bold text-slate-900">{prompt.productName}</div>
                  <div className="text-sm text-slate-500">
                    {formatCurrency(prompt.oldUnitPrice)} to {formatCurrency(prompt.newUnitPrice)}
                  </div>
                </div>
                <div className="text-right font-black text-emerald-700">
                  +{formatCurrency(prompt.rateDifference)}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => navigate('/suppliers')}>
              Later
            </Button>
            <Button
              type="button"
              onClick={() => {
                const first = rateAdjustmentPrompts[0];
                navigate('/inventory/rate-adjustment', {
                  state: {
                    productId: first.productId,
                    rateDifference: first.rateDifference,
                    oldUnitPrice: first.oldUnitPrice,
                    newUnitPrice: first.newUnitPrice,
                    source: 'purchase',
                  },
                });
              }}
            >
              Adjust Credit Bills
            </Button>
          </div>
        </div>
      </Modal>
    </PageShell>
  );
};

export default NewPurchasePage;
