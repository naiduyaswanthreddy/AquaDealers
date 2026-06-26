import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAddCashEntry } from '../hooks/useFinancials';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { CashBookInsert } from '../types';
import { Modal } from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { toast } from 'sonner';

interface CashEntryModalProps {
  type: 'income' | 'expense';
  onClose: () => void;
}

export const CashEntryModal: React.FC<CashEntryModalProps> = ({ type, onClose }) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { activeBranch } = useBranchStore();
  const { mutateAsync: addEntry, isPending } = useAddCashEntry();

  const { register, control, handleSubmit, formState: { errors } } = useForm<CashBookInsert>({
    defaultValues: {
      dealer_id: user?.id || '',
      branch_id: activeBranch?.id || null,
      entry_type: type,
      source: 'manual',
      amount: 0,
      notes: '',
      entry_date: new Date().toISOString().slice(0, 10),
    }
  });

  const onSubmit = async (data: CashBookInsert) => {
    try {
      await addEntry(data);
      toast.success('Entry added to Cash Book');
      onClose();
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    }
  };

  const isIncome = type === 'income';

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isIncome ? 'Add Money In' : 'Add Money Out'}
      footerButtons={[
        { label: t('common.cancel'), onClick: onClose, variant: 'outline' },
        { 
          label: t('common.save'), 
          type: 'submit', 
          form: 'cash-form', 
          variant: isIncome ? 'success' : 'danger',
          loading: isPending 
        }
      ]}
    >
      <form id="cash-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            name="entry_date"
            rules={{ required: t('common.required') }}
            render={({ field }) => (
              <DatePicker
                value={field.value}
                onChange={field.onChange}
                placeholder={t('financials.date', 'Date')}
              />
            )}
          />
          {errors.entry_date && <p className="text-xs text-red-500 mt-1">{errors.entry_date.message}</p>}
        </div>

        <Input
          label={t('financials.description', 'Description')}
          {...register('notes', { required: t('common.required') })}
          error={errors.notes?.message}
          placeholder={isIncome ? 'e.g. Received from old dues' : 'e.g. Paid for local transport'}
        />
      </form>
    </Modal>
  );
};
