import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Edit2, Save, X } from 'lucide-react';
import type { FeatureKey } from '@/stores/subscriptionStore';

const ALL_FEATURES: { key: FeatureKey; label: string }[] = [
  { key: 'core', label: 'Core Features' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'cashbook', label: 'Cashbook' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'export', label: 'Export Data' },
  { key: 'whatsapp', label: 'WhatsApp Receipts' },
  { key: 'gst', label: 'GST Billing' },
  { key: 'reports', label: 'Advanced Reports' },
  { key: 'voice', label: 'Voice Search' },
  { key: 'multilang', label: 'Multilingual' },
  { key: 'pdf', label: 'PDF Generation' },
  { key: 'priority_support', label: 'Priority Support' },
  { key: 'app_pin', label: 'App PIN' },
  { key: 'staff', label: 'Staff Logins' },
  { key: 'signature_proof', label: 'Signature Proof' },
  { key: 'farmer_photo', label: 'Farmer Photos' },
];

interface AdminSubscriptionTabProps {
  dealerId: string;
}

export const AdminSubscriptionTab: React.FC<AdminSubscriptionTabProps> = ({ dealerId }) => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState<FeatureKey[]>([]);

  // Fetch Dealer's current custom features
  const { data: dealer, isLoading } = useQuery({
    queryKey: ['admin_dealer_features', dealerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dealers')
        .select('custom_features')
        .eq('id', dealerId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { mutateAsync: updateFeatures, isPending } = useMutation({
    mutationFn: async (features: FeatureKey[]) => {
      const { error } = await supabase
        .from('dealers')
        .update({ custom_features: features })
        .eq('id', dealerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_dealer_features', dealerId] });
      queryClient.invalidateQueries({ queryKey: ['admin_dealer', dealerId] });
      setIsEditing(false);
    },
  });

  if (isLoading) return <div className="p-8 text-center text-slate-500">Loading features...</div>;

  const currentFeatures: FeatureKey[] = dealer?.custom_features || [];

  const handleEdit = () => {
    setSelectedFeatures(currentFeatures);
    setIsEditing(true);
  };

  const handleToggle = (feature: FeatureKey) => {
    setSelectedFeatures(prev => 
      prev.includes(feature) ? prev.filter(f => f !== feature) : [...prev, feature]
    );
  };

  const handleSave = async () => {
    try {
      await updateFeatures(selectedFeatures);
    } catch (e) {
      console.error(e);
      alert('Failed to update features');
    }
  };

  return (
    <div className="admin-card">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-sm font-bold">Custom Entitlements</h3>
          <p className="text-xs text-slate-500 mt-1">Assign custom features to this dealer regardless of their base plan.</p>
        </div>
        {!isEditing ? (
          <button onClick={handleEdit} className="admin-btn admin-btn-outline flex items-center gap-2">
            <Edit2 size={14} /> Edit Features
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setIsEditing(false)} className="admin-btn admin-btn-ghost flex items-center gap-2">
              <X size={14} /> Cancel
            </button>
            <button onClick={handleSave} disabled={isPending} className="admin-btn admin-btn-primary flex items-center gap-2">
              <Save size={14} /> {isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {ALL_FEATURES.map((feature) => {
          const isSelected = isEditing ? selectedFeatures.includes(feature.key) : currentFeatures.includes(feature.key);
          
          return (
            <div 
              key={feature.key}
              onClick={() => isEditing && handleToggle(feature.key)}
              className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${
                isEditing ? 'cursor-pointer hover:border-blue-500' : 'cursor-default'
              } ${isSelected ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200'}`}
            >
              <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-transparent'
              }`}>
                <Check size={12} strokeWidth={3} />
              </div>
              <span className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-slate-600'}`}>
                {feature.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminSubscriptionTab;
