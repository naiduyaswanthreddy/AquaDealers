import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Plus, X } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits';
import { ProductSelector } from '../components/ProductSelector';
import { useFarmers } from '@/features/farmers/hooks/useFarmers';
import { Button, DatePicker, Modal } from '@/components/ui';
import { PaymentStep } from '../components/PaymentStep';
import { ReviewStep } from '../components/ReviewStep';
import { CheckoutSuccessModal } from '../components/CheckoutSuccessModal';
import { getLocalDateString } from '@/lib/utils';

const MOBILE_STEPS = ['items', 'payment', 'review'] as const;
const DESKTOP_STEPS = ['items', 'review'] as const;

const MOBILE_META = [
  { key: 'items' as const, label: 'Items', title: 'New Invoice' },
  { key: 'payment' as const, label: 'Payment', title: 'Payment Details' },
  { key: 'review' as const, label: 'Review', title: 'Review' },
];

const DESKTOP_META = [
  { key: 'items' as const, label: 'Items', title: 'New Invoice' },
  { key: 'review' as const, label: 'Review', title: 'Review' },
];

const NewBillPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isExpired = useSubscriptionStore(state => state.isExpired());
  const { data: limits, isLoading: limitsLoading } = useSubscriptionLimits();
  const [searchParams] = useSearchParams();
  const farmerIdParam = searchParams.get('farmer');
  const { data: farmers } = useFarmers();
  
  const {
    setFarmer,
    farmerId,
    billDate,
    setBillDate,
    initializeBillDate,
    initializeGstEnabled,
    isEstimate,
    drafts,
    activeDraftId,
    setActiveDraft,
    createDraft,
    closeDraft,
    completeActiveDraft,
    setActiveDraftStep,
  } = useCartStore();
  const activeDraft = drafts.find((draft) => draft.id === activeDraftId);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [step, setStep] = useState<string>(activeDraft?.step || 'items');
  const [draftToDiscard, setDraftToDiscard] = useState<string | null>(null);
  const hasAppliedFarmerParam = React.useRef(false);

  const changeStep = (nextStep: string) => {
    setStep(nextStep);
    if (nextStep === 'items' || nextStep === 'payment' || nextStep === 'review') {
      setActiveDraftStep(nextStep);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      setStep((prev) => {
        if (!mobile && prev === 'payment') {
          setActiveDraftStep('review');
          return 'review';
        }
        return prev;
      });
    };
    handleResize(); // fix any invalid step on mount (e.g. 'payment' persisted from a mobile session)
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/bills');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const BILL_STEPS = isMobile ? MOBILE_STEPS : DESKTOP_STEPS;
  const STEP_META = isMobile ? MOBILE_META : DESKTOP_META;

  // Checkout success state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{
    billId: string;
    billNumber: string;
    total: number;
    amountPaid: number;
    balanceDue: number;
    farmerName: string | null;
    billDate: string;
    isOffline?: boolean;
    isEstimate?: boolean;
  } | null>(null);

  useEffect(() => {
    initializeGstEnabled(user?.gst_billing_enabled ?? false);
  }, [initializeGstEnabled, user?.gst_billing_enabled]);

  useEffect(() => {
    if (!hasAppliedFarmerParam.current && farmerIdParam && farmers && !farmerId) {
      const targetFarmer = farmers.find(f => f.id === farmerIdParam);
      if (targetFarmer) {
        setFarmer(
          targetFarmer.id,
          targetFarmer.name,
          targetFarmer.total_due || 0,
          targetFarmer.credit_limit || 0
        );
        hasAppliedFarmerParam.current = true;
      }
    }
  }, [farmerIdParam, farmers, farmerId, setFarmer]);

  // Always reset to today on mount — persisted carts may carry a stale date from a prior session.
  useEffect(() => {
    setBillDate(getLocalDateString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    changeStep(activeDraft?.step || 'items');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDraftId]);

  const stepIndex = BILL_STEPS.indexOf(step as any);

  const handleNext = () => {
    const nextStep = BILL_STEPS[stepIndex + 1];
    if (nextStep) changeStep(nextStep);
  };

  const handleBack = () => {
    const previousStep = BILL_STEPS[stepIndex - 1];
    if (previousStep) changeStep(previousStep);
  };

  const handlePageBack = () => {
    if (step === 'items') {
      navigate('/bills');
    } else {
      handleBack();
    }
  };

  const handleCheckoutSuccess = (data: typeof successData) => {
    if (!data) return;
    setSuccessData({ ...data, isEstimate });
    setShowSuccessModal(true);
    completeActiveDraft();
  };

  const handleStartNewBill = () => {
    setShowSuccessModal(false);
    setSuccessData(null);
  };

  const handleCloseDraft = (draftId: string) => {
    const draft = drafts.find((candidate) => candidate.id === draftId);
    if (!draft) return;
    if (draft.isDirty || draft.items.length > 0) {
      setDraftToDiscard(draftId);
      return;
    }
    closeDraft(draftId);
  };

  const currentMeta = STEP_META[Math.max(0, stepIndex)] ?? STEP_META[0];

  if (isExpired) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh p-6 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <X className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Subscription Expired</h1>
        <p className="text-slate-600 max-w-md mb-8">
          Your account is currently in read-only mode. You cannot create new bills or farmers until you renew your subscription.
        </p>
        <button
          onClick={() => navigate('/bills')}
          className="admin-btn admin-btn-primary"
        >
          Return to Bills
        </button>
      </div>
    );
  }

  if (!limitsLoading && limits && !limits.canAddBill) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh p-6 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
          <span className="text-2xl text-blue-600">🚀</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Invoice Limit Reached</h1>
        <p className="text-slate-600 max-w-md mb-8">
          You have reached the maximum number of bills ({limits.maxBills}) allowed on your current plan. Please contact Sales or your Admin to upgrade your plan.
        </p>
        <button
          onClick={() => navigate('/bills')}
          className="admin-btn admin-btn-primary"
        >
          Return to Bills
        </button>
      </div>
    );
  }

  return (
    <div className="billing-wizard lg:overflow-visible lg:h-full lg:flex lg:flex-col lg:!bg-surface">
      <header className="billing-wizard__header shrink-0 lg:hidden md:!px-6">
        <div className="relative w-full pt-1 pb-2 flex flex-col md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-3">
          
          {/* Mobile Top Row */}
          <div className="flex justify-between items-center md:hidden mb-2 px-1">
            <button
              type="button"
              onClick={handlePageBack}
              className="billing-wizard__icon-button"
              aria-label="Back"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/bills')}
              className="billing-wizard__icon-button"
              aria-label="Close invoice"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          {/* Desktop Left Side */}
          <div className="flex items-center gap-4 justify-start">
            <button
              type="button"
              onClick={handlePageBack}
              className="billing-wizard__icon-button !hidden md:!inline-flex shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div className="billing-wizard__header-content md:shrink-0 md:!pl-0 flex-1 md:flex-none w-full md:w-auto">
              <div className="flex items-center justify-between w-full md:gap-8">
                <div>
                  <div className="billing-wizard__eyebrow">STEP {stepIndex + 1} OF 3</div>
                  <h1 className="billing-wizard__title">{currentMeta.title}</h1>
                </div>
                <div className="shrink-0 ml-4 md:ml-0 md:absolute md:right-[4.5rem]">
                  <DatePicker
                    value={billDate}
                    onChange={setBillDate}
                    variant="header"
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Center (Desktop only) */}
          <div className="hidden md:flex justify-center w-full">
            <section className="billing-stepper !mt-0 !mb-0 w-full md:w-auto" aria-label="Billing progress">
              <div className="billing-stepper__track !bg-white/20" />
              <div className="billing-stepper__progress !bg-[#0ba467]" style={{ width: `${stepIndex * 50}%` }} />

              {STEP_META.map((meta, index) => {
                const isActive = meta.key === step;
                const isDone = stepIndex > index;

                return (
                  <button
                    key={meta.key}
                    type="button"
                    disabled={!isDone && !isActive}
                    onClick={() => isDone && changeStep(meta.key)}
                    className="billing-stepper__item group"
                  >
                    <span className={
                      isDone 
                        ? 'billing-stepper__dot !bg-emerald-500 !text-white !shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all'
                        : isActive 
                          ? 'billing-stepper__dot !bg-white !text-blue-600 !shadow-[0_0_25px_rgba(255,255,255,0.6)] scale-110 transition-all'
                          : 'billing-stepper__dot !bg-white/10 !text-white/50 backdrop-blur-md group-hover:!bg-white/20 transition-all'
                    }>
                      {isDone ? <Check className="h-5 w-5" strokeWidth={3} /> : index + 1}
                    </span>
                    <span className={
                      isDone 
                        ? 'billing-stepper__label !text-emerald-400 font-black' 
                        : isActive 
                          ? 'billing-stepper__label !text-white font-black' 
                          : 'billing-stepper__label !text-white/50'
                    }>
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </section>
          </div>

          {/* Desktop Right Side */}
          <div className="hidden md:flex justify-end items-center">
            <button
              type="button"
              onClick={() => navigate('/bills')}
              className="billing-wizard__icon-button shrink-0"
              aria-label="Close invoice"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      <div className="hidden lg:flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white pl-8 pr-2 py-2 xl:pl-12 xl:pr-2">
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
          <h1 className="shrink-0 px-2 text-xl font-black tracking-tight text-slate-950">New Invoice</h1>
          <div className="h-7 w-px shrink-0 bg-slate-200" aria-hidden="true" />
          <div className="flex min-w-0 items-center gap-2" role="tablist" aria-label="Invoice drafts">
            {drafts.map((draft) => {
              const isActive = draft.id === activeDraftId;
              const title = draft.farmerName || draft.label;
              return (
                <div
                  key={draft.id}
                  role="tab"
                  aria-selected={isActive}
                  className={`group flex h-9 max-w-56 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-bold transition-all ${isActive ? 'border-primary/30 bg-slate-50 text-primary shadow-sm' : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50'}`}
                >
                  <button type="button" onClick={() => setActiveDraft(draft.id)} className="flex min-w-0 items-center gap-2 text-left" title={title}>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${draft.isDirty ? 'bg-amber-500' : 'bg-slate-300'}`} aria-label={draft.isDirty ? 'Unsaved draft' : 'Empty draft'} />
                    <span className="truncate">{title}</span>
                    {draft.items.length > 0 && <span className="rounded bg-white px-1.5 py-0.5 text-[10px] tabular-nums text-slate-500 shadow-sm">{draft.items.length}</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCloseDraft(draft.id)}
                    className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                    aria-label={`Close ${title}`}
                    title={`Close ${title}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => createDraft()}
              disabled={drafts.length >= 5}
              className="ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Add invoice tab"
              title={drafts.length >= 5 ? 'Maximum five invoice tabs' : 'Add invoice tab'}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="h-7 w-px shrink-0 bg-slate-200" aria-hidden="true" />
        <div className="ml-auto shrink-0">
          <DatePicker value={billDate} onChange={setBillDate} className="w-auto min-w-40" />
        </div>
        <button
          type="button"
          onClick={() => navigate('/bills')}
          aria-label="Close invoice"
          title="Close invoice (Esc)"
          className="ml-2 shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-500 ring-1 ring-red-200 hover:bg-red-100 hover:text-red-600 hover:ring-red-400 transition-all"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile Stepper (below the blue header) */}
      <div className="md:hidden w-full px-4 -mt-4 pb-3 relative z-10 bg-transparent shrink-0">
        <section className="billing-stepper !mt-0 !mb-0 w-full" aria-label="Billing progress">
          <div className="billing-stepper__track" />
          <div className="billing-stepper__progress" style={{ width: `${stepIndex * 50}%` }} />

          {STEP_META.map((meta, index) => {
            const isActive = meta.key === step;
            const isDone = stepIndex > index;

            return (
              <button
                key={meta.key}
                type="button"
                disabled={!isDone && !isActive}
                onClick={() => isDone && changeStep(meta.key)}
                className="billing-stepper__item"
              >
                <span className={isDone ? 'billing-stepper__dot billing-stepper__dot--done' : isActive ? 'billing-stepper__dot billing-stepper__dot--active' : 'billing-stepper__dot'}>
                  {isDone ? <Check className="h-5 w-5" strokeWidth={3} /> : index + 1}
                </span>
                <span className={isDone ? 'billing-stepper__label billing-stepper__label--done' : isActive ? 'billing-stepper__label billing-stepper__label--active' : 'billing-stepper__label'}>
                  {meta.label}
                </span>
              </button>
            );
          })}
        </section>
      </div>

      <main className="billing-wizard__body animate-fade-in lg:!px-0 lg:!pt-0 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:overflow-y-auto" key={`${activeDraftId}-${step}`}>
        {step === 'items' && (
          <ProductSelector onNext={handleNext} onSuccess={handleCheckoutSuccess} />
        )}
        {step === 'payment' && (
          <PaymentStep onNext={handleNext} />
        )}
        {step === 'review' && (
          <ReviewStep
            onBack={handleBack}
            onSuccess={handleCheckoutSuccess}
          />
        )}
      </main>

      {showSuccessModal && successData && (
        <CheckoutSuccessModal
          isOpen={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          billId={successData.billId}
          billNumber={successData.billNumber}
          totalAmount={successData.total}
          amountPaid={successData.amountPaid}
          balanceDue={successData.balanceDue}
          farmerName={successData.farmerName}
          billDate={successData.billDate}
          isOffline={successData.isOffline}
          isEstimate={successData.isEstimate}
          onStartNewBill={handleStartNewBill}
        />
      )}

      <Modal
        isOpen={!!draftToDiscard}
        onClose={() => setDraftToDiscard(null)}
        title="Discard invoice draft?"
      >
        <div className="space-y-5 p-5">
          <p className="text-sm text-slate-600">This invoice has unsaved changes. Discarding it cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDraftToDiscard(null)}>Keep Draft</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (draftToDiscard) closeDraft(draftToDiscard);
                setDraftToDiscard(null);
              }}
            >
              Discard Draft
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default NewBillPage;
