import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Session } from '@supabase/supabase-js';
import type { Dealer } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { buildStaffDealerProfile } from '@/lib/staffAccess';
import { useStaffStore } from './staffStore';

interface AuthState {
  user: Dealer | null;
  session: Session | null;
  impersonator: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  onboardingComplete: boolean;

  setUser: (user: Dealer | null) => void;
  setSession: (session: Session | null) => void;
  setImpersonator: (adminName: string | null) => void;
  clearSession: () => void;
  setLoading: (loading: boolean) => void;
  setOnboardingComplete: (complete: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  fetchDealerProfile: () => Promise<void>;
  initialize: () => Promise<void>;
}

interface RegisterData {
  name: string;
  shopName: string;
  phone: string;
  email: string;
  password: string;
  district: string;
  state: string;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      impersonator: null,
      isLoading: true,
      isAuthenticated: false,
      onboardingComplete: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setSession: (session) => set({ session }),
      setImpersonator: (adminName) => set({ impersonator: adminName }),
      clearSession: () => set({ session: null, impersonator: null }),
      setLoading: (isLoading) => set({ isLoading }),
      setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),

      login: async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        set({ session: data.session, isAuthenticated: true });
        await get().fetchDealerProfile();
      },

      register: async (data: RegisterData) => {
        const normalizedEmail = data.email.trim().toLowerCase();

        // 1. Sign up with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password: data.password,
        });
        if (authError) throw authError;
        if (!authData.user) throw new Error('Registration failed: The email address might already be registered.');
        if (!authData.session) {
          throw new Error(
            'Registration needs an active login session, but email confirmation is currently required. ' +
            'Disable email confirmation in Supabase Auth settings, or add a server-side signup endpoint using service role.'
          );
        }

        // 2. Create dealer record
        const { error: dealerError } = await supabase.from('dealers').insert({
          id: authData.user.id,
          name: data.name,
          shop_name: data.shopName,
          phone: data.phone,
          email: normalizedEmail,
          district: data.district,
          state: data.state || 'Andhra Pradesh',
          language: 'en',
          plan: 'trial',
          plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
        if (dealerError) throw dealerError;

        // 3. Create main branch
        const { error: branchError } = await supabase.from('branches').insert({
          dealer_id: authData.user.id,
          name: 'Main Shop',
          is_main: true,
          is_active: true,
        });
        if (branchError) throw branchError;

        set({ session: authData.session, isAuthenticated: true });
        await get().fetchDealerProfile();
      },

      logout: async () => {
        await supabase.auth.signOut();
        useStaffStore.getState().clearStaffSession();
        set({
          user: null,
          session: null,
          isAuthenticated: false,
          onboardingComplete: false,
        });
      },

      resetPassword: async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`,
        });
        if (error) throw error;
      },

      fetchDealerProfile: async () => {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;

        const { data: dealer, error } = await supabase
          .from('dealers')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (error || !dealer) return;

        // Check onboarding progress
        const { data: progress } = await supabase
          .from('onboarding_progress')
          .select('*')
          .eq('dealer_id', authUser.id)
          .maybeSingle();

        const completedSteps = [
          progress?.step_1_shop_details_at ? 'shop_details' : null,
          progress?.step_2_language_at ? 'language' : null,
          progress?.step_3_first_product_at ? 'catalog' : null,
          progress?.step_4_first_farmer_at ? 'first_farmer' : null,
          progress?.step_5_set_pin_at || progress?.step_5_first_bill_at ? 'set_pin' : null,
        ].filter(Boolean) as string[];
        const requiredSteps = ['shop_details', 'language', 'catalog', 'first_farmer', 'set_pin'];
        const allComplete = requiredSteps.every((s) => completedSteps.includes(s));

        set({
          user: dealer as Dealer,
          isAuthenticated: true,
          onboardingComplete: allComplete,
        });
      },

      initialize: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            set({ session, isAuthenticated: true });
            
            // If we already have the user from local storage, stop loading so app opens immediately
            if (get().user) {
              set({ isLoading: false });
            }

            // Fetch latest profile in background
            get().fetchDealerProfile().finally(() => {
              set({ isLoading: false });
            });
            return;
          }

          const staffState = useStaffStore.getState();
          if (staffState.currentStaff && staffState.portalContext) {
            set({
              user: buildStaffDealerProfile({
                dealerId: staffState.currentStaff.dealerId,
                shopName: staffState.portalContext.shopName,
              }),
              session: null,
              isAuthenticated: true,
              onboardingComplete: true,
            });
          }
        } catch (err) {
          console.error('Auth init error:', err);
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'aquadealer-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        onboardingComplete: state.onboardingComplete,
      }),
    }
  )
);
