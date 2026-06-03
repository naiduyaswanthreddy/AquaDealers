import React from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SupplierItem } from '../types';
import { useRecordPayment } from '../hooks/useSuppliers';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface SupplierPaymentModalProps {
  supplier: SupplierItem;
  onClose: () => void;
}

export const SupplierPaymentModal: React.FC<SupplierPaymentModalProps> = ({ supplier, onClose }) => {
  const { t } = useTranslation();
  const { mutateAsync: recordPayment, isPending } = useRecordPayment();
  const [amount, setAmount] = React.useState<string>('');
  const [method, setMethod] = React.useState<string>('cash');
  const [notes, setNotes] = React.useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;

    try {
      await recordPayment({
        supplierId: supplier.id,
        amount: Number(amount),
        method,
        notes,
      });
      toast.success(t('suppliers.paymentSuccess'));
      onClose();
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">{t('suppliers.recordPayment')}</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 bg-gray-50 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-blue-50/50 border-b flex justify-between items-center">
          <div>
            <p className="text-sm font-medium text-gray-700">{supplier.name}</p>
            <p className="text-xs text-gray-500">{supplier.company}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">{t('suppliers.totalDue')}</p>
            <p className="font-bold text-red-600">{formatCurrency(supplier.total_due)}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <Input
            label={t('suppliers.paymentAmount')}
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="₹0"
            required
            min="1"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('suppliers.paymentMethod')}</label>
            <div className="flex gap-2">
              {['cash', 'upi', 'bank', 'cheque'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setMethod(type)}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border uppercase tracking-wider transition-colors ${
                    method === type 
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <Input
            label={t('common.notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('suppliers.paymentNotesPlaceholder')}
          />

          <div className="pt-4 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" className="flex-1" loading={isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
