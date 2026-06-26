import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRecordExpense } from '../hooks/useFinancials';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { ExpenseInsert } from '../types';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import { Modal } from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { toast } from 'sonner';

interface ExpenseModalProps {
  onClose: () => void;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { activeBranch } = useBranchStore();
  const { mutateAsync: recordExpense, isPending } = useRecordExpense();

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<ExpenseInsert>({
    defaultValues: {
      dealer_id: user?.id || '',
      branch_id: activeBranch?.id || null,
      category: '',
      amount: 0,
      description: '',
      expense_date: new Date().toISOString().slice(0, 10),
      paid_via: 'cash',
    }
  });

  const onSubmit = async (data: ExpenseInsert) => {
    try {
      await recordExpense(data);
      toast.success(t('financials.expenseRecorded', 'Expense recorded successfully'));
      onClose();
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    }
  };

  const watchPaidVia = watch('paid_via');

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={t('financials.recordExpense', 'Record Expense')}
      footerButtons={[
        { label: t('common.cancel'), onClick: onClose, variant: 'outline' },
        { label: t('common.save'), onClick: () => {}, type: 'submit', form: 'expense-form', loading: isPending }
      ]}
    >
      <form id="expense-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('financials.category', 'Category')}</label>
          <select
            {...register('category', { required: t('common.required') })}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
          >
            <option value="">{t('financials.selectCategory', 'Select category')}</option>
            {EXPENSE_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category.message}</p>}
        </div>

        <Input
          label={t('financials.amount', 'Amount')}
          type="number"
          min="1"
          step="any"
          {...register('amount', { required: t('common.required'), min: 1 })}
          error={errors.amount?.message}
        />

        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-700">{t('financials.date', 'Date')}</label>
          <Controller
            control={control}
            name="expense_date"
            rules={{ required: t('common.required') }}
            render={({ field }) => (
              <DatePicker
                value={field.value}
                onChange={field.onChange}
                placeholder={t('financials.date', 'Date')}
              />
            )}
          />
          {errors.expense_date && <p className="text-xs text-red-500 mt-1">{errors.expense_date.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('financials.paidVia', 'Paid Via')}</label>
          <div className="flex gap-2">
            {['cash', 'upi', 'bank'].map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setValue('paid_via', method)}
                className={`flex-1 py-2 text-xs font-bold rounded-xl border uppercase tracking-wider transition-colors ${
                  watchPaidVia === method 
                    ? 'bg-primary border-primary text-white'
                    : 'bg-white border-border text-text-secondary hover:bg-surface'
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        <Input
          label={t('financials.description', 'Description')}
          {...register('description', { required: t('common.required') })}
          error={errors.description?.message}
          placeholder="e.g. Labour charges for unloading"
        />
      </form>
    </Modal>
  );
};
