import React, { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usePinStore } from '@/stores/pinStore';
import { setDealerPin, completeStep } from '../services/onboardingService';
import { toast } from 'sonner';
import { Shield, Key, ArrowRight, Delete, CheckCircle } from 'lucide-react';
import { Button, Card, CardContent } from '@/components/ui';
import { cn, hashPin } from '@/lib/utils';

interface Step5Props {
  onFinish: () => void;
  onBack: () => void;
}

export const Step5SetPin: React.FC<Step5Props> = ({ onFinish, onBack }) => {
  const { user, fetchDealerProfile } = useAuthStore();
  const { setPinSet, setTimeoutMinutes } = usePinStore();

  const [pinMode, setPinMode] = useState<'enter' | 'confirm'>('enter');
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [timeoutMin, setTimeoutMin] = useState<number>(5);
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  const activePin = pinMode === 'enter' ? enteredPin : confirmPin;

  const handleKeypadPress = (digit: string) => {
    if (error) setError(false);

    if (pinMode === 'enter') {
      if (enteredPin.length < 4) {
        const next = enteredPin + digit;
        setEnteredPin(next);
        if (next.length === 4) {
          // Switch to confirm mode
          setTimeout(() => {
            setPinMode('confirm');
          }, 300);
        }
      }
    } else {
      if (confirmPin.length < 4) {
        const next = confirmPin + digit;
        setConfirmPin(next);
      }
    }
  };

  const handleBackspace = () => {
    if (error) setError(false);

    if (pinMode === 'enter') {
      setEnteredPin(enteredPin.slice(0, -1));
    } else {
      if (confirmPin.length === 0) {
        setPinMode('enter');
        setEnteredPin(enteredPin.slice(0, -1));
      } else {
        setConfirmPin(confirmPin.slice(0, -1));
      }
    }
  };

  const handleSavePin = async () => {
    if (!user) return;
    if (enteredPin.length !== 4 || confirmPin.length !== 4) {
      toast.error('Please enter a 4-digit PIN.');
      return;
    }

    if (enteredPin !== confirmPin) {
      setError(true);
      toast.error("PINs don't match, please try again!");
      setConfirmPin('');
      return;
    }

    setLoading(true);
    try {
      // 1. Hash the PIN on the client and save in Supabase
      const hashedPin = await hashPin(enteredPin);
      await setDealerPin(user.id, hashedPin, timeoutMin);

      // 2. Update local Pin Store
      setPinSet(true);
      setTimeoutMinutes(timeoutMin);

      // 3. Mark step completed
      await completeStep(user.id, 'set_pin');
      await fetchDealerProfile();

      toast.success('Security PIN configured successfully!');
      onFinish();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to configure PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Skip means we write the step but don't set isPinSet in store
      await completeStep(user.id, 'set_pin');
      await fetchDealerProfile();
      toast.info('PIN setup skipped. You can set this in Settings later.');
      onFinish();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to skip PIN setup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Secure Your Shop
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          Configure a 4-digit PIN to lock AquaDealer when your phone goes idle.
        </p>
      </div>

      {/* PIN Enter Displays */}
      <Card className="border border-border bg-slate-50 rounded-2xl shadow-none">
        <CardContent className="p-4 flex flex-col items-center">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            {pinMode === 'enter' ? '1. Enter New PIN' : '2. Confirm PIN'}
          </span>

          <div
            className={cn(
              'flex gap-4 items-center h-8 justify-center mb-3',
              error && 'animate-[shake_0.4s_ease-in-out]'
            )}
          >
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={cn(
                  'w-3.5 h-3.5 rounded-full border-2 transition-all',
                  activePin.length > idx
                    ? 'border-primary bg-primary scale-110'
                    : 'border-slate-300 bg-transparent'
                )}
              />
            ))}
          </div>

          {pinMode === 'confirm' && enteredPin === confirmPin && confirmPin.length === 4 && (
            <span className="text-success text-xs font-bold flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> PINs Match!
            </span>
          )}
        </CardContent>
      </Card>

      {/* Keypad */}
      <div className="w-full max-w-[240px] mx-auto grid grid-cols-3 gap-y-3 gap-x-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleKeypadPress(digit)}
            className="w-12 h-12 text-lg font-bold rounded-full bg-primary/8 hover:bg-primary/12 border border-primary/20 text-primary flex items-center justify-center transition-colors active:scale-95"
          >
            {digit}
          </button>
        ))}

        <div className="w-12 h-12" />

        <button
          type="button"
          onClick={() => handleKeypadPress('0')}
          className="w-12 h-12 text-lg font-bold rounded-full bg-primary/8 hover:bg-primary/12 border border-primary/20 text-primary flex items-center justify-center transition-colors active:scale-95"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleBackspace}
          className="w-12 h-12 rounded-full bg-primary/8 hover:bg-primary/14 border border-primary/20 flex items-center justify-center transition-colors text-primary"
          aria-label="Delete"
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>

      {/* Timeout selector (only show when pin entering is done) */}
      {enteredPin.length === 4 && confirmPin.length === 4 && enteredPin === confirmPin && (
        <div className="space-y-2 pt-2 border-t border-border animate-fade-in">
          <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">
            Auto-lock Idle Timeout
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[5, 15, 30].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTimeoutMin(t)}
                className={cn(
                  'py-2 px-3 text-xs font-bold border rounded-xl transition-all',
                  timeoutMin === t
                    ? 'border-primary bg-primary text-white shadow-sm'
                    : 'border-primary/20 bg-primary/8 text-primary hover:bg-primary/14'
                )}
              >
                {t} Mins
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Save Action */}
      <div className="pt-4 flex flex-col gap-3">
        {enteredPin.length === 4 && confirmPin.length === 4 && enteredPin === confirmPin ? (
          <Button
            variant="primary"
            fullWidth
            onClick={handleSavePin}
            loading={loading}
            className="font-bold"
            rightIcon={<ArrowRight className="w-5 h-5" />}
          >
            Configure & Finish Onboarding
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onBack} disabled={loading} className="flex-1 font-semibold">
              Back
            </Button>
          </div>
        )}

        <button
          type="button"
          onClick={handleSkip}
          disabled={loading}
          className="text-xs font-semibold text-text-muted hover:text-text-secondary transition-colors focus-ring py-1 px-3 rounded-lg self-center"
        >
          Skip security configuration
        </button>
      </div>
    </div>
  );
};

export default Step5SetPin;
