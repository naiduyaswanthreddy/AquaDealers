import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, X } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits';
import { ProductSelector } from '../components/ProductSelector';
import { useFarmers } from '@/features/farmers/hooks/useFarmers';
import { PaymentStep } from '../components/PaymentStep';
import { ReviewStep } from '../components/ReviewStep';
import { CheckoutSuccessModal } from '../components/CheckoutSuccessModal';

const BILL_STEPS = ['items', 'payment', 'review'] as const;

const STEP_META = [
  { key: 'items' as const, label: 'Items', title: 'New Invoice' },
  { key: 'payment' as const, label: 'Payment', title: 'Payment' },
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
  
  const { setGstEnabled, clearCart, setFarmer, farmerId } = useCartStore();
  const [step, setStep] = useState<(typeof BILL_STEPS)[number]>('items');

  // Local transaction refs for payments
  const [upiRef, setUpiRef] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [notes, setNotes] = useState('');

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
  } | null>(null);

  useEffect(() => {
    setGstEnabled(user?.gst_billing_enabled ?? false);
  }, [setGstEnabled, user?.gst_billing_enabled]);

  useEffect(() => {
    if (farmerIdParam && farmers && !farmerId) {
      const targetFarmer = farmers.find(f => f.id === farmerIdParam);
      if (targetFarmer) {
        setFarmer(
          targetFarmer.id,
          targetFarmer.name,
          targetFarmer.total_due || 0,
          targetFarmer.credit_limit || 0
        );
      }
    }
  }, [farmerIdParam, farmers, farmerId, setFarmer]);

  const stepIndex = BILL_STEPS.indexOf(step);

  const handleNext = () => {
    const nextStep = BILL_STEPS[stepIndex + 1];
    if (nextStep) setStep(nextStep);
  };

  const handleBack = () => {
    const previousStep = BILL_STEPS[stepIndex - 1];
    if (previousStep) setStep(previousStep);
  };

  const handlePageBack = () => {
    if (step === 'items') {
      navigate('/bills');
    } else {
      handleBack();
    }
  };

  const handleCheckoutSuccess = (data: typeof successData) => {
    setSuccessData(data);
    setShowSuccessModal(true);
  };

  const handleStartNewBill = () => {
    clearCart();
    setUpiRef('');
    setChequeNumber('');
    setNotes('');
    setShowSuccessModal(false);
    setSuccessData(null);
    setStep('items');
  };

  const currentMeta = STEP_META[stepIndex];

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
    <div className="billing-wizard lg:h-full lg:flex lg:flex-col lg:!bg-slate-50">
      <header className="billing-wizard__header shrink-0 lg:!rounded-none lg:!pb-4 lg:after:hidden md:!px-6 lg:!px-12 xl:!px-24">
        <div className="relative w-full pt-1 pb-4 flex flex-col md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-4">
          
          {/* Mobile Top Row */}
          <div className="flex justify-between items-center md:hidden mb-2">
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
              className="billing-wizard__icon-button hidden md:flex shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div className="billing-wizard__header-content md:shrink-0 md:!pl-0">
              <div className="billing-wizard__eyebrow">STEP {stepIndex + 1} OF 3</div>
              <h1 className="billing-wizard__title">{currentMeta.title}</h1>
            </div>
          </div>
          
          {/* Center */}
          <div className="flex justify-center w-full">
            <section className="billing-stepper !mt-8 md:!mt-0 !mb-0 w-full md:w-auto" aria-label="Billing progress">
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
                  onClick={() => isDone && setStep(meta.key)}
                  className="billing-stepper__item"
                >
                  <span className={isDone ? 'billing-stepper__dot billing-stepper__dot--done' : isActive ? 'billing-stepper__dot billing-stepper__dot--active' : 'billing-stepper__dot !bg-white/20 !text-white'}>
                    {isDone ? <Check className="h-5 w-5" strokeWidth={3} /> : index + 1}
                  </span>
                  <span className={isDone ? 'billing-stepper__label billing-stepper__label--done' : isActive ? 'billing-stepper__label billing-stepper__label--active !text-white' : 'billing-stepper__label !text-white/70'}>
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

      <main className="billing-wizard__body animate-fade-in lg:!px-0 lg:flex-1 lg:flex lg:flex-col lg:overflow-hidden" key={step}>
        {step === 'items' && (
          <ProductSelector onNext={handleNext} />
        )}
        {step === 'payment' && (
          <PaymentStep
            onNext={handleNext}
            upiRef={upiRef}
            setUpiRef={setUpiRef}
            chequeNumber={chequeNumber}
            setChequeNumber={setChequeNumber}
            notes={notes}
            setNotes={setNotes}
          />
        )}
        {step === 'review' && (
          <ReviewStep
            onBack={handleBack}
            onSuccess={handleCheckoutSuccess}
            upiRef={upiRef}
            chequeNumber={chequeNumber}
            notes={notes}
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
          onStartNewBill={handleStartNewBill}
        />
      )}
    </div>
  );
};

export default NewBillPage;
