# Design System Page Overrides: Farmers Module

This document defines the page-specific design standards for the Farmers module, overriding global conventions in `MASTER.md` where appropriate.

## Style & Aesthetics: Tactical Materialism
The Farmers list page relies on a tactile, highly spatial design system characterized by dimensional layering, high-radius geometries, and active micro-animations.

### Color Tokens
- **Reliable Risk**: `#10B981` (Emerald Green)
- **Monitor Risk**: `#F59E0B` (Amber Yellow/Orange)
- **Risky Risk**: `#EF4444` (Vibrant Red)
- **Overdue Amounts**: `#E11D48` (Vibrant Rose Red)
- **Card Background**: Gradient from `#FFFFFF` (White) to `#F8FAFC` (Slate 50) at `30%` opacity.

### Typography & Sizes
- **Farmer Name**: `font-extrabold text-[1.05rem] text-slate-900 leading-snug`
- **Subtext Details**: `font-semibold text-xs text-slate-400`
- **Due Amount**: `font-black text-[1.05rem] text-rose-600`
- **Overdue Subtitle**: `font-semibold text-xs text-slate-400`

### Interactive Properties & Animations
- **Base State**: `rounded-[28px] px-6 py-4 shadow-sm border border-slate-100/90`
- **Hover State**: `-translate-y-0.5 shadow-md border-slate-200/50 bg-gradient-to-b from-slate-50/50 to-slate-100/30`
- **Active State**: `scale-[0.98] translate-y-0 shadow-sm`
- **Micro-interactions**: Breathing/pulse ring around the risk status dot for `Monitor` and `Risky` statuses.
- **Transitions**: `transition-all duration-300 ease-out` for all dimensional properties.
