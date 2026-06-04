import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footerButtons?: {
    label: string;
    onClick?: () => void;
    variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost' | 'outline' | 'success' | 'dark' | 'darkOutline';
    loading?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    form?: string;
  }[];
  className?: string;
  hideCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footerButtons,
  className,
  hideCloseButton,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement as HTMLElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Set initial focus slightly delayed to ensure DOM is ready
    const focusTimer = setTimeout(() => {
      if (modalRef.current) {
        modalRef.current.focus();
      }
    }, 10);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      if (previousFocus) {
        previousFocus.focus();
      }
    };
  }, [isOpen]);

  const handleTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close modal" tabIndex={-1} />
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onKeyDown={handleTabKey}
        className={cn(
          'animate-slide-up relative z-10 flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.75rem] bg-white sm:animate-scale-in sm:rounded-[1.75rem]',
          'border border-border shadow-[0_24px_60px_rgba(15,30,45,0.22)] focus:outline-none',
          className
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <h3 id="modal-title" className="text-lg font-bold tracking-[-0.02em] text-text-primary">{title}</h3>
          {!hideCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="focus-ring flex h-10 w-10 items-center justify-center rounded-2xl text-text-secondary hover:bg-surface"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footerButtons?.length ? (
          <div className="flex flex-col-reverse gap-3 px-5 pb-5 pt-2 sm:flex-row sm:justify-end sm:px-6 sm:pb-6">
            {footerButtons.map((button, index) => (
              <Button
                key={`${button.label}-${index}`}
                type={button.type}
                form={button.form}
                variant={button.variant ?? 'primary'}
                onClick={button.onClick}
                loading={button.loading}
                disabled={button.disabled}
                fullWidth
                className="sm:w-auto"
              >
                {button.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
