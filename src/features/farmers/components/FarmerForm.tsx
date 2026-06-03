import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useBranchStore } from '@/stores/branchStore';
import { CROP_STATUSES, AP_DISTRICTS } from '@/lib/constants';
import { estimateHarvestDate, formatDate } from '@/lib/utils';
import { Button, Input, Select, Textarea } from '@/components/ui';
import RiskStatusPicker from './RiskStatusPicker';
import { parseISO } from 'date-fns';
import type { Farmer } from '@/types/database';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import imageCompression from 'browser-image-compression';
import { Camera, Image as ImageIcon } from 'lucide-react';
import { getInitials } from '@/lib/utils';

const farmerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().refine((v) => !v || /^[6-9]\d{9}$/.test(v), {
    message: 'Please enter a valid 10-digit mobile number',
  }).optional().or(z.literal('')),
  village: z.string().optional().or(z.literal('')),
  mandal: z.string().optional().or(z.literal('')),
  district: z.string().optional().or(z.literal('')),
  pond_acres: z.string().optional().or(z.literal('')),
  stocking_date: z.string().optional().or(z.literal('')),
  crop_status: z.string().default('growing'),
  risk_status: z.string().default('reliable'),
  credit_limit: z.string().optional().or(z.literal('')),
  branch_id: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

type FarmerFormValues = z.infer<typeof farmerSchema>;

interface FarmerFormProps {
  mode: 'create' | 'edit';
  defaultValues?: Partial<Farmer>;
  onSubmit: (data: any) => Promise<void>;
  loading: boolean;
}

export const FarmerForm: React.FC<FarmerFormProps> = ({
  mode,
  defaultValues,
  onSubmit,
  loading,
}) => {
  const { branches } = useBranchStore();
  const hasFarmerPhotoFeature = useSubscriptionStore((state) => state.hasFeature('farmer_photo'));
  
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(defaultValues?.image_url || null);
  const [isCompressing, setIsCompressing] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const options = {
        maxSizeMB: 0.03, // ~30KB target
        maxWidthOrHeight: 160,
        useWebWorker: true,
        fileType: "image/webp",
        initialQuality: 0.7,
      };
      
      const compressedFile = await imageCompression(file, options);
      setImageFile(compressedFile);
      setImagePreview(URL.createObjectURL(compressedFile));
    } catch (error) {
      console.error('Error compressing image:', error);
    } finally {
      setIsCompressing(false);
    }
  };

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FarmerFormValues>({
    resolver: zodResolver(farmerSchema),
    defaultValues: {
      name: defaultValues?.name || '',
      phone: defaultValues?.phone || '',
      village: defaultValues?.village || '',
      mandal: defaultValues?.mandal || '',
      district: defaultValues?.district || '',
      pond_acres: defaultValues?.pond_acres?.toString() || '',
      stocking_date: defaultValues?.stocking_date || '',
      crop_status: defaultValues?.crop_status || 'growing',
      risk_status: defaultValues?.risk_status || 'reliable',
      credit_limit: defaultValues?.credit_limit?.toString() || '',
      branch_id: defaultValues?.branch_id || branches.find((b) => b.is_main)?.id || '',
      notes: defaultValues?.notes || '',
    },
  });

  const stockingDateValue = watch('stocking_date');
  const estimatedHarvest = stockingDateValue
    ? formatDate(estimateHarvestDate(parseISO(stockingDateValue)))
    : null;

  const handleFormSubmit = async (data: FarmerFormValues) => {
    await onSubmit({
      name: data.name,
      phone: data.phone || null,
      village: data.village || null,
      mandal: data.mandal || null,
      district: data.district || null,
      pond_acres: data.pond_acres ? Number(data.pond_acres) : null,
      stocking_date: data.stocking_date || null,
      crop_status: data.crop_status,
      risk_status: data.risk_status,
      credit_limit: data.credit_limit ? Number(data.credit_limit) : 0,
      branch_id: data.branch_id || null,
      notes: data.notes || null,
      imageFile, // Pass the File object to parent to handle upload
    });
  };

  const districtOptions = AP_DISTRICTS.map((d) => ({ value: d, label: d }));
  const cropOptions = CROP_STATUSES.map((c) => ({ value: c.value, label: c.label }));
  const branchOptions = branches.map((b) => ({ value: b.id, label: b.name }));

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {hasFarmerPhotoFeature && (
        <div className="flex justify-center mb-6">
          <div className="relative group">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 rounded-full overflow-hidden border-2 border-slate-200 bg-slate-50 flex items-center justify-center cursor-pointer relative"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Profile" className="w-full h-full object-cover" />
              ) : watch('name') ? (
                <span className="text-2xl font-bold text-slate-400">{getInitials(watch('name'))}</span>
              ) : (
                <ImageIcon className="w-8 h-8 text-slate-300" />
              )}
              
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
              
              {isCompressing && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageChange}
            />
          </div>
        </div>
      )}

      <Input
        {...register('name')}
        label="Farmer Name *"
        placeholder="e.g. Ramesh Garu"
        error={errors.name?.message}
      />

      <Input
        {...register('phone')}
        label="Mobile Number"
        placeholder="10-digit number"
        type="tel"
        error={errors.phone?.message}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input {...register('village')} label="Village" placeholder="e.g. Bhimavaram" />
        <Input {...register('mandal')} label="Mandal" placeholder="e.g. Narasapuram" />
      </div>

      <Select
        {...register('district')}
        label="District"
        options={districtOptions}
        placeholder="Select district"
      />

      <Input
        {...register('pond_acres')}
        label="Pond Area (Acres)"
        placeholder="e.g. 2.5"
        type="number"
        inputSize="md"
      />

      <div>
        <Input
          {...register('stocking_date')}
          label="Stocking Date"
          type="date"
        />
        {estimatedHarvest && (
          <p className="mt-1 text-xs text-success font-semibold">
            🐟 Estimated harvest: {estimatedHarvest}
          </p>
        )}
      </div>

      <Select
        {...register('crop_status')}
        label="Crop Status"
        options={cropOptions}
      />

      <Controller
        control={control}
        name="risk_status"
        render={({ field }) => (
          <RiskStatusPicker
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      <Input
        {...register('credit_limit')}
        label="Credit Limit (₹)"
        placeholder="e.g. 50000"
        type="number"
      />

      {branchOptions.length > 1 && (
        <Select
          {...register('branch_id')}
          label="Assign to Shop/Branch"
          options={branchOptions}
        />
      )}

      <Textarea
        {...register('notes')}
        label="Notes"
        placeholder="Any important notes about this farmer..."
        rows={3}
      />

      <Button type="submit" variant="primary" fullWidth loading={loading} className="mt-6 font-bold">
        {mode === 'create' ? 'Add Farmer' : 'Save Changes'}
      </Button>
    </form>
  );
};

export default FarmerForm;
