import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits';
import { useCreateFarmer } from '@/features/farmers/hooks/useFarmers';
import { Modal, Input, Button } from '@/components/ui';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import type { Farmer } from '@/types/database';

const quickFarmerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().refine((v) => !v || /^[6-9]\d{9}$/.test(v), {
    message: 'Please enter a valid 10-digit mobile number',
  }).optional().or(z.literal('')),
  village: z.string().optional().or(z.literal('')),
  credit_limit: z.string().optional().or(z.literal('')),
});

type QuickFarmerFormValues = z.infer<typeof quickFarmerSchema>;

interface QuickAddFarmerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (farmer: Farmer) => void;
  initialName?: string;
}

export const QuickAddFarmerModal: React.FC<QuickAddFarmerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialName = '',
}) => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useBranchStore((s) => s.getActiveBranchId());
  const isExpired = useSubscriptionStore((s) => s.isExpired());
  const { data: limits, isLoading: limitsLoading } = useSubscriptionLimits();
  const { mutateAsync: createFarmer, isPending } = useCreateFarmer();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<QuickFarmerFormValues>({
    resolver: zodResolver(quickFarmerSchema),
    defaultValues: {
      name: initialName,
      phone: '',
      village: '',
      credit_limit: '',
    },
  });

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      reset({
        name: initialName,
        phone: '',
        village: '',
        credit_limit: '',
      });
    }
  }, [isOpen, initialName, reset]);

  const handleFormSubmit = async (data: QuickFarmerFormValues) => {
    if (isExpired) {
      toast.error('Subscription expired. Cannot add farmer.');
      return;
    }
    if (limits && !limits.canAddFarmer) {
      toast.error('Farmer limit reached on your current plan.');
      return;
    }

    try {
      const farmer = await createFarmer({
        name: data.name,
        phone: data.phone || null,
        village: data.village || null,
        mandal: null,
        district: null,
        pond_acres: null,
        stocking_date: null,
        crop_status: 'growing',
        risk_status: 'reliable',
        credit_limit: data.credit_limit ? Number(data.credit_limit) : 0,
        branch_id: activeBranchId || null,
        notes: null,
        dealer_id: user!.id,
      });

      toast.success(t('farmers.farmerAddedSuccess', 'Farmer added successfully'));
      onSuccess(farmer);
      onClose();
    } catch (error) {
      // Error handled by mutation hook error handler
    }
  };

  const isLimitReached = !limitsLoading && limits && !limits.canAddFarmer;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('farmers.addFarmer', 'Add Farmer')}>
      {isExpired ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm font-semibold text-red-800">
            ⚠️ {t('subscription.expiredTitle', 'Subscription Expired')}
          </p>
          <p className="mt-1 text-xs text-red-600">
            {t('subscription.expiredDescription', 'Your account is currently in read-only mode. Renew to add farmers.')}
          </p>
          <Button type="button" variant="outline" className="mt-3 w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : isLimitReached ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-sm font-semibold text-amber-800">
            🚀 Farmer Limit Reached
          </p>
          <p className="mt-1 text-xs text-amber-600">
            You have reached the maximum number of farmers ({limits?.maxFarmers}) allowed on your plan.
          </p>
          <Button type="button" variant="outline" className="mt-3 w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <Input
            {...register('name')}
            label="Farmer Name *"
            placeholder="e.g. Ramesh Garu"
            error={errors.name?.message}
            autoFocus
          />

          <Input
            {...register('phone')}
            label="Mobile Number"
            placeholder="10-digit number"
            type="tel"
            error={errors.phone?.message}
          />

          <Input 
            {...register('village')} 
            label="Village" 
            placeholder="e.g. Bhimavaram" 
            error={errors.village?.message}
          />

          <Input
            {...register('credit_limit')}
            label="Credit Limit (₹)"
            placeholder="e.g. 50000"
            type="number"
            error={errors.credit_limit?.message}
          />

          <div className="pt-3 flex gap-3">
            <Button type="button" variant="outline" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" fullWidth loading={isPending} className="font-bold">
              <UserPlus className="mr-1.5 h-4 w-4" />
              Add Farmer
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default QuickAddFarmerModal;
