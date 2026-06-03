import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Lock, Delete, ArrowRight, Store } from 'lucide-react';
import { toast } from 'sonner';
import { PageShell } from '@/components/layout/PageShell';
import { SectionCard } from '@/components/layout/SectionCard';
import { Button } from '@/components/ui';
import { resolveStaffPortalContext, verifyStaffPortalPin } from '../services/staffService';
import { useStaffStore } from '@/stores/staffStore';
import { useAuthStore } from '@/stores/authStore';
import { buildStaffDealerProfile, getStaffDefaultRoute } from '@/lib/staffAccess';
import { cn } from '@/lib/utils';

function humanizeSlug(value: string | undefined): string {
  if (!value) return '';
  return value
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

export const StaffPortalPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ shopSlug: string; branchSlug: string }>();
  const { session } = useAuthStore();
  const { setStaffSession } = useStaffStore();

  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const [portalContext, setPortalContext] = useState<Awaited<ReturnType<typeof resolveStaffPortalContext>> | null>(null);
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadContext = async () => {
      if (!params.shopSlug || !params.branchSlug) {
        setContextError('Invalid staff link.');
        setIsLoadingContext(false);
        return;
      }

      try {
        const context = await resolveStaffPortalContext(params.shopSlug, params.branchSlug);
        setPortalContext(context);
      } catch (err: any) {
        setContextError(err?.message || 'Unable to load staff portal.');
      } finally {
        setIsLoadingContext(false);
      }
    };

    loadContext();
  }, [params.shopSlug, params.branchSlug]);

  const handlePinSubmit = async (rawPin: string) => {
    if (!params.shopSlug || !params.branchSlug) return;

    setIsSubmitting(true);
    setError(false);

    try {
      const result = await verifyStaffPortalPin(params.shopSlug, params.branchSlug, rawPin);
      const defaultRoute = getStaffDefaultRoute(result.staff.permissions);

      setStaffSession(
        {
          id: result.staff.id,
          name: result.staff.name,
          phone: result.staff.phone,
          dealerId: result.dealerId,
          branchId: result.branchId,
          branchIds: result.staff.branchIds,
          permissions: result.staff.permissions,
          defaultRoute,
        },
        {
          shopSlug: result.shopSlug,
          branchSlug: result.branchSlug,
          dealerId: result.dealerId,
          branchId: result.branchId,
          shopName: result.shopName,
          branchName: result.branchName,
          portalUrl: result.portalUrl,
        }
      );

      setPin('');
      if (!session) {
        useAuthStore.getState().setUser(
          buildStaffDealerProfile({
            dealerId: result.dealerId,
            shopName: result.shopName,
          })
        );
        useAuthStore.getState().setOnboardingComplete(true);
      }

      navigate(defaultRoute, { replace: true });
    } catch (err: any) {
      setError(true);
      setPin('');
      toast.error(err?.message || 'Invalid PIN or access denied.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDigit = (digit: string) => {
    if (error) setError(false);
    if (pin.length >= 4) return;
    const next = `${pin}${digit}`;
    setPin(next);
    if (next.length === 4) {
      void handlePinSubmit(next);
    }
  };

  const handleBackspace = () => {
    if (error) setError(false);
    if (pin.length > 0) setPin(pin.slice(0, -1));
  };

  const pinDots = useMemo(() => [0, 1, 2, 3], []);

  const resolvedShopName = portalContext?.shopName || humanizeSlug(params.shopSlug);
  const resolvedBranchName = portalContext?.branchName || humanizeSlug(params.branchSlug);
  const portalUrl = portalContext?.portalUrl || `/${params.shopSlug || ''}/${params.branchSlug || ''}/staff`;

  return (
    <PageShell width="narrow">
      <SectionCard className="overflow-hidden">
        <div className="rounded-[1.35rem] bg-gradient-to-br from-primary to-primary-light p-5 text-white shadow-[0_14px_30px_rgba(20,103,159,0.14)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-white/72">Staff Portal</div>
              <div className="truncate text-xl font-black tracking-[-0.03em]">{resolvedShopName || 'Staff Access'}</div>
              <div className="truncate text-sm text-white/80">{resolvedBranchName || 'Branch'}</div>
            </div>
          </div>
          <p className="mt-4 max-w-lg text-sm leading-6 text-white/82">
            Enter the 4-digit staff PIN to open the restricted portal for this branch.
          </p>
        </div>

        <div className="space-y-6 px-5 py-5 sm:px-6">
          {contextError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
              {contextError}. You can still try the PIN; the portal will resolve after login.
            </div>
          ) : null}

          {isLoadingContext ? (
            <div className="flex items-center justify-center py-2">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : null}

          <div className="flex flex-col items-center">
            <div
              className={cn(
                'mb-4 flex items-center justify-center gap-4',
                error && 'animate-[shake_0.4s_ease-in-out]'
              )}
            >
              {pinDots.map((idx) => (
                <div
                  key={idx}
                  className={cn(
                    'h-4 w-4 rounded-full border-2 transition-all duration-150',
                    error
                      ? 'border-danger bg-danger'
                      : pin.length > idx
                      ? 'border-primary-light bg-primary-light scale-110 shadow-[0_0_8px_rgba(43,140,208,0.5)]'
                      : 'border-slate-300 bg-transparent'
                  )}
                />
              ))}
            </div>
            <div className="h-6 text-sm font-semibold text-danger">{error ? 'Wrong PIN' : null}</div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                className="focus-ring flex h-14 items-center justify-center rounded-2xl bg-slate-800 text-lg font-bold text-white transition-colors hover:bg-slate-700 active:bg-slate-600"
              >
                {digit}
              </button>
            ))}
            <div className="h-14" />
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="focus-ring flex h-14 items-center justify-center rounded-2xl bg-slate-800 text-lg font-bold text-white transition-colors hover:bg-slate-700 active:bg-slate-600"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="focus-ring flex h-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 active:bg-slate-300"
              aria-label="Delete"
            >
              <Delete className="h-5 w-5" />
            </button>
          </div>

          <Button
            type="button"
            variant="primary"
            fullWidth
            loading={isSubmitting}
            rightIcon={<ArrowRight className="h-4.5 w-4.5" />}
            onClick={() => handlePinSubmit(pin)}
            disabled={pin.length !== 4 || isSubmitting}
          >
            Open Staff Portal
          </Button>

          <div className="rounded-2xl border border-border bg-surface/35 p-4 text-xs leading-6 text-text-secondary">
            Portal path: <span className="font-semibold text-text-primary">{portalUrl}</span>
          </div>
        </div>
      </SectionCard>
    </PageShell>
  );
};

export default StaffPortalPage;
