import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { addFarmer, completeStep } from '../services/onboardingService';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Users, User, Phone, MapPin, CheckCircle2 } from 'lucide-react';
import { Button, Input, Card, CardContent } from '@/components/ui';

const farmerSchema = z.object({
  name: z.string().min(2, 'Farmer name must be at least 2 characters'),
  phone: z
    .string()
    .refine((val) => val === '' || /^[6-9]\d{9}$/.test(val), {
      message: 'Please enter a valid 10-digit mobile number',
    })
    .optional(),
  village: z.string().optional(),
});

type FarmerFormValues = z.infer<typeof farmerSchema>;

interface Step4Props {
  onNext: () => void;
  onBack: () => void;
}

export const Step4AddFarmer: React.FC<Step4Props> = ({ onNext, onBack }) => {
  const { user, fetchDealerProfile } = useAuthStore();
  const { branches } = useBranchStore();
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FarmerFormValues>({
    resolver: zodResolver(farmerSchema),
    defaultValues: {
      name: '',
      phone: '',
      village: '',
    },
  });

  const onSubmit = async (data: FarmerFormValues) => {
    if (!user) return;

    setLoading(true);
    try {
      // 1. Get main branch
      let mainBranch = branches.find((b) => b.is_main);
      let branchId = mainBranch?.id;

      if (!branchId) {
        // Fallback: Query DB
        const { data: dbBranch, error: dbError } = await supabase
          .from('branches')
          .select('id')
          .eq('dealer_id', user.id)
          .eq('is_main', true)
          .maybeSingle();

        if (dbError) throw dbError;
        branchId = dbBranch?.id;
      }

      if (!branchId) {
        throw new Error('Main shop/branch not found. Please re-register.');
      }

      // 2. Insert Farmer
      await addFarmer(user.id, branchId, {
        name: data.name,
        phone: data.phone || undefined,
        village: data.village || undefined,
      });

      // 3. Mark step completed
      await completeStep(user.id, 'first_farmer');
      await fetchDealerProfile();

      // Show checkmark success and wait
      setSuccess(true);
      toast.success('First farmer added successfully!');
      setTimeout(() => {
        onNext();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to add first farmer.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await completeStep(user.id, 'first_farmer');
      await fetchDealerProfile();
      toast.info('Skipped adding farmer.');
      onNext();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to skip step.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-scale-in text-center">
        <div className="w-20 h-20 rounded-full bg-success/10 text-success flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <h3 className="text-xl font-bold text-text-primary">Farmer Added!</h3>
        <p className="text-sm text-text-secondary">
          Successfully added your first farmer ledger. Moving to next step...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Add First Farmer
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          Create your first farmer profile to see how outstanding credit tracking works.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          {...register('name')}
          label="Farmer Name *"
          placeholder="e.g. Ramesh Garu"
          error={errors.name?.message}
          leftIcon={<User className="w-5 h-5 text-text-muted" />}
        />

        <Input
          {...register('phone')}
          label="Mobile Number (Optional)"
          placeholder="e.g. 9876543210"
          type="tel"
          error={errors.phone?.message}
          leftIcon={<Phone className="w-5 h-5 text-text-muted" />}
        />

        <Input
          {...register('village')}
          label="Village (Optional)"
          placeholder="e.g. Bhimavaram"
          error={errors.village?.message}
          leftIcon={<MapPin className="w-5 h-5 text-text-muted" />}
        />

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={loading}
            className="font-bold"
          >
            Add Farmer Ledger
          </Button>
        </div>
      </form>

      <div className="text-center pt-2">
        <button
          type="button"
          onClick={handleSkip}
          disabled={loading}
          className="text-sm font-semibold text-text-muted hover:text-text-secondary transition-colors focus-ring py-1 px-3 rounded-lg"
        >
          Skip this step for now
        </button>
      </div>

      <div className="flex gap-3 pt-4 border-t border-border">
        <Button variant="secondary" onClick={onBack} disabled={loading} className="flex-1 font-semibold">
          Back
        </Button>
      </div>
    </div>
  );
};

export default Step4AddFarmer;
