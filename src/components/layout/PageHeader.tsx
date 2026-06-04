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
          <div className="flex w-full items-center justify-between z-10">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full text-white/90 hover:bg-white/10 hover:text-white transition-colors"
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
        <div className="w-full">
          {showEyebrow ? <span className="page-header__eyebrow">{eyebrow}</span> : null}
          <div className="page-header__meta flex items-center gap-4">
            {avatar && <div className="flex-shrink-0">{avatar}</div>}
            <div className="min-w-0 flex-1">
              <h1 className="page-header__title">{title}</h1>
              {description ? <p className="page-header__description mt-2">{description}</p> : null}
            </div>
            {action ? <div className="page-header__action">{action}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PageHeader;
