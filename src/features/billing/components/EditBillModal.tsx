import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Bill, BillItem } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { Calculator, AlertTriangle, Percent } from 'lucide-react';

interface EditBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill;
  items: BillItem[];
  onConfirm: (edits: any[]) => void;
  inventoryMap?: Record<string, number>; // maps inventory_id to quantity_in_stock
}

export const EditBillModal: React.FC<EditBillModalProps> = ({
  isOpen,
  onClose,
  bill,
  items,
  onConfirm,
}) => {
  // Store values as strings to prevent issues with decimal parsing and empty "0" inputs
  const [edits, setEdits] = useState<Record<string, { quantity: string; unit_price: string; discount: string }>>({});
  const [inventoryMap, setInventoryMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen) {
      const initialEdits: Record<string, { quantity: string; unit_price: string; discount: string }> = {};
      const invIds: string[] = [];
      items.forEach(item => {
        const mrp = Number(item.mrp) || 0;
        const up = Number(item.unit_price) || 0;
        let discStr = '';
        if (mrp > 0 && up > 0) {
          discStr = (((mrp - up) / mrp) * 100).toFixed(2).replace(/\.00$/, '');
        }

        initialEdits[item.id] = {
          quantity: item.quantity.toString(),
          unit_price: item.unit_price.toString(),
          discount: discStr,
        };
        if (item.inventory_id_snapshot) invIds.push(item.inventory_id_snapshot);
      });
      setEdits(initialEdits);

      if (invIds.length > 0) {
        import('@/lib/supabase').then(({ supabase }) => {
          supabase.from('inventory')
            .select('id, quantity_in_stock')
            .in('id', invIds)
            .then(({ data }) => {
              if (data) {
                const map: Record<string, number> = {};
                data.forEach(d => map[d.id] = Number(d.quantity_in_stock));
                setInventoryMap(map);
              }
            });
        });
      }
    }
  }, [isOpen, items]);

  const handleQuantityChange = (itemId: string, val: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    let newQtyStr = val;
    if (val !== '') {
      const newQty = parseInt(val, 10);
      if (!isNaN(newQty)) {
        const invId = item.inventory_id_snapshot;
        const availableStock = invId ? (inventoryMap[invId] || 0) : 0;
        const maxQty = Number(item.quantity) + availableStock;
        newQtyStr = Math.min(Math.max(1, newQty), maxQty).toString();
      }
    }
    
    setEdits(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantity: newQtyStr }
    }));
  };

  const handlePriceChange = (itemId: string, val: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    let newDiscount = '';
    const mrp = Number(item.mrp) || 0;
    if (mrp > 0 && val !== '') {
       const p = parseFloat(val);
       if (!isNaN(p)) {
         newDiscount = (((mrp - p) / mrp) * 100).toFixed(2).replace(/\.00$/, '');
       }
    }
    setEdits(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], unit_price: val, discount: newDiscount }
    }));
  };

  const handleDiscountChange = (itemId: string, val: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    let newPrice = '';
    const mrp = Number(item.mrp) || 0;
    if (mrp > 0 && val !== '') {
       const d = parseFloat(val);
       if (!isNaN(d)) {
         newPrice = (mrp * (1 - d / 100)).toFixed(2).replace(/\.00$/, '');
       }
    }
    setEdits(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], discount: val, unit_price: newPrice }
    }));
  };

  const calculateNewTotal = () => {
    let newSubtotal = 0;
    let newGst = 0;
    
    items.forEach(item => {
      const edit = edits[item.id] || { quantity: item.quantity.toString(), unit_price: item.unit_price.toString() };
      const q = parseFloat(edit.quantity) || 0;
      const p = parseFloat(edit.unit_price) || 0;
      const lineSubtotal = q * p;
      const lineGst = lineSubtotal * (Number(item.gst_rate) / 100);
      newSubtotal += lineSubtotal;
      newGst += lineGst;
    });
    
    return Math.max(0, newSubtotal + newGst - Number(bill.discount_amount));
  };

  const handleSubmit = () => {
    const changedEdits = items.map(item => {
      const edit = edits[item.id];
      if (!edit) return null;
      
      const parsedQty = parseFloat(edit.quantity) || 0;
      const parsedPrice = parseFloat(edit.unit_price) || 0;

      if (parsedQty !== Number(item.quantity) || parsedPrice !== Number(item.unit_price)) {
        return {
          bill_item_id: item.id,
          product_name: item.product_name_snapshot,
          old_quantity: Number(item.quantity),
          quantity: parsedQty,
          old_unit_price: Number(item.unit_price),
          unit_price: parsedPrice
        };
      }
      return null;
    }).filter(Boolean);

    if (changedEdits.length === 0) {
      onClose();
      return;
    }

    onConfirm(changedEdits);
  };

  const hasChanges = items.some(item => {
    const edit = edits[item.id];
    if (!edit) return false;
    const parsedQty = parseFloat(edit.quantity) || 0;
    const parsedPrice = parseFloat(edit.unit_price) || 0;
    return parsedQty !== Number(item.quantity) || parsedPrice !== Number(item.unit_price);
  });

  const currentTotal = Number(bill.total);
  const newTotal = calculateNewTotal();
  const diff = newTotal - currentTotal;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Bill Items">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-bold mb-1">Editing Completed Bill</p>
          <p>Changing quantities will automatically adjust inventory stock. Changing prices will adjust the farmer's pending dues. All changes will be logged.</p>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl mb-6">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 font-medium">
            <tr>
              <th className="px-4 py-3 min-w-[150px]">Product</th>
              <th className="px-4 py-3 min-w-[100px]">MRP</th>
              <th className="px-4 py-3 w-28 min-w-[110px]">Quantity</th>
              <th className="px-4 py-3 w-32 min-w-[110px]">Discount %</th>
              <th className="px-4 py-3 w-40 min-w-[160px]">Unit Price</th>
              <th className="px-4 py-3 text-right min-w-[130px]">New Line Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(item => {
              const edit = edits[item.id];
              if (!edit) return null;
              
              const parsedQty = parseFloat(edit.quantity) || 0;
              const parsedPrice = parseFloat(edit.unit_price) || 0;

              const isQtyChanged = parsedQty !== Number(item.quantity);
              const isPriceChanged = parsedPrice !== Number(item.unit_price);
              
              const lineSubtotal = parsedQty * parsedPrice;
              const lineGst = lineSubtotal * (Number(item.gst_rate) / 100);
              const lineTotal = lineSubtotal + lineGst;

              return (
                <tr key={item.id} className={(isQtyChanged || isPriceChanged) ? 'bg-blue-50/50' : ''}>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-800 truncate max-w-[150px] sm:max-w-[200px]" title={item.product_name_snapshot || ''}>
                      {item.product_name_snapshot}
                    </div>
                    <div className="text-xs text-slate-500">GST: {item.gst_rate}%</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-600">
                    {formatCurrency(Number(item.mrp || 0))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="any"
                          value={edit.quantity}
                          onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-center font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      {isQtyChanged && (
                        <div className="text-[10px] font-bold text-blue-600">
                          Orig: {item.quantity}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          value={edit.discount}
                          disabled={!item.mrp}
                          onChange={(e) => handleDiscountChange(item.id, e.target.value)}
                          className="w-full pl-2 pr-7 py-1.5 border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                        <Percent className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                        <input
                          type="number"
                          step="any"
                          value={edit.unit_price}
                          onChange={(e) => handlePriceChange(item.id, e.target.value)}
                          className="w-full pl-6 pr-2 py-1.5 border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      {isPriceChanged && (
                        <div className="text-[10px] font-bold text-blue-600">
                          Orig: {formatCurrency(Number(item.unit_price))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-extrabold text-slate-800">{formatCurrency(lineTotal)}</div>
                    {(isQtyChanged || isPriceChanged) && (
                      <div className="text-[10px] font-bold text-slate-400 line-through">
                        {formatCurrency(Number(item.total_price))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="w-full sm:w-auto overflow-hidden">
          <div className="text-sm font-semibold text-slate-500 mb-1">Financial Impact</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div>
              <span className="text-[11px] text-slate-400 block">Original Total</span>
              <span className="font-bold text-slate-700">{formatCurrency(currentTotal)}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">New Total</span>
              <span className="font-extrabold text-slate-900">{formatCurrency(newTotal)}</span>
            </div>
            {diff !== 0 && (
              <div>
                <span className="text-[11px] text-slate-400 block">Difference</span>
                <span className={`font-bold ${diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex w-full sm:w-auto gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hasChanges}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
          >
            <Calculator className="w-4 h-4 shrink-0" />
            <span className="truncate">Review Changes</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
