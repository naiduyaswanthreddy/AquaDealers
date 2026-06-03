import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useStaffStore } from '@/stores/staffStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits';
import { getStaffFeatureMode } from '@/lib/staffAccess';
import { useCreateFarmer } from '../hooks/useFarmers';
import { uploadFarmerImage, updateFarmer } from '../services/farmerService';
import FarmerForm from '../components/FarmerForm';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export const AddFarmerPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const currentStaff = useStaffStore((s) => s.currentStaff);
  const isExpired = useSubscriptionStore((s) => s.isExpired());
  const { data: limits, isLoading: limitsLoading } = useSubscriptionLimits();
  const { mutateAsync: createFarmer, isPending } = useCreateFarmer();
  const [formKey, setFormKey] = React.useState(0);

  const handleSubmit = async (data: any) => {
    try {
      const farmer = await createFarmer({
        name: data.name,
        phone: data.phone,
        village: data.village,
        mandal: data.mandal,
        district: data.district,
        pond_acres: data.pond_acres,
        stocking_date: data.stocking_date,
        crop_status: data.crop_status,
        risk_status: data.risk_status,
        credit_limit: data.credit_limit,
        branch_id: data.branch_id,
        notes: data.notes,
        dealer_id: user!.id,
      });

      if (data.imageFile) {
        try {
          const url = await uploadFarmerImage(data.imageFile, user!.id, farmer.id);
          await updateFarmer(farmer.id, { image_url: url });
        } catch (uploadError) {
          console.error('Failed to upload image:', uploadError);
          toast.error('Farmer created, but image upload failed');
        }
      }
      toast.success(t('farmers.farmerAddedSuccess', 'Farmer added successfully'));
      const canViewFarmers = getStaffFeatureMode('farmerList', currentStaff?.permissions, !!currentStaff) === 'visible';
      if (canViewFarmers) {
        navigate(`/farmers/${farmer.id}`);
      } else {
        setFormKey((value) => value + 1);
      }
    } catch (error) {
      // Error handled by hook
    }
  };

  if (isExpired) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <span className="text-2xl">⚠️</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{t('subscription.expiredTitle', 'Subscription Expired')}</h1>
        <p className="text-slate-600 max-w-md mb-8">
          {t('subscription.expiredDescription', 'Your account is currently in read-only mode. You cannot add new farmers until you renew your subscription.')}
        </p>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
          {t('common.goBack', 'Go Back')}
        </button>
      </div>
    );
  }

  if (!limitsLoading && limits && !limits.canAddFarmer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
          <span className="text-2xl text-blue-600">🚀</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Farmer Limit Reached</h1>
        <p className="text-slate-600 max-w-md mb-8">
          You have reached the maximum number of farmers ({limits.maxFarmers}) allowed on your current plan. Please contact Sales or your Admin to upgrade your plan.
        </p>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-border text-text-secondary hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-extrabold text-text-primary tracking-tight">
          {t('farmers.addFarmer', 'Add Farmer')}
        </h1>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
        <FarmerForm key={formKey} mode="create" onSubmit={handleSubmit} loading={isPending} />
      </div>
    </div>
  );
};

export default AddFarmerPage;
