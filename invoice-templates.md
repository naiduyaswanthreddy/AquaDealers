# Invoice Templates & Billing Settings Plan

## Overview
The goal is to provide a rich, customizable billing experience. Customers want different invoice and statement templates to choose from based on their requirements. We will implement 5 distinct A4 templates, a settings interface to configure them, and ensure they render beautifully and interactively across both desktop and mobile devices.

## Project Type
WEB

## Success Criteria
- [ ] Users can navigate to Settings > Billing Templates (ONLY visible to Pro Plus dealers).
- [ ] Users can preview and select from at least 5 different A4 invoice templates.
- [ ] Users can toggle visibility of specific sections (logo, tax details, bank info, terms) on the templates.
- [ ] Statement templates are also available and selectable.
- [ ] In mobile view, the invoice is rendered in full A4 layout (not stacked responsively) and can be scaled/pinch-zoomed.
- [ ] Selected template preference is saved in the branch settings and applied whenever generating a bill or statement.

## Tech Stack
- **React/Tailwind CSS**: For designing the 5 distinct templates and the settings UI.
- **Zustand**: For storing the selected template and toggle preferences in `branchStore` or a new `settingsStore`.
- **CSS Transform/Scale**: To implement the pinch-to-zoom full A4 view on mobile devices without relying on heavy PDF libraries for the initial view.

## File Structure Updates
```
src/
├── features/
│   ├── settings/
│   │   └── pages/
│   │       └── BillingTemplatesPage.tsx        [NEW]
│   ├── billing/
│   │   ├── components/
│   │   │   ├── templates/                      [NEW]
│   │   │   │   ├── TemplateOne.tsx
│   │   │   │   ├── TemplateTwo.tsx
│   │   │   │   ├── TemplateThree.tsx
│   │   │   │   ├── TemplateFour.tsx
│   │   │   │   ├── TemplateFive.tsx
│   │   │   │   └── StatementTemplate.tsx
│   │   │   └── MobileZoomableContainer.tsx     [NEW]
```

## Task Breakdown

### Task 1: Store & Data Model Updates
- **Agent**: `frontend-specialist`
- **Description**: Add template preferences to the branch store or settings schema (e.g., `selectedInvoiceTemplate`, `showLogo`, `showBankDetails`, `showTax`).
- **INPUT**: Current `branchStore.ts`
- **OUTPUT**: Updated store to persist template choices.
- **VERIFY**: Changing a setting updates the store state.

### Task 2: Build the 5 A4 Invoice Templates
- **Agent**: `frontend-specialist`
- **Description**: Create 5 distinct React components for the templates, styling them precisely with Tailwind CSS to match standard A4 proportions (e.g., `aspect-[1/1.414]` or fixed dimensions with scaling). 
- **INPUT**: The user's 4 image references + 1 additional standard design.
- **OUTPUT**: 5 beautiful, pixel-perfect A4 template components that accept common props (invoice data, toggle states).
- **VERIFY**: Each template visually distinct and structurally sound.

### Task 3: Settings Page UI (Template Selector & Toggles)
- **Agent**: `frontend-specialist`
- **Description**: Create `BillingTemplatesPage.tsx` under Settings. Include a carousel or grid to select templates, a live preview pane, and toggle switches for customizable fields (tax, bank details, etc.). Ensure this settings page and the features are locked behind the "Pro Plus" subscription plan check.
- **INPUT**: The templates from Task 2 and the store from Task 1.
- **OUTPUT**: A fully functional settings page limited to Pro Plus.
- **VERIFY**: Changing a toggle instantly updates the live preview. Non-Pro Plus users cannot access it.

### Task 4: Statement Templates
- **Agent**: `frontend-specialist`
- **Description**: Apply the same pattern for account statements. Build a standard statement template and add it to the settings page.
- **INPUT**: Existing statement generation logic.
- **OUTPUT**: `StatementTemplate.tsx` integrated into settings.
- **VERIFY**: Statement preview works.

### Task 5: Mobile Zoomable View Integration
- **Agent**: `frontend-specialist`
- **Description**: Build a `MobileZoomableContainer` using CSS `transform: scale()` or standard mobile viewport meta tag overrides specifically for the invoice view modal, ensuring the A4 layout is preserved on mobile and allows pinch-to-zoom.
- **INPUT**: Existing billing view pages.
- **OUTPUT**: Mobile users see the full invoice, scaled down to fit width initially, but zoomable.
- **VERIFY**: Test on mobile view to ensure standard responsive stacking is bypassed for the physical invoice rendering.

## Phase X: Verification
- [ ] Templates strictly follow A4 aspect ratios.
- [ ] All toggles accurately reflect on the final rendered bill.
- [ ] No generic layouts used; designs must feel premium (adhering to project design rules).
- [ ] Mobile pinch-to-zoom is smooth and legible.
