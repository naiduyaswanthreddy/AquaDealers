import React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className, id, rows = 3, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="mb-2 block text-sm font-semibold text-text-secondary"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <textarea
            ref={ref}
            id={textareaId}
            rows={rows}
            className={cn(
              'aqua-input focus-ring w-full rounded-2xl border bg-white/95 px-4 py-3 text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]',
              'border-border placeholder:text-text-muted disabled:bg-surface-muted disabled:text-text-muted',
              error && 'border-danger bg-danger-light/30',
              className
            )}
            {...props}
          />
        </div>
        {error ? (
          <p className="mt-2 text-sm font-medium text-danger animate-slide-down">{error}</p>
        ) : helperText ? (
          <p className="mt-2 text-sm text-text-muted">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;
