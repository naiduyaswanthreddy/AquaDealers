import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary' | 'success';
  loading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footerButtons={[
        {
          label: cancelLabel,
          variant: 'outline',
          onClick: onClose,
          disabled: loading,
        },
        {
          label: confirmLabel,
          variant: variant,
          onClick: onConfirm,
          loading: loading,
        },
      ]}
    >
      <div className="flex items-start gap-4">
        {variant === 'danger' && (
          <div className="flex-shrink-0 rounded-full bg-danger/10 p-3">
            <AlertTriangle className="h-6 w-6 text-danger" />
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm text-text-secondary md:text-base leading-relaxed">
            {message}
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
