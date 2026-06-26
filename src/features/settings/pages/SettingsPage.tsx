import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Save, Globe, Lock, ShieldCheck, TimerReset, PenLine, Package, GitBranch, Users, ChevronRight, FileText, TrendingUp, Crown, CheckCircle2, Store, User, Phone, Mail, MapPin, Tag, Upload, X, Check } from 'lucide-react';
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
import { Modal } from '@/components/ui/Modal';
import { Dealer } from '@/types/database';
import { hashPin } from '@/lib/utils';
import SignaturePad from '@/features/billing/components/SignaturePad';

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
  farmer_product_discounts_enabled: boolean;
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
  const [isEditingProfile, setIsEditingProfile] = React.useState(false);
  const [authorizedSignatoryData, setAuthorizedSignatoryData] = React.useState<any[] | null>(user?.authorized_signatory_data || null);
  const { planDefinitions } = useSubscriptionStore();
  const hasFarmerDiscountFeature = useSubscriptionStore((state) => state.hasFeature('farmer_product_discounts'));
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
        farmer_product_discounts_enabled: user.farmer_product_discounts_enabled ?? false,
      });
      setAuthorizedSignatoryData(user.authorized_signatory_data || null);
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
          farmer_product_discounts_enabled: hasFarmerDiscountFeature ? data.farmer_product_discounts_enabled : false,
          authorized_signatory_data: authorizedSignatoryData,
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
        farmer_product_discounts_enabled: updatedUser.farmer_product_discounts_enabled ?? false,
      });
      toast.success(t('common.save') + ' ' + t('common.successful', 'Successful'));
      setIsEditingProfile(false);
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
        onBack={() => navigate('/more')}
      />

      <div className="mb-8 flex overflow-x-auto hide-scrollbar items-center gap-1.5 p-1.5 bg-slate-100/60 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className={`relative px-5 py-2 text-sm font-semibold transition-all duration-200 rounded-lg whitespace-nowrap shrink-0 ${
            !section
              ? 'bg-primary text-white shadow-md ring-1 ring-primary/50'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/40 border border-transparent'
          }`}
        >
          Shop Profile
        </button>
        <button
          type="button"
          onClick={() => navigate('/settings/security')}
          className={`relative px-5 py-2 text-sm font-semibold transition-all duration-200 rounded-lg whitespace-nowrap shrink-0 ${
            section === 'security'
              ? 'bg-primary text-white shadow-md ring-1 ring-primary/50'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/40 border border-transparent'
          }`}
        >
          Lock Screen
        </button>
        <button
          type="button"
          onClick={() => navigate('/settings/templates')}
          className={`relative px-5 py-2 text-sm font-semibold transition-all duration-200 rounded-lg whitespace-nowrap shrink-0 ${
            section === 'templates'
              ? 'bg-primary text-white shadow-md ring-1 ring-primary/50'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/40 border border-transparent'
          }`}
        >
          Billing Templates
        </button>
      </div>

      {!isSecuritySection ? (
        <>
          <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-5 mb-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100/50 flex items-center justify-center shrink-0">
                <Crown className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-800">Subscription Plan</div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <h3 className="text-xl font-black text-slate-900 capitalize">{user?.plan?.replace('_', ' ') || 'Trial'} Plan</h3>
                  <span className="inline-flex items-center gap-1 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    Active
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  Expires on: {user?.plan_expires_at ? new Date(user.plan_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Never'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              {currentPlan.features.map(f => (
                <span key={f} className="inline-flex items-center gap-1 rounded-full bg-emerald-100/50 border border-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700 capitalize whitespace-nowrap">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  {f.replace(/_/g, ' ')}
                </span>
              ))}
              {(user?.custom_features || []).map(f => (
                <span key={f} className="inline-flex items-center gap-1 rounded-full bg-purple-100/50 border border-purple-100 px-2.5 py-1 text-[11px] font-bold text-purple-700 capitalize whitespace-nowrap">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />
                  {f.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden mb-6 shadow-sm">
            <div className="flex items-center justify-between p-5 border-b border-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <Store className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-[15px] font-bold text-slate-900">Shop Profile</h3>
              </div>
              <button type="button" onClick={() => setIsEditingProfile(true)} className="text-blue-600 text-[13px] font-bold flex items-center gap-0.5 hover:text-blue-700 transition-colors">
                Edit <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="divide-y divide-slate-50/80">
              {[
                { icon: Store, label: 'Shop Name', value: user?.shop_name || 'Not added' },
                { icon: User, label: 'Owner Name', value: user?.name || 'Not added' },
                { icon: Phone, label: 'Phone Number', value: user?.phone || 'Not added' },
                { icon: Mail, label: 'Email (Optional)', value: user?.email || 'Not added' },
                { icon: MapPin, label: 'Shop Address', value: user?.address || 'Not added' },
                { icon: Tag, label: 'GSTIN (Optional)', value: user?.gstin || 'Not added', action: 'Add' },
                { icon: Upload, label: 'Shop Logo (Optional)', value: 'Upload your shop logo', action: 'Upload' }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-4 hover:bg-slate-50/50 cursor-pointer transition-colors" onClick={() => setIsEditingProfile(true)}>
                  <div className="w-10 h-10 rounded-xl bg-blue-50/50 flex items-center justify-center shrink-0">
                    <item.icon className="w-[18px] h-[18px] text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-slate-800">{item.label}</div>
                    <div className="text-[13px] text-slate-500 truncate mt-0.5">{item.value}</div>
                  </div>
                  {item.action ? (
                    <div className="flex items-center gap-1 text-blue-600 text-[13px] font-bold">
                      {item.action} <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden mb-6 shadow-sm">
            <div className="divide-y divide-slate-50/80">
              <PlanGate feature="farmer_product_discounts" showOverlay>
                <div className="flex items-center gap-4 p-4 lg:p-5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <Tag className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="text-[14px] font-bold text-slate-900">Farmer Medicine Discounts</div>
                    <div className="text-[12px] text-slate-500 mt-0.5 leading-tight">Enable farmer-specific medicine discounts</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" {...register('farmer_product_discounts_enabled')} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </PlanGate>

              <div className="flex items-center gap-4 p-4 lg:p-5 hover:bg-slate-50/50 cursor-pointer transition-colors" onClick={() => setIsEditingProfile(true)}>
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <div className="text-[14px] font-bold text-slate-900">Language Preference</div>
                  <div className="text-[12px] text-blue-600 font-bold mt-0.5">{watchLang === 'te' ? 'Telugu' : watchLang === 'hi' ? 'Hindi' : 'English'}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </div>

              <PlanGate feature="signature_proof" showOverlay>
                <div className="flex items-center gap-4 p-4 lg:p-5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <PenLine className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="text-[14px] font-bold text-slate-900">Bill Signature</div>
                    <div className="text-[12px] text-slate-500 mt-0.5 leading-tight">Enable customer signature on bills</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" {...register('bill_signature_enabled')} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </PlanGate>

              <div className="flex items-center gap-4 p-4 lg:p-5 hover:bg-slate-50/50 cursor-pointer transition-colors" onClick={() => setIsEditingProfile(true)}>
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <div className="text-[14px] font-bold text-slate-900">Authorized Signatory</div>
                  <div className="text-[12px] text-slate-500 mt-0.5 leading-tight">Add customer signature for bills & statements</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </div>

              <PlanGate feature="gst" showOverlay>
                <div className="flex items-center gap-4 p-4 lg:p-5">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="text-[14px] font-bold text-slate-900">GST Billing</div>
                    <div className="text-[12px] text-slate-500 mt-0.5 leading-tight">Enable GST on new bills by default</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" {...register('gst_billing_enabled')} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </PlanGate>
            </div>
          </div>

          <div className="mt-6 mb-24">
            <Button type="submit" onClick={handleSubmit(onSubmit)} className="w-full text-[15px] py-4 rounded-2xl shadow-sm font-bold" leftIcon={<Save className="w-5 h-5" />} loading={isSaving} disabled={!isDirty && JSON.stringify(authorizedSignatoryData) === JSON.stringify(user?.authorized_signatory_data)}>
              {t('common.save', 'Save Changes')}
            </Button>
          </div>

          <Modal
            isOpen={isEditingProfile}
            onClose={() => setIsEditingProfile(false)}
            title="Edit Shop Profile"
          >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-1 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label={t('settings.shopName', 'Shop Name')} {...register('shop_name', { required: t('common.required') })} error={errors.shop_name?.message} />
                <Input label={t('settings.ownerName', 'Owner Name')} {...register('name', { required: t('common.required') })} error={errors.name?.message} />
                <Input label={t('settings.phoneNumber', 'Phone Number')} {...register('phone', { required: t('common.required') })} error={errors.phone?.message} />
                <Input label={t('settings.email', 'Email (Optional)')} type="email" {...register('email')} />
                <div className="md:col-span-2">
                  <Input label={t('settings.shopAddress', 'Shop Address')} {...register('address')} />
                </div>
                <PlanGate feature="gst" showOverlay>
                  <Input label={t('settings.gstin', 'GSTIN (Optional)')} {...register('gstin')} />
                </PlanGate>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-500" />
                  {t('settings.languagePreference', 'Language Preference')}
                </h3>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="en" {...register('language')} className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300" />
                    <span className="text-sm font-medium text-gray-700">{t('settings.english', 'English')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="te" {...register('language')} className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300" />
                    <span className="text-sm font-medium text-gray-700">{t('settings.telugu', 'Telugu (తెలుగు)')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="hi" {...register('language')} className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300" />
                    <span className="text-sm font-medium text-gray-700">{t('settings.hindi', 'Hindi (हिंदी)')}</span>
                  </label>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-gray-500" />
                  Authorized Signatory
                </h3>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500 mb-4">
                    Draw your signature below. This will appear on all printed bills and statements as the Authorized Signatory.
                  </p>
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden max-w-md">
                    <SignaturePad value={Array.isArray(authorizedSignatoryData) ? authorizedSignatoryData : []} onChange={setAuthorizedSignatoryData} />
                  </div>
                </div>
              </div>

              <div className="pt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsEditingProfile(false)}>Cancel</Button>
                <Button type="submit" leftIcon={<Save className="w-4 h-4" />} loading={isSaving}>
                  {t('common.save', 'Save Changes')}
                </Button>
              </div>
            </form>
          </Modal>

          {/* Management Quick Links - Desktop Only */}
          <div className="hidden md:grid grid-cols-2 gap-6 mt-6">
            <button
              type="button"
              onClick={() => navigate('/branches')}
              className="relative overflow-hidden flex items-center gap-5 p-6 rounded-[1.35rem] border border-slate-200/60 bg-white hover:bg-gradient-to-br hover:from-white hover:to-blue-50/50 hover:border-blue-200 transition-all duration-300 text-left group shadow-sm hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.15rem] bg-blue-50 text-blue-600 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm">
                <GitBranch className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="text-base font-bold text-slate-900 group-hover:text-blue-900 transition-colors">Manage Shops</div>
                <p className="text-sm font-medium text-slate-500 mt-0.5">Add or edit your branch locations</p>
              </div>
              <div className="h-8 w-8 rounded-full flex items-center justify-center bg-slate-50 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-all duration-300">
                <ChevronRight className="h-5 w-5" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/staff')}
              className="relative overflow-hidden flex items-center gap-5 p-6 rounded-[1.35rem] border border-slate-200/60 bg-white hover:bg-gradient-to-br hover:from-white hover:to-emerald-50/50 hover:border-emerald-200 transition-all duration-300 text-left group shadow-sm hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.15rem] bg-emerald-50 text-emerald-600 shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 shadow-sm">
                <Users className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="text-base font-bold text-slate-900 group-hover:text-emerald-900 transition-colors">Manage Staff</div>
                <p className="text-sm font-medium text-slate-500 mt-0.5">Add staff members & set permissions</p>
              </div>
              <div className="h-8 w-8 rounded-full flex items-center justify-center bg-slate-50 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-all duration-300">
                <ChevronRight className="h-5 w-5" />
              </div>
            </button>
          </div>

          {/* Tools & Reports */}
          <div className="hidden md:grid md:grid-cols-2 gap-6 mt-6">
            <button
              type="button"
              onClick={() => navigate('/inventory/report')}
              className="relative overflow-hidden flex items-center gap-5 p-6 rounded-[1.35rem] border border-slate-200/60 bg-white hover:bg-gradient-to-br hover:from-white hover:to-indigo-50/50 hover:border-indigo-200 transition-all duration-300 text-left group shadow-sm hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.15rem] bg-indigo-50 text-indigo-600 shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm">
                <FileText className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="text-base font-bold text-slate-900 group-hover:text-indigo-900 transition-colors">Stock Report</div>
                <p className="text-sm font-medium text-slate-500 mt-0.5">View and export stock levels</p>
              </div>
              <div className="h-8 w-8 rounded-full flex items-center justify-center bg-slate-50 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-all duration-300">
                <ChevronRight className="h-5 w-5" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/inventory/rate-adjustment')}
              className="relative overflow-hidden flex items-center gap-5 p-6 rounded-[1.35rem] border border-slate-200/60 bg-white hover:bg-gradient-to-br hover:from-white hover:to-violet-50/50 hover:border-violet-200 transition-all duration-300 text-left group shadow-sm hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.15rem] bg-violet-50 text-violet-600 shrink-0 group-hover:bg-violet-600 group-hover:text-white transition-all duration-300 shadow-sm">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="text-base font-bold text-slate-900 group-hover:text-violet-900 transition-colors">Rate Diff Tool</div>
                <p className="text-sm font-medium text-slate-500 mt-0.5">Bulk adjust inventory prices</p>
              </div>
              <div className="h-8 w-8 rounded-full flex items-center justify-center bg-slate-50 text-slate-400 group-hover:bg-violet-100 group-hover:text-violet-600 transition-all duration-300">
                <ChevronRight className="h-5 w-5" />
              </div>
            </button>
          </div>
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
