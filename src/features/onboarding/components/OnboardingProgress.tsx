import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'shop_details', label: 'Shop' },
  { key: 'language', label: 'Language' },
  { key: 'catalog', label: 'Catalog' },
  { key: 'first_farmer', label: 'Farmer' },
  { key: 'set_pin', label: 'PIN' },
] as const;

interface OnboardingProgressProps {
  currentStep: number;
  completedSteps: string[];
}

export const OnboardingProgress: React.FC<OnboardingProgressProps> = ({
  currentStep,
  completedSteps,
}) => {
  return (
    <div className="px-2 py-3">
      <div className="mb-3 flex items-center justify-between px-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Progress
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            Step {currentStep} of {STEPS.length}
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {Math.round((currentStep / STEPS.length) * 100)}%
        </div>
      </div>

      <div className="relative flex items-start justify-between gap-1 px-1">
        <div className="absolute left-[9%] right-[9%] top-[1.15rem] h-[3px] rounded-full bg-slate-200" />

        <div
          className="absolute left-[9%] top-[1.15rem] h-[3px] rounded-full bg-primary transition-all duration-500 ease-out"
          style={{
            width: `${Math.max(0, ((currentStep - 1) / (STEPS.length - 1)) * 82)}%`,
          }}
        />

        {STEPS.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = completedSteps.includes(step.key);
          const isCurrent = stepNumber === currentStep;
          const isFuture = stepNumber > currentStep;

          return (
            <div key={step.key} className="relative z-10 flex min-w-0 flex-1 flex-col items-center">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 sm:h-10 sm:w-10',
                  isCompleted &&
                    'bg-primary text-white shadow-md shadow-primary/30',
                  isCurrent &&
                    'border-[2.5px] border-primary bg-white text-primary shadow-md shadow-primary/20 ring-4 ring-sky-50',
                  isFuture &&
                    !isCompleted &&
                    'border-2 border-slate-300 bg-white text-slate-400'
                )}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" strokeWidth={3} />
                ) : (
                  stepNumber
                )}
              </div>

              <span
                className={cn(
                  'mt-2 text-center text-[11px] font-semibold leading-4 transition-colors duration-300 sm:text-xs',
                  isCompleted && 'text-primary',
                  isCurrent && 'text-primary',
                  isFuture && !isCompleted && 'text-slate-400'
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OnboardingProgress;
