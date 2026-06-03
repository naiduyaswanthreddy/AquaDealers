import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useFarmer } from '../hooks/useFarmerLedger';
import { useUpdateFarmer } from '../hooks/useFarmers';
import { uploadFarmerImage } from '../services/farmerService';
import FarmerForm from '../components/FarmerForm';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui';

export const EditFarmerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: farmer, isLoading } = useFarmer(id!);
  const { mutateAsync: updateFarmer, isPending } = useUpdateFarmer();

  const { user } = useAuthStore();

  const handleSubmit = async (data: any) => {
    try {
      const { imageFile, ...updateData } = data;
      let finalData = { ...updateData };

      if (imageFile) {
        try {
          const url = await uploadFarmerImage(imageFile, user!.id, id!);
          finalData.image_url = url;
        } catch (uploadError) {
          console.error('Failed to upload image:', uploadError);
          toast.error('Failed to upload profile image');
        }
      }

      await updateFarmer({ farmerId: id!, data: finalData });
      toast.success(t('farmers.farmerUpdatedSuccess', 'Farmer updated successfully'));
      navigate(`/farmers/${id}`);
    } catch (error) {
      // Error handled by hook
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="w-40 h-8" />
        <div className="bg-white rounded-2xl p-4 border border-border">
          <Skeleton className="w-full h-12 mb-4" />
          <Skeleton className="w-full h-12 mb-4" />
          <Skeleton className="w-full h-12" />
        </div>
      </div>
    );
  }

  if (!farmer) {
    return <div>{t('farmers.farmerNotFound', 'Farmer not found')}</div>;
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
          {t('farmers.editFarmer', 'Edit Farmer')}
        </h1>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
        <FarmerForm
          mode="edit"
          defaultValues={farmer}
          onSubmit={handleSubmit}
          loading={isPending}
        />
      </div>
    </div>
  );
};

export default EditFarmerPage;
