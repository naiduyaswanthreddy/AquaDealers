import React from 'react';
import { Check } from 'lucide-react';
import { BRANCH_COLORS, DEFAULT_BRANCH_COLOR } from '@/lib/branchTheme';

interface BranchColorPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
}

/**
 * Swatch picker for a branch's theme color. The default AquaDealers blue is
 * always first; picking it stores NULL so the branch follows the app default.
 */
export const BranchColorPicker: React.FC<BranchColorPickerProps> = ({ value, onChange }) => {
  const selectedValue = value || DEFAULT_BRANCH_COLOR.value;

  return (
    <div>
      <div className="mb-2 text-sm font-bold text-text-primary">Branch color</div>
      <p className="mb-3 text-sm leading-6 text-text-secondary">
        The whole app changes to this color when this branch is active, so you always know which shop you are working in.
      </p>
      <div className="flex flex-wrap gap-2.5">
        {BRANCH_COLORS.map((option) => {
          const isSelected = selectedValue === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value === DEFAULT_BRANCH_COLOR.value ? null : option.value)}
              title={option.label}
              aria-label={`Use ${option.label}`}
              aria-pressed={isSelected}
              className={`focus-ring flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all active:scale-95 ${
                isSelected ? 'scale-110 border-text-primary shadow-md' : 'border-transparent hover:scale-105'
              }`}
              style={{ background: `linear-gradient(135deg, ${option.primary}, ${option.light})` }}
            >
              {isSelected ? <Check className="h-5 w-5 text-white drop-shadow" strokeWidth={3} /> : null}
            </button>
          );
        })}
      </div>
      <div className="mt-2 text-xs font-semibold text-text-muted">
        {BRANCH_COLORS.find((c) => c.value === selectedValue)?.label}
      </div>
    </div>
  );
};

export default BranchColorPicker;
