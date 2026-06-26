import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { useCreateFarmer } from '@/features/farmers/hooks/useFarmers';
import { Modal, Input, Button } from '@/components/ui';
import { toast } from 'sonner';
import { User } from 'lucide-react';
import type { Farmer } from '@/types/database';

const walkInSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().refine((v) => !v || /^[6-9]\d{9}$/.test(v), {
    message: 'Please enter a valid 10-digit mobile number',
  }).optional().or(z.literal('')),
  village: z.string().optional().or(z.literal('')),
});

type WalkInFormValues = z.infer<typeof walkInSchema>;

interface QuickAddWalkInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (farmer: Farmer) => void;
}

export const QuickAddWalkInModal: React.FC<QuickAddWalkInModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useBranchStore((s) => s.getActiveBranchId());
  const { mutateAsync: createFarmer, isPending } = useCreateFarmer();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<WalkInFormValues>({
    resolver: zodResolver(walkInSchema),
    defaultValues: {
      name: '',
      phone: '',
      village: '',
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      reset({
        name: '',
        phone: '',
        village: '',
      });
    }
  }, [isOpen, reset]);

  const handleFormSubmit = async (data: WalkInFormValues) => {
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
        credit_limit: 0,
        branch_id: activeBranchId || null,
        notes: null,
        dealer_id: user!.id,
        is_walk_in: true, // Mark as walk-in customer
      });

      toast.success('Walk-in customer details saved');
      onSuccess(farmer);
      onClose();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Walk-in Customer Details">
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <Input
          {...register('name')}
          label="Customer Name *"
          placeholder="e.g. Ramesh"
          error={errors.name?.message}
          autoFocus
        />

        <Input
          {...register('phone')}
          label="Mobile Number (Optional)"
          placeholder="10-digit number"
          type="tel"
          error={errors.phone?.message}
        />

        <Input 
          {...register('village')} 
          label="Village (Optional)" 
          placeholder="e.g. Bhimavaram" 
          error={errors.village?.message}
        />

        <div className="pt-3 flex gap-3">
          <Button type="button" variant="outline" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" fullWidth loading={isPending} className="font-bold">
            <User className="mr-1.5 h-4 w-4" />
            Continue
          </Button>
        </div>
      </form>
    </Modal>
  );
};
