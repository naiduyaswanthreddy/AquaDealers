import React from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, EmptyState, Input, Modal, SearchableSelect } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { Product } from '@/types/database';
import { useProducts } from '@/features/inventory/hooks/useInventory';
import {
  useDeleteFarmerProductDiscount,
  useFarmerProductDiscounts,
  useUpsertFarmerProductDiscount,
} from '../hooks/useFarmers';

interface FarmerProductDiscountsProps {
  farmerId: string;
  farmerName: string;
  defaultDiscount: number;
}

const isMedicine = (product?: Product | null) => {
  const type = (product?.type || '').toLowerCase();
  return type.includes('medicine') || type.includes('medic');
};

export const FarmerProductDiscounts: React.FC<FarmerProductDiscountsProps> = ({
  farmerId,
  farmerName,
  defaultDiscount,
}) => {
  const { data: discounts = [], isLoading } = useFarmerProductDiscounts(farmerId);
  const { data: products = [] } = useProducts();
  const { mutateAsync: upsertDiscount, isPending: isSaving } = useUpsertFarmerProductDiscount();
  const { mutateAsync: deleteDiscount, isPending: isDeleting } = useDeleteFarmerProductDiscount();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [selectedProductId, setSelectedProductId] = React.useState('');
  const [discountPercentage, setDiscountPercentage] = React.useState('');
  const [search, setSearch] = React.useState('');

  const medicineProducts = React.useMemo(
    () =>
      products
        .filter(isMedicine)
        .filter((product) => {
          const query = search.trim().toLowerCase();
          if (!query) return true;
          return product.name.toLowerCase().includes(query) || (product.company || '').toLowerCase().includes(query);
        }),
    [products, search]
  );

  const selectedProduct = products.find((product) => product.id === selectedProductId);

  const openEdit = (productId?: string, discount?: number) => {
    setSelectedProductId(productId || '');
    setDiscountPercentage(discount != null ? String(discount) : '');
    setSearch('');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedProductId) {
      toast.error('Select a medicine product.');
      return;
    }

    const value = Math.min(Math.max(Number(discountPercentage) || 0, 0), 100);
    await upsertDiscount({ farmerId, productId: selectedProductId, discountPercentage: value });
    toast.success('Medicine discount saved.');
    setIsModalOpen(false);
  };

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Medicine Discounts</div>
          <div className="mt-1 text-sm font-semibold text-slate-600">
            Default for {farmerName}: <span className="font-black text-slate-900">{defaultDiscount || 0}%</span>
          </div>
        </div>
        <Button type="button" onClick={() => openEdit()} leftIcon={<Plus className="h-4 w-4" />} className="min-h-11">
          Add Product
        </Button>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Loading discounts...</div>
        ) : discounts.length ? (
          <div className="space-y-2">
            {discounts.map((discount) => {
              const product = discount.product;
              const basePrice = Number(product?.default_price || 0);
              const discountedPrice = Number((basePrice * (1 - Number(discount.discount_percentage || 0) / 100)).toFixed(2));
              return (
                <div
                  key={discount.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:grid sm:grid-cols-[minmax(0,1fr)_7rem_7rem_6rem] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-900">{product?.name || 'Unknown product'}</div>
                    <div className="truncate text-xs font-semibold text-slate-500">{product?.company || 'No company'}</div>
                  </div>
                  <div className="flex items-center justify-between sm:block sm:text-right">
                    <span className="text-xs font-bold text-slate-400 sm:hidden">Discount</span>
                    <span className="text-sm font-black text-emerald-700">{discount.discount_percentage}%</span>
                  </div>
                  <div className="flex items-center justify-between sm:block sm:text-right">
                    <span className="text-xs font-bold text-slate-400 sm:hidden">Approx rate</span>
                    <span className="text-sm font-bold text-slate-700">{formatCurrency(discountedPrice)}</span>
                  </div>
                  <div className="flex gap-2 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => openEdit(discount.product_id, Number(discount.discount_percentage || 0))}
                      className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-100 sm:flex-none"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => deleteDiscount({ farmerId, discountId: discount.id })}
                      className="flex min-h-11 w-11 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                      aria-label="Delete discount"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title="No product discounts"
            description="This farmer will use the default medicine discount until you add product-specific rates."
            className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-8"
          />
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Medicine Product Discount"
        className="max-w-xl"
      >
        <div className="space-y-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search medicine..."
            label="Search"
          />
          <SearchableSelect
            value={selectedProductId}
            onChange={setSelectedProductId}
            placeholder="Select medicine product..."
            options={medicineProducts.map((product) => ({
              value: product.id,
              label: product.name,
              subLabel: product.company || product.type,
            }))}
          />
          <Input
            label="Discount %"
            type="number"
            min={0}
            max={100}
            value={discountPercentage}
            onChange={(event) => setDiscountPercentage(event.target.value)}
            placeholder={String(defaultDiscount || 0)}
          />
          <div className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">
            {selectedProduct ? (
              <>
                {selectedProduct.name}: {Number(discountPercentage || defaultDiscount || 0)}% for {farmerName}
              </>
            ) : (
              'Select a product to save a farmer-specific discount.'
            )}
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" loading={isSaving} onClick={handleSave}>
              Save Discount
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
};

export default FarmerProductDiscounts;
