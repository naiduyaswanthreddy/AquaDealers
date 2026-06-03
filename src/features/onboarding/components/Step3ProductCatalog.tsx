import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { fetchProducts, completeStep } from '../services/onboardingService';
import type { Product } from '@/types/database';
import { toast } from 'sonner';
import { Package, Search, Sparkles } from 'lucide-react';
import { Button, Input, Card, CardContent, Skeleton, Badge } from '@/components/ui';
import { formatCurrency, getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Step3Props {
  onNext: () => void;
  onBack: () => void;
}

export const Step3ProductCatalog: React.FC<Step3Props> = ({ onNext, onBack }) => {
  const { user, fetchDealerProfile } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'feed' | 'medicine'>('feed');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const data = await fetchProducts();
        setProducts(data as Product[]);
      } catch (err: any) {
        console.error(err);
        toast.error('Failed to load pre-seeded product catalog.');
      } finally {
        setLoading(false);
      }
    };
    loadCatalog();
  }, []);

  const filteredProducts = products.filter((p) => {
    const matchesTab = p.type === activeTab;
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.company?.toLowerCase().includes(search.toLowerCase()) ||
      false;
    return matchesTab && matchesSearch;
  });

  const onSubmit = async () => {
    if (!user) return;

    setSaving(true);
    try {
      await completeStep(user.id, 'catalog');
      await fetchDealerProfile();
      toast.success('Catalog preference registered!');
      onNext();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to complete catalog step.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          Preloaded Products
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          We've preloaded standard feeds and medicines into your catalog so you can start billing immediately.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-primary/15 bg-primary/5 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('feed')}
          className={cn(
            'flex-1 text-center py-2.5 text-sm font-bold rounded-lg transition-all',
            activeTab === 'feed'
              ? 'bg-primary text-white shadow-[0_10px_20px_rgba(20,103,159,0.18)]'
              : 'text-primary/70 hover:bg-primary/8 hover:text-primary'
          )}
        >
          🐟 Feed Bags
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('medicine')}
          className={cn(
            'flex-1 text-center py-2.5 text-sm font-bold rounded-lg transition-all',
            activeTab === 'medicine'
              ? 'bg-primary text-white shadow-[0_10px_20px_rgba(20,103,159,0.18)]'
              : 'text-primary/70 hover:bg-primary/8 hover:text-primary'
          )}
        >
          💊 Medicines
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted">
          <Search className="w-5 h-5" />
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={activeTab === 'feed' ? 'Search Avanti, CP, Growel...' : 'Search probiotics, antibiotics...'}
          className="w-full bg-white border border-border rounded-xl text-sm pl-11 pr-4 min-h-[44px] focus-ring"
        />
      </div>

      {/* Grid of Products */}
      <div className="max-h-[300px] overflow-y-auto pr-1">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="border border-border">
                <CardContent className="p-3 space-y-2">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <Skeleton className="w-3/4 h-4" />
                  <Skeleton className="w-1/2 h-3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-8 text-text-secondary text-sm">
            No products found matching your search.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((p) => (
              <Card
                key={p.id}
                className="border border-border bg-white rounded-xl shadow-none hover:shadow-sm transition-shadow"
              >
                <CardContent className="p-3 flex flex-col justify-between h-full">
                  <div>
                    {/* Brand Badge */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-text-secondary flex-shrink-0">
                        {getInitials(p.company || 'P')}
                      </div>
                      <span className="text-[10px] font-semibold text-text-secondary overflow-hidden text-ellipsis whitespace-nowrap">
                        {p.company}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-text-primary line-clamp-2 leading-tight">
                      {p.name}
                    </h4>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {p.variant || p.unit}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">
                      {p.default_price ? formatCurrency(p.default_price) : 'No Price'}
                    </span>
                    <Badge variant="info" className="text-[9px] px-1 py-0 scale-90 origin-right">
                      {p.gst_rate}% GST
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 text-xs text-text-secondary flex items-start gap-2 leading-relaxed">
        <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <div>
          You can edit prices, add stock levels, or create new custom products anytime in the <strong>Stock</strong> module later.
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button variant="secondary" onClick={onBack} className="flex-1 font-semibold">
          Back
        </Button>
        <Button
          variant="primary"
          onClick={onSubmit}
          loading={saving}
          className="flex-1 font-bold"
        >
          Continue
        </Button>
      </div>
    </div>
  );
};

export default Step3ProductCatalog;
