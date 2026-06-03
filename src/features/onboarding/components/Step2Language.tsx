import React, { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { updateDealerProfile, completeStep } from '../services/onboardingService';
import { toast } from 'sonner';
import { Globe, Check } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Step2Props {
  onNext: () => void;
  onBack: () => void;
}

const LANGUAGES = [
  { code: 'te', name: 'తెలుగు (Telugu)', script: 'తెలుగులో బిల్లింగ్ మరియు లెడ్జర్' },
  { code: 'hi', name: 'हिन्दी (Hindi)', script: 'हिन्दी में बिलिंग और बहीखाता' },
  { code: 'en', name: 'English', script: 'Billing & Ledger in English' },
];

export const Step2Language: React.FC<Step2Props> = ({ onNext, onBack }) => {
  const { user, fetchDealerProfile } = useAuthStore();
  const [selectedLang, setSelectedLang] = useState<string>(user?.language || 'en');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // 1. Update Dealer language
      await updateDealerProfile(user.id, {
        language: selectedLang,
      });

      // 2. Complete Step 2
      await completeStep(user.id, 'language');
      await fetchDealerProfile();

      toast.success('Language preference saved!');
      onNext();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save language preference.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          Choose Language
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          Select your primary operating language. You can change this later.
        </p>
      </div>

      <div className="space-y-3">
        {LANGUAGES.map((lang) => {
          const isSelected = selectedLang === lang.code;

          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => setSelectedLang(lang.code)}
              className={cn(
                'w-full text-left p-4 rounded-2xl border transition-all duration-200 focus-ring flex items-center justify-between',
                isSelected
                  ? 'border-primary bg-primary/10 shadow-sm'
                  : 'border-primary/15 bg-primary/5 hover:bg-primary/8'
              )}
            >
              <div>
                <div
                  className={cn(
                    'text-base font-bold transition-colors',
                    isSelected ? 'text-primary' : 'text-text-primary'
                  )}
                >
                  {lang.name}
                </div>
                <div className="text-xs text-text-secondary mt-0.5">
                  {lang.script}
                </div>
              </div>
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center border',
                  isSelected
                    ? 'border-primary bg-primary text-white'
                    : 'border-primary/20 bg-primary/10 text-transparent'
                )}
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            </button>
          );
        })}
      </div>

      {selectedLang !== 'en' && (
        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 leading-relaxed">
          💡 <strong>Full Telugu and Hindi support is coming soon!</strong> The system will fall back to English for some pages for now, but billing receipts can be printed in your chosen language.
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button variant="secondary" onClick={onBack} className="flex-1 font-semibold">
          Back
        </Button>
        <Button
          variant="primary"
          onClick={onSubmit}
          loading={loading}
          className="flex-1 font-bold"
        >
          Continue
        </Button>
      </div>
    </div>
  );
};

export default Step2Language;
