import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { getProgress } from '../services/onboardingService';
import OnboardingProgress from '../components/OnboardingProgress';
import Step1ShopDetails from '../components/Step1ShopDetails';
import Step2Language from '../components/Step2Language';
import Step3ProductCatalog from '../components/Step3ProductCatalog';
import Step4AddFarmer from '../components/Step4AddFarmer';
import Step5SetPin from '../components/Step5SetPin';
import { Card, CardContent } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

const STEPS_KEYS = ['shop_details', 'language', 'catalog', 'first_farmer', 'set_pin'];

export const OnboardingPage: React.FC = () => {
  const { user, setOnboardingComplete } = useAuthStore();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load onboarding progress from Supabase
  useEffect(() => {
    if (!user) return;

    const loadProgress = async () => {
      try {
        const completed = await getProgress(user.id);
        setCompletedSteps(completed);

        // Determine initial step
        let nextStep = 1;
        for (let i = 0; i < STEPS_KEYS.length; i++) {
          if (completed.includes(STEPS_KEYS[i])) {
            nextStep = i + 2; // Move to the step after the completed one
          } else {
            break;
          }
        }
        // Cap nextStep at 5
        setCurrentStep(Math.min(5, nextStep));
      } catch (err) {
        console.error('Failed to load onboarding progress:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProgress();
  }, [user]);

  const handleNext = () => {
    // Dynamically update completed step list in state
    const currentKey = STEPS_KEYS[currentStep - 1];
    if (!completedSteps.includes(currentKey)) {
      setCompletedSteps((prev) => [...prev, currentKey]);
    }

    if (currentStep < 5) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleFinish = () => {
    setOnboardingComplete(true);
    navigate('/', { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <span className="text-sm font-semibold text-text-secondary animate-pulse">
            Configuring Account...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#f6fbff_0%,#eef6ff_28%,#f8fafc_100%)] px-4 py-5">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-lg flex-col">
        <div className="mb-4 rounded-[28px] border border-white/70 bg-white/80 px-5 py-5 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mb-2 inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
            Dealer Onboarding
          </div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-slate-900">
            AquaDealer Setup
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Set up your shop in a few focused steps and start billing with confidence.
          </p>
        </div>

        <div className="mb-4 rounded-[24px] border border-slate-200/80 bg-white px-2 py-2 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
          <OnboardingProgress
            currentStep={currentStep}
            completedSteps={completedSteps}
          />
        </div>

        <Card className="flex-1 rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <CardContent className="flex h-full flex-1 flex-col justify-between px-5 py-6 sm:px-6 sm:py-7">
            <div className="animate-slide-up">
            {currentStep === 1 && (
              <Step1ShopDetails onNext={handleNext} />
            )}
            {currentStep === 2 && (
              <Step2Language onNext={handleNext} onBack={handleBack} />
            )}
            {currentStep === 3 && (
              <Step3ProductCatalog onNext={handleNext} onBack={handleBack} />
            )}
            {currentStep === 4 && (
              <Step4AddFarmer onNext={handleNext} onBack={handleBack} />
            )}
            {currentStep === 5 && (
              <Step5SetPin onFinish={handleFinish} onBack={handleBack} />
            )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OnboardingPage;
