import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Calendar, CheckSquare, Square } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/layout/SectionCard';
import { DatePicker } from '@/components/ui/DatePicker';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { useFarmers } from '@/features/farmers/hooks/useFarmers';
import { useInventory } from '@/features/inventory/hooks/useInventory';
import { billingService } from '@/features/billing/services/billingService';
import { toast } from 'sonner';

interface HistoricalRow {
  id: string;
  date: string;
  inventoryId: string;
  quantity: number;
  unitPrice: number;
}

const BulkHistoricalBillPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const farmerId = searchParams.get('farmer');
  
  const { user } = useAuthStore();
  const { activeBranch, isAllBranches } = useBranchStore();
  const branchId = isAllBranches ? null : activeBranch?.id;

  const { data: farmers } = useFarmers();
  const { data: inventoryData } = useInventory();
  
  const [reduceStock, setReduceStock] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const defaultDate = new Date().toISOString().split('T')[0];
  
  const [rows, setRows] = useState<HistoricalRow[]>([
    { id: crypto.randomUUID(), date: defaultDate, inventoryId: '', quantity: 1, unitPrice: 0 }
  ]);

  const selectedFarmer = useMemo(() => {
    return farmers?.find(f => f.id === farmerId) || null;
  }, [farmers, farmerId]);

  const addRow = () => {
    setRows([...rows, { id: crypto.randomUUID(), date: defaultDate, inventoryId: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeRow = (id: string) => {
    if (rows.length === 1) return;
    setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: keyof HistoricalRow, value: any) => {
    setRows(rows.map(r => {
      if (r.id === id) {
        const newRow = { ...r, [field]: value };
        if (field === 'inventoryId' && inventoryData) {
          const item = inventoryData.find(i => i.id === value);
          if (item) {
            newRow.unitPrice = item.selling_price || item.cost_price || 0;
          }
        }
        return newRow;
      }
      return r;
    }));
  };

  const handleSubmit = async () => {
    if (!user?.id || !farmerId || !selectedFarmer) {
      toast.error('Dealer or Farmer information missing');
      return;
    }

    // Validate rows
    const validRows = rows.filter(r => r.inventoryId && r.quantity > 0);
    if (validRows.length === 0) {
      toast.error('Please add at least one valid item');
      return;
    }

    setIsSubmitting(true);
    
    // Group rows by Date so we create one Bill per Date
    const groupedByDate: Record<string, HistoricalRow[]> = {};
    validRows.forEach(row => {
      if (!groupedByDate[row.date]) {
        groupedByDate[row.date] = [];
      }
      groupedByDate[row.date].push(row);
    });

    try {
      for (const [date, dateRows] of Object.entries(groupedByDate)) {
        let subtotal = 0;
        const items = dateRows.map(row => {
          const inv = inventoryData?.find(i => i.id === row.inventoryId);
          const total_price = row.quantity * row.unitPrice;
          subtotal += total_price;
          
          return {
            inventory_id: row.inventoryId,
            product_id: inv?.product_id || '',
            product_name: inv?.product?.name || 'Unknown',
            hsn_code: inv?.product?.hsn_code || null,
            quantity: row.quantity,
            unit_price: row.unitPrice,
            gst_rate: 0, // Assume 0 for historical bulk unless configured
            total_price
          };
        });

        const payload = {
          dealer_id: user.id,
          branch_id: branchId,
          farmer_id: farmerId,
          farmer_name_snapshot: selectedFarmer.name,
          farmer_gstin: (selectedFarmer as any).gstin || null,
          bill_date: date,
          subtotal: subtotal,
          gst_amount: 0,
          cgst_amount: 0,
          sgst_amount: 0,
          igst_amount: 0,
          discount_amount: 0,
          total: subtotal,
          amount_paid: 0,
          notes: 'Historical entry',
          is_historical: true,
          reduce_stock: reduceStock,
          items: items as any
        };

        await billingService.createBill(payload);
      }
      
      toast.success('Historical records added successfully!');
      navigate(`/farmers/${farmerId}`);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to save historical records');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6 py-4 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bulk Historical Entry</h1>
          {selectedFarmer && (
            <p className="text-sm text-slate-500">For {selectedFarmer.name}</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-800">Configuration</h2>
            <p className="text-sm text-slate-500 mt-1">Set how this data affects your system</p>
          </div>
          
          <button
            onClick={() => setReduceStock(!reduceStock)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors self-start sm:self-auto shadow-sm"
          >
            <div className={`flex items-center justify-center w-5 h-5 rounded ${reduceStock ? 'text-brand-600' : 'text-slate-400'}`}>
              {reduceStock ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
            </div>
            <div className="text-left">
              <span className="block text-sm font-semibold text-slate-700">Reduce Stock Inventory</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                {reduceStock ? 'Current inventory will be reduced' : 'Safe for old records'}
              </span>
            </div>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-3 w-40">Date</th>
                <th className="p-3 w-64">Product / Item</th>
                <th className="p-3 w-28 text-right">Quantity</th>
                <th className="p-3 w-32 text-right">Price (₹)</th>
                <th className="p-3 w-32 text-right">Total (₹)</th>
                <th className="p-3 w-16 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 focus-within:bg-blue-50/30 transition-colors">
                  <td className="p-2">
                    <DatePicker
                      value={row.date}
                      onChange={(val) => updateRow(row.id, 'date', val)}
                      placeholder="Date"
                    />
                  </td>
                  <td className="p-2">
                    <select
                      value={row.inventoryId}
                      onChange={(e) => updateRow(row.id, 'inventoryId', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow outline-none"
                    >
                      <option value="">Select product...</option>
                      {inventoryData?.map(inv => (
                        <option key={inv.id} value={inv.id}>
                          {inv.product?.name} {inv.batch_number ? `(${inv.batch_number})` : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={row.quantity || ''}
                      onChange={(e) => updateRow(row.id, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow outline-none"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.unitPrice || ''}
                      onChange={(e) => updateRow(row.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow outline-none"
                    />
                  </td>
                  <td className="p-3 text-right font-medium text-slate-700">
                    {((row.quantity || 0) * (row.unitPrice || 0)).toLocaleString('en-IN', {
                      maximumFractionDigits: 2
                    })}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length === 1}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-3 bg-slate-50 border-t border-slate-200">
          <button
            onClick={addRow}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Row
          </button>
        </div>
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-10px_20px_rgba(0,0,0,0.03)] z-10 flex justify-end gap-3 sm:pl-[280px]">
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !farmerId || rows.every(r => !r.inventoryId)}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Records
        </button>
      </div>
    </div>
  );
};

export default BulkHistoricalBillPage;
