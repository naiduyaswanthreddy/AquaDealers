import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from './authStore';

export type FeatureKey = 
  | 'core' 
  | 'expenses' 
  | 'cashbook' 
  | 'suppliers' 
  | 'export' 
  | 'whatsapp' 
  | 'gst' 
  | 'reports' 
  | 'voice' 
  | 'multilang' 
  | 'pdf' 
  | 'priority_support' 
  | 'app_pin'
  | 'staff'
  | 'signature_proof'
  | 'farmer_photo'
  | 'product_image'
  | 'custom_templates'
  | 'farmer_product_discounts'
  | 'edit_bills';

interface PlanDefinition {
  name: string;
  features: FeatureKey[];
  branch_limit: number | null;
  farmer_limit: number | null;
  bill_limit: number | null;
}

interface SubscriptionState {
  planDefinitions: Record<string, PlanDefinition>;
  isLoading: boolean;
  fetchPlanDefinitions: () => Promise<void>;
  hasFeature: (feature: FeatureKey) => boolean;
  getBranchLimit: () => number | null;
  isExpired: () => boolean;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  planDefinitions: {},
  isLoading: true,

  fetchPlanDefinitions: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('plan_definitions')
        .select('name, features, branch_limit, farmer_limit, bill_limit');
      
      if (error) throw error;
      
      const definitions: Record<string, PlanDefinition> = {};
      data.forEach(plan => {
        definitions[plan.name] = {
          name: plan.name,
          features: (plan.features as unknown as FeatureKey[]) || [],
          branch_limit: plan.branch_limit,
          farmer_limit: (plan as any).farmer_limit ?? null,
          bill_limit: (plan as any).bill_limit ?? null
        };
      });
      
      set({ planDefinitions: definitions });
    } catch (error) {
      console.error('Failed to fetch plan definitions:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  hasFeature: (feature: FeatureKey) => {
    const { user } = useAuthStore.getState();
    if (!user) return false;

    if (user.plan === 'pro_plus' && (feature === 'product_image' || feature === 'signature_proof' || feature === 'farmer_product_discounts')) {
      return true;
    }
    
    if (user.plan === 'pro' && feature === 'signature_proof') {
      return true;
    }

    // 1. Check custom_features
    if (user.custom_features && user.custom_features.includes(feature)) {
      return true;
    }

    // 2. Check base plan features
    const planDef = get().planDefinitions[user.plan];
    if (planDef && planDef.features.includes(feature)) {
      return true;
    }

    return false;
  },

  getBranchLimit: () => {
    const { user } = useAuthStore.getState();
    if (!user) return 1;

    const planDef = get().planDefinitions[user.plan];
    return planDef ? planDef.branch_limit : 1;
  },

  isExpired: () => {
    const { user } = useAuthStore.getState();
    if (!user || !user.plan_expires_at) return false;
    
    return new Date(user.plan_expires_at) < new Date();
  }
}));

// Helper hook for components
export const useFeatureGate = (feature: FeatureKey) => {
  const { user } = useAuthStore();
  const planDefinitions = useSubscriptionStore(state => state.planDefinitions);
  
  if (!user) return false;
  if (user.plan === 'pro_plus' && feature === 'product_image') {
    return true;
  }
  if (user.custom_features && user.custom_features.includes(feature)) {
    return true;
  }
  
  const planDef = planDefinitions[user.plan];
  return !!(planDef && planDef.features.includes(feature));
};
