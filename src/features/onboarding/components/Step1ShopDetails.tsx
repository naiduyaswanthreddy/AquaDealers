import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/authStore';
import { updateDealerProfile, completeStep } from '../services/onboardingService';
import { toast } from 'sonner';
import { Store, MapPin, FileText, Sparkles } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui';

const shopDetailsSchema = z.object({
  shopName: z.string().min(3, 'Shop Name must be at least 3 characters'),
  name: z.string().min(2, 'Owner Name must be at least 2 characters'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  gstin: z
    .string()
    .refine((val) => val === '' || /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(val), {
      message: 'Please enter a valid GSTIN format (e.g., 37AAAAA1111A1Z1)',
    })
    .optional(),
  drugLicenseNo: z.string().optional(),
});

type ShopDetailsFormValues = z.infer<typeof shopDetailsSchema>;

interface Step1Props {
  onNext: () => void;
}

export const Step1ShopDetails: React.FC<Step1Props> = ({ onNext }) => {
  const { user, fetchDealerProfile } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ShopDetailsFormValues>({
    resolver: zodResolver(shopDetailsSchema),
    defaultValues: {
      shopName: user?.shop_name || '',
      name: user?.name || '',
      address: user?.address || '',
      gstin: user?.gstin || '',
      drugLicenseNo: user?.drug_license_no || '',
    },
  });

  const onSubmit = async (data: ShopDetailsFormValues) => {
    if (!user) return;

    try {
      // 1. Update Dealer Profile
      await updateDealerProfile(user.id, {
        shop_name: data.shopName,
        name: data.name,
        address: data.address || null,
        gstin: data.gstin || null,
        drug_license_no: data.drugLicenseNo || null,
      });

      // 2. Complete Step 1
      await completeStep(user.id, 'shop_details');
      await fetchDealerProfile();

      toast.success('Shop details saved!');
      onNext();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save shop details.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
          <Sparkles className="h-3.5 w-3.5" />
          First things first
        </div>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-[-0.02em] text-slate-900">
          <Store className="w-5 h-5 text-primary" />
          Shop Profile
        </h2>
        <p className="max-w-md text-sm leading-6 text-slate-500">
          Add the details that appear on invoices and help customers recognize your business instantly.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="mb-4 flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-white p-2 text-primary shadow-sm">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Business details</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                These basics shape your bills, profile, and dealer identity across the app.
              </p>
            </div>
          </div>

          <div className="space-y-4">
        <Input
          {...register('shopName')}
          label="Shop/Firm Name *"
          placeholder="e.g. Sri Balaji Aqua Feeds"
          error={errors.shopName?.message}
          inputSize="lg"
        />

        <Input
          {...register('name')}
          label="Owner/Dealer Name *"
          placeholder="Enter owner name"
          error={errors.name?.message}
          inputSize="lg"
        />

        <Textarea
          {...register('address')}
          label="Shop Address *"
          placeholder="Enter complete shop address"
          error={errors.address?.message}
          rows={4}
          className="min-h-[112px] rounded-2xl border-[1.5px] border-slate-200 px-4 py-3.5 text-[15px]"
        />
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-800">Optional compliance details</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Add these now if you issue GST bills or sell regulated medicine products.
            </p>
          </div>

          <div className="space-y-4">
            <Input
              {...register('gstin')}
              label="GSTIN"
              placeholder="e.g. 37AAAAA1111A1Z1"
              error={errors.gstin?.message}
              helperText="Required only if you issue GST bills"
              leftIcon={<FileText className="w-5 h-5 text-text-muted" />}
              inputSize="lg"
            />

            <Input
              {...register('drugLicenseNo')}
              label="Drug License Number"
              placeholder="e.g. DL-12345/AP"
              error={errors.drugLicenseNo?.message}
              helperText="Recommended for shrimp medicine dealers"
              leftIcon={<FileText className="w-5 h-5 text-text-muted" />}
              inputSize="lg"
            />
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={isSubmitting}
          className="mt-2 font-bold"
        >
          Save & Continue
        </Button>
      </form>
    </div>
  );
};

export default Step1ShopDetails;
