import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './Button';
import { RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const ReloadPrompt: React.FC = () => {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Setup periodic update checks (every 60 minutes)
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  const close = () => {
    setNeedRefresh(false);
  };

  if (!needRefresh) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in sm:bottom-6 sm:right-6">
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-[20px] border border-emerald-200/50 bg-white p-4 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.03)] sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-black tracking-tight text-slate-900">
              {t('common.updateAvailable', 'New Update Available!')}
            </h3>
            <p className="text-xs font-semibold text-slate-500">
              {t('common.updateDesc', 'A new version of AquaDealers is ready. Reload to apply changes.')}
            </p>
          </div>
          <button
            onClick={close}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label={t('common.close', 'Close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="success"
            className="flex-1"
            onClick={() => updateServiceWorker(true)}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('common.reload', 'Reload & Update')}
          </Button>
        </div>
      </div>
    </div>
  );
};
