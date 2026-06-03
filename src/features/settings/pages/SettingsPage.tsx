import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Save, Globe, Lock, ShieldCheck, TimerReset, PenLine, Package } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { usePinStore } from '@/stores/pinStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/layout/SectionCard';
import { PlanGate } from '@/components/auth/PlanGate';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Dealer } from '@/types/database';
import { hashPin } from '@/lib/utils';

interface SettingsForm {
  name: string;
  shop_name: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  language: string;
  bill_signature_enabled: boolean;
  gst_billing_enabled: boolean;
}

interface SecurityForm {
  currentPin: string;
  newPin: string;
  confirmPin: string;
  timeoutMinutes: string;
}

const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();
  const { user, setUser } = useAuthStore();
  const { isPinSet, timeoutMinutes, setPinSet, setTimeoutMinutes, lock } = usePinStore();
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSavingSecurity, setIsSavingSecurity] = React.useState(false);
  const { planDefinitions } = useSubscriptionStore();
  const currentPlan = planDefinitions[user?.plan || 'trial'] || { name: 'trial', features: [], branch_limit: 1 };

  const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<SettingsForm>();
  const {
    register: registerSecurity,
    handleSubmit: handleSubmitSecurity,
    reset: resetSecurity,
    formState: { errors: securityErrors, isDirty: isSecurityDirty },
  } = useForm<SecurityForm>({
    defaultValues: {
      currentPin: '',
      newPin: '',
      confirmPin: '',
      timeoutMinutes: String(timeoutMinutes || user?.pin_timeout_minutes || 5),
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        name: user.name || '',
        shop_name: user.shop_name || '',
        phone: user.phone || '',
        email: user.email || '',
        address: user.address || '',
        gstin: user.gstin || '',
        language: user.language || 'en',
        bill_signature_enabled: user.bill_signature_enabled ?? true,
        gst_billing_enabled: user.gst_billing_enabled ?? false,
      });
    }
  }, [user, reset]);

  useEffect(() => {
    resetSecurity({
      currentPin: '',
      newPin: '',
      confirmPin: '',
      timeoutMinutes: String(user?.pin_timeout_minutes || timeoutMinutes || 5),
    });
  }, [resetSecurity, timeoutMinutes, user?.pin_timeout_minutes]);

  const watchLang = watch('language');

  useEffect(() => {
    if (watchLang && watchLang !== i18n.language) {
      i18n.changeLanguage(watchLang);
    }
  }, [watchLang, i18n]);

  const onSubmit = async (data: SettingsForm) => {
    if (!user) return;
    setIsSaving(true);
    
    try {
      const { data: updatedUser, error } = await supabase
        .from('dealers')
        .update({
          name: data.name,
          shop_name: data.shop_name,
          phone: data.phone,
          email: data.email || null,
          address: data.address || null,
          gstin: data.gstin || null,
          language: data.language,
          bill_signature_enabled: data.bill_signature_enabled,
          gst_billing_enabled: data.gst_billing_enabled,
        })
        .eq('id', user.id)
        .select()
        .single();
        
      if (error) throw error;
      
      setUser(updatedUser as Dealer);
      reset({
        name: updatedUser.name || '',
        shop_name: updatedUser.shop_name || '',
        phone: updatedUser.phone || '',
        email: updatedUser.email || '',
        address: updatedUser.address || '',
        gstin: updatedUser.gstin || '',
        language: updatedUser.language || 'en',
        bill_signature_enabled: updatedUser.bill_signature_enabled ?? true,
        gst_billing_enabled: updatedUser.gst_billing_enabled ?? false,
      });
      toast.success(t('common.save') + ' ' + t('common.successful', 'Successful'));
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmitSecurity = async (data: SecurityForm) => {
    if (!user) return;

    const nextTimeout = Number(data.timeoutMinutes);
    if (!Number.isFinite(nextTimeout) || nextTimeout < 1 || nextTimeout > 120) {
      toast.error('Timeout must be between 1 and 120 minutes.');
      return;
    }

    if (data.newPin || data.confirmPin || data.currentPin) {
      if (user.pin_hash && !data.currentPin) {
        toast.error('Current PIN is required.');
        return;
      }

      if (!/^\d{4}$/.test(data.newPin)) {
        toast.error('New PIN must be exactly 4 digits.');
        return;
      }

      if (data.newPin !== data.confirmPin) {
        toast.error('PIN confirmation does not match.');
        return;
      }

      if (user.pin_hash) {
        const currentPinHash = await hashPin(data.currentPin);
        if (currentPinHash !== user.pin_hash) {
          toast.error('Current PIN is incorrect.');
          return;
        }
      }
    }

    setIsSavingSecurity(true);
    try {
      const updates: Partial<Dealer> = {
        pin_timeout_minutes: nextTimeout,
      };

      if (data.newPin) {
        updates.pin_hash = await hashPin(data.newPin);
      }

      const { data: updatedUser, error } = await supabase
        .from('dealers')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      setUser(updatedUser as Dealer);
      setPinSet(Boolean(updatedUser.pin_hash));
      setTimeoutMinutes(updatedUser.pin_timeout_minutes || nextTimeout);
      resetSecurity({
        currentPin: '',
        newPin: '',
        confirmPin: '',
        timeoutMinutes: String(updatedUser.pin_timeout_minutes || nextTimeout),
      });
      toast.success('Security settings updated.');
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    } finally {
      setIsSavingSecurity(false);
    }
  };

  const isSecuritySection = section === 'security';

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow={isSecuritySection ? 'Security' : t('settings.preferences', 'Preferences')}
        title={isSecuritySection ? 'Lock Screen Settings' : t('nav.settings', 'Settings')}
        description={
          isSecuritySection
            ? 'Update your PIN, lock timeout, and manual lock behavior.'
            : t('settings.description', 'Manage your shop profile and preferences')
        }
      />

      <div className="mb-8 inline-flex items-center gap-1.5 p-1.5 bg-slate-100/60 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm mx-auto">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className={`relative px-5 py-2 text-sm font-semibold transition-all duration-200 rounded-lg ${
            !isSecuritySection
              ? 'bg-white text-slate-800 shadow-sm border border-slate-200/60 ring-1 ring-black/5'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/40 border border-transparent'
          }`}
        >
          Shop Profile
        </button>
        <button
          type="button"
          onClick={() => navigate('/settings/security')}
          className={`relative px-5 py-2 text-sm font-semibold transition-all duration-200 rounded-lg ${
            isSecuritySection
              ? 'bg-white text-slate-800 shadow-sm border border-slate-200/60 ring-1 ring-black/5'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/40 border border-transparent'
          }`}
        >
          Lock Screen
        </button>
      </div>

      {!isSecuritySection ? (
        <>
          <SectionCard title="Subscription Plan" className="mb-6 border-primary/20 bg-primary/[0.02]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-text-primary capitalize">{user?.plan?.replace('_', ' ') || 'Trial'} Plan</h3>
                <p className="text-sm text-text-secondary mt-1">
                  Expires on: <span className="font-semibold text-text-primary">{user?.plan_expires_at ? new Date(user.plan_expires_at).toLocaleDateString() : 'Never'}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2 max-w-[60%]">
                {currentPlan.features.map(f => (
                  <span key={f} className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 capitalize">
                    {f.replace('_', ' ')}
                  </span>
                ))}
                {(user?.custom_features || []).map(f => (
                  <span key={f} className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800 capitalize">
                    {f.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title={t('settings.shopProfile', 'Shop Profile')}>


            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label={t('settings.shopName', 'Shop Name')}
                  {...register('shop_name', { required: t('common.required') })}
                  error={errors.shop_name?.message}
                />
                <Input
                  label={t('settings.ownerName', 'Owner Name')}
                  {...register('name', { required: t('common.required') })}
                  error={errors.name?.message}
                />
                <Input
                  label={t('settings.phoneNumber', 'Phone Number')}
                  {...register('phone', { required: t('common.required') })}
                  error={errors.phone?.message}
                />
                <Input
                  label={t('settings.email', 'Email (Optional)')}
                  type="email"
                  {...register('email')}
                />
                <div className="md:col-span-2">
                  <Input
                    label={t('settings.shopAddress', 'Shop Address')}
                    {...register('address')}
                  />
                </div>
                <PlanGate feature="gst" showOverlay>
                  <Input
                    label={t('settings.gstin', 'GSTIN (Optional)')}
                    {...register('gstin')}
                  />
                </PlanGate>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-500" />
                  {t('settings.languagePreference', 'Language Preference')}
                </h3>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="en"
                      {...register('language')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">{t('settings.english', 'English')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="te"
                      {...register('language')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">{t('settings.telugu', 'Telugu (తెలుగు)')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="hi"
                      {...register('language')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">{t('settings.hindi', 'Hindi (हिंदी)')}</span>
                  </label>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <PlanGate feature="signature_proof" showOverlay>
                  <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <PenLine className="w-4 h-4 text-gray-500" />
                    Bill Signature
                  </h3>
                  <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div>
                      <div className="text-sm font-bold text-slate-900">Enable customer signature on bills</div>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        When enabled, credit or pending bills ask for a customer signature before saving.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      {...register('bill_signature_enabled')}
                      className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                </PlanGate>
                <PlanGate feature="gst" showOverlay>
                  <h3 className="text-sm font-bold text-gray-900 mt-6 mb-4 flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-500" />
                    GST Billing
                  </h3>
                  <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div>
                      <div className="text-sm font-bold text-slate-900">Enable GST on new bills by default</div>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        When enabled, new bills will automatically include GST.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      {...register('gst_billing_enabled')}
                      className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                </PlanGate>
              </div>

              {user?.custom_features && user.custom_features.length > 0 && (
                <div className="pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-500" />
                    Addon Features
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {user.custom_features.map(feature => (
                      <span key={feature} className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {feature.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-6 flex justify-end">
                <Button type="submit" leftIcon={<Save className="w-4 h-4" />} loading={isSaving} disabled={!isDirty}>
                  {t('common.save', 'Save Changes')}
                </Button>
              </div>
            </form>
          </SectionCard>
        </>
      ) : (
      <PlanGate 
        feature="app_pin" 
        fallback={
          <div className="p-8 text-center rounded-2xl border border-dashed border-border mt-6">
            <Lock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">Upgrade to Pro</h3>
            <p className="text-slate-500 max-w-sm mx-auto">
              App PIN and Lock Screen security features are available on the Pro plan. Please contact Sales to upgrade your account.
            </p>
          </div>
        }
      >
        <div className="space-y-6">
          <SectionCard
            title="PIN Security"
            description="Change the 4-digit lock PIN used to unlock the app on this device."
          >
            <form onSubmit={handleSubmitSecurity(onSubmitSecurity)} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Current PIN"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  {...registerSecurity('currentPin')}
                  helperText={user?.pin_hash ? 'Required to change the existing PIN.' : 'No PIN set yet.'}
                />
                <Input
                  label="Lock timeout (minutes)"
                  type="number"
                  min={1}
                  max={120}
                  {...registerSecurity('timeoutMinutes', { required: 'Timeout is required.' })}
                  error={securityErrors.timeoutMinutes?.message}
                />
                <Input
                  label={isPinSet ? 'New PIN' : 'Set PIN'}
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  {...registerSecurity('newPin')}
                  helperText="Use exactly 4 digits."
                />
                <Input
                  label="Confirm PIN"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  {...registerSecurity('confirmPin')}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.35rem] border border-border bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
                    <ShieldCheck className="h-4.5 w-4.5 text-primary" />
                    PIN Status
                  </div>
                  <div className="mt-3 text-lg font-black text-text-primary">
                    {isPinSet ? 'PIN Active' : 'No PIN Set'}
                  </div>
                </div>
                <div className="rounded-[1.35rem] border border-border bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
                    <TimerReset className="h-4.5 w-4.5 text-primary" />
                    Timeout
                  </div>
                  <div className="mt-3 text-lg font-black text-text-primary">
                    {timeoutMinutes} min
                  </div>
                </div>
                <div className="rounded-[1.35rem] border border-border bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
                    <Lock className="h-4.5 w-4.5 text-primary" />
                    Manual Lock
                  </div>
                  <Button type="button" className="mt-3" variant="outline" onClick={() => lock()} disabled={!isPinSet}>
                    Lock Now
                  </Button>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" leftIcon={<Save className="w-4 h-4" />} loading={isSavingSecurity} disabled={!isSecurityDirty}>
                  Save Security Settings
                </Button>
              </div>
            </form>
          </SectionCard>
        </div>
      </PlanGate>
      )}
    </PageShell>
  );
};

export default SettingsPage;
