import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  topRightAction?: React.ReactNode;
  className?: string;
  onBack?: () => void;
  avatar?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ eyebrow, title, description, action, topRightAction, className, onBack, avatar }) => {
  const normalizedEyebrow = eyebrow?.trim().toLowerCase();
  const normalizedTitle = title.trim().toLowerCase();
  const showEyebrow = normalizedEyebrow && normalizedEyebrow !== normalizedTitle;

  return (
    <div className={cn('page-header page-header--page', className)}>
      <div className="page-header__hero flex flex-col gap-4 md:gap-2 relative">
        {(onBack || topRightAction) && (
          <div className={cn("flex w-full items-center justify-between z-10", !topRightAction && "lg:hidden")}>
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="-ml-2 flex lg:hidden h-8 w-8 items-center justify-center rounded-full text-white/90 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : <div />}
            {topRightAction && (
              <div className="-mr-2 flex items-center justify-center">
                {topRightAction}
              </div>
            )}
          </div>
        )}
        <div className="w-full flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1 w-full xl:w-auto">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="hidden lg:flex items-center justify-center shrink-0 w-11 h-11 rounded-[14px] bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-all ring-1 ring-white/10 hover:ring-white/25 shadow-sm backdrop-blur-sm group"
                aria-label="Back"
              >
                <ArrowLeft className="h-[1.15rem] w-[1.15rem] transition-transform duration-300 group-hover:-translate-x-0.5" strokeWidth={2.5} />
              </button>
            )}
            <div className="min-w-0 flex-1">
              {showEyebrow ? <span className="page-header__eyebrow block mb-1">{eyebrow}</span> : null}
              <div className="page-header__meta flex items-center gap-4">
                {avatar && <div className="flex-shrink-0">{avatar}</div>}
                <div className="min-w-0 flex-1">
                  <h1 className="page-header__title m-0 leading-tight">{title}</h1>
                  {description ? <div className="page-header__description mt-2 lg:hidden">{description}</div> : null}
                </div>
              </div>
            </div>
          </div>
          {action ? <div className="page-header__action shrink-0 flex justify-start xl:justify-end w-full xl:w-auto">{action}</div> : null}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;
