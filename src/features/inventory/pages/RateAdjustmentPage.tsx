import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, TrendingUp, Search, CheckCircle2, Calculator } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Select, Input } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { inventoryService } from '../services/inventoryService';
import { useInventory } from '../hooks/useInventory';
import { toast } from 'sonner';

interface AdjustmentTarget {
  farmer_id: string;
  farmer_name: string;
  farmer_phone: string;
  total_quantity: number;
  avg_unit_price: number;
  bill_count: number;
  selected: boolean;
}

export default function RateAdjustmentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { productId?: string; rateDifference?: number } | null;
  const { user } = useAuthStore();
  const { activeBranch, isAllBranches } = useBranchStore();
  const branchId = isAllBranches ? null : activeBranch?.id;

  const { data: inventory = [] } = useInventory();
  
  // Only show active products that have been billed
  const products = useMemo(() => {
    return Array.from(new Map(inventory.map(item => [item.product.id, item.product])).values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory]);

  const [selectedProductId, setSelectedProductId] = useState(state?.productId || '');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [targets, setTargets] = useState<AdjustmentTarget[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [rateDifference, setRateDifference] = useState<number | ''>(state?.rateDifference || '');
  const [isApplying, setIsApplying] = useState(false);

  const handleSearch = async () => {
    if (!user?.id || !selectedProductId) return;
    
    setIsLoading(true);
    try {
      const results = await inventoryService.getRateAdjustmentTargets(
        user.id,
        selectedProductId,
        startDate,
        endDate
      );
      setTargets(results.map(r => ({ ...r, selected: true })));
      setHasSearched(true);
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch targets');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (state?.productId && user?.id) {
      handleSearch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.productId, user?.id]);

  const handleApply = async () => {
    if (!user?.id || !selectedProductId || rateDifference === '' || Number(rateDifference) <= 0) return;
    
    const selectedTargets = targets.filter(t => t.selected);
    if (selectedTargets.length === 0) {
      toast.error('No farmers selected');
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    setIsApplying(true);
    try {
      const adjustments = selectedTargets.map(t => ({
        farmerId: t.farmer_id,
        farmerName: t.farmer_name,
        productId: product.id,
        productName: product.name,
        totalBags: t.total_quantity,
        rateDifference: Number(rateDifference),
        totalAdjustment: t.total_quantity * Number(rateDifference),
      }));

      await inventoryService.applyRateAdjustments(user.id, branchId ?? null, adjustments);
      
      toast.success(`Successfully applied rate adjustment to ${selectedTargets.length} farmers`);
      navigate('/inventory');
    } catch (error) {
      console.error(error);
      toast.error('Failed to apply adjustments');
    } finally {
      setIsApplying(false);
    }
  };

  const toggleTarget = (farmerId: string) => {
    setTargets(targets.map(t => t.farmer_id === farmerId ? { ...t, selected: !t.selected } : t));
  };

  const totalBags = targets.filter(t => t.selected).reduce((sum, t) => sum + Number(t.total_quantity), 0);
  const totalAmount = totalBags * (Number(rateDifference) || 0);

  return (
    <PageShell>
      <PageHeader
        title="Rate Difference Adjustment"
        eyebrow="Pro Feature"
        onBack={() => navigate('/inventory')}
      />

      <div className="space-y-6">
        {/* Step 1: Filter */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Step 1: Select Product & Timeframe</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
              <Select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                options={[
                  { value: '', label: 'Select a product...' },
                  ...products.map(p => ({ value: p.id, label: p.name }))
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">From Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">To Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <Button
              variant="primary"
              onClick={handleSearch}
              loading={isLoading}
              disabled={!selectedProductId}
              leftIcon={<Search className="w-4 h-4" />}
            >
              Find Unpaid Credit Sales
            </Button>
          </div>
        </div>

        {/* Step 2: Results & Adjustment */}
        {hasSearched && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Step 2: Apply Difference</h3>
            
            {targets.length === 0 ? (
              <div className="text-center py-10">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4">
                  <CheckCircle2 className="w-6 h-6 text-slate-400" />
                </div>
                <h4 className="text-slate-800 font-medium mb-1">No pending credit sales found</h4>
                <p className="text-slate-500 text-sm">No farmers were billed for this product in the selected timeframe.</p>
              </div>
            ) : (
              <>
                <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100 mb-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-blue-900 mb-1">Rate Difference per Unit</h4>
                    <p className="text-xs text-blue-700 mb-3">Enter the extra amount to charge per bag/unit.</p>
                    <div className="relative max-w-[200px]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                      <Input
                        type="number"
                        min="0"
                        placeholder="e.g. 100"
                        className="pl-8 font-semibold text-lg"
                        value={rateDifference}
                        onChange={(e) => setRateDifference(e.target.value ? Number(e.target.value) : '')}
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-8 text-right bg-white p-4 rounded-xl border border-blue-100/50 shadow-sm w-full md:w-auto">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Selected Bags</p>
                      <p className="text-2xl font-bold text-slate-800">{totalBags}</p>
                    </div>
                    <div className="w-px bg-slate-200"></div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Total Due to Add</p>
                      <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalAmount)}</p>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 w-10 text-center">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                            checked={targets.every(t => t.selected)}
                            onChange={(e) => setTargets(targets.map(t => ({ ...t, selected: e.target.checked })))}
                          />
                        </th>
                        <th className="px-4 py-3 font-medium">Farmer</th>
                        <th className="px-4 py-3 font-medium text-right">Bags Billed</th>
                        <th className="px-4 py-3 font-medium text-right">Avg. Old Rate</th>
                        <th className="px-4 py-3 font-medium text-right text-blue-700 bg-blue-50/50">Extra Charge</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {targets.map((target) => {
                        const charge = target.total_quantity * (Number(rateDifference) || 0);
                        return (
                          <tr key={target.farmer_id} className={`hover:bg-slate-50/80 transition-colors ${!target.selected ? 'opacity-50 bg-slate-50' : ''}`}>
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                                checked={target.selected}
                                onChange={() => toggleTarget(target.farmer_id)}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{target.farmer_name}</div>
                              <div className="text-xs text-slate-500">{target.farmer_phone || 'No phone'}</div>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-700">
                              {target.total_quantity}
                              <span className="text-xs text-slate-400 font-normal ml-1">across {target.bill_count} bills</span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-600">
                              {formatCurrency(target.avg_unit_price)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-blue-700 bg-blue-50/30">
                              {charge > 0 ? `+${formatCurrency(charge)}` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-8 flex justify-end border-t border-slate-100 pt-6">
                  <Button
                    size="lg"
                    variant="primary"
                    onClick={handleApply}
                    loading={isApplying}
                    disabled={totalAmount <= 0 || !rateDifference}
                    leftIcon={<Calculator className="w-5 h-5" />}
                  >
                    Apply Adjustment & Update Ledgers
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
