# UI Enhancements & Reports Planner

## Overview
The user requested enhancements across multiple areas of the AquaDealer web application:
1. Fix a schema cache error related to `medicine_discount_percentage` on the `inventory` table.
2. Enhance the Reports Dashboard UI to include Daily Report, Monthly Report, Dues Ageing Report, GST Summary Report, and Stock Report.
3. Ensure all reports are functional and downloadable.
4. Enhance the Cashbook page UI for a cleaner, better-formatted look.
5. Enhance the Supplied (Purchases) page UI.
6. Display MRP and discount percentage for medicines on the Bill of Supply.

## Project Type
WEB

## Success Criteria
- The schema cache error for `medicine_discount_percentage` is resolved.
- Reports Dashboard shows the 5 required report cards and they can be exported/downloaded.
- Cashbook and Purchases pages feature a clean, premium, modern UI.
- Bill of Supply (Invoice) successfully shows MRP and discount % for medicine items.

## Tech Stack
- Frontend: React, Tailwind CSS, Lucide React (Icons), Vite
- Backend: Supabase (PostgreSQL)
- Schema Management: Supabase Migrations

## File Structure
- `src/features/reports/pages/ReportsPage.tsx`
- `src/features/reports/components/ReportCard.tsx`
- `src/features/financials/pages/CashBookPage.tsx`
- `src/features/suppliers/pages/NewPurchasePage.tsx`
- `src/features/billing/components/ReviewStep.tsx`

## Task Breakdown

### Task 1: Fix Inventory Schema Cache
- **Agent:** `database-architect`
- **Skill:** `database-design`
- **Priority:** P0
- **Dependencies:** None
- **INPUT:** Supabase schema migration `007_inventory_medicine_discount.sql`
- **OUTPUT:** Reloaded schema cache ensuring `medicine_discount_percentage` is recognized.
- **VERIFY:** App runs without throwing the schema cache error.

### Task 2: Enhance Reports Dashboard UI
- **Agent:** `frontend-specialist`
- **Skill:** `frontend-design`
- **Priority:** P2
- **Dependencies:** None
- **INPUT:** `ReportsPage.tsx`
- **OUTPUT:** A modern grid layout with cards for Daily Report, Monthly Report, Dues Ageing Report, GST Summary Report, and Stock Report.
- **VERIFY:** Dashboard matches the desired premium aesthetics.

### Task 3: Implement Report Downloads
- **Agent:** `frontend-specialist`
- **Skill:** `react-best-practices`
- **Priority:** P2
- **Dependencies:** Task 2
- **INPUT:** Report components
- **OUTPUT:** Export to CSV/PDF functionality for all reports.
- **VERIFY:** User can click a download button and receive a valid file.

### Task 4: Polish Cashbook Page UI
- **Agent:** `frontend-specialist`
- **Skill:** `frontend-design`
- **Priority:** P2
- **Dependencies:** None
- **INPUT:** `CashBookPage.tsx`
- **OUTPUT:** Redesigned cashbook layout with better formatting, modern tables/lists, and clear visual hierarchy.
- **VERIFY:** UI passes visual check and uses semantic colors for income/expense.

### Task 5: Polish Supplied (Purchases) Page UI
- **Agent:** `frontend-specialist`
- **Skill:** `frontend-design`
- **Priority:** P2
- **Dependencies:** None
- **INPUT:** `NewPurchasePage.tsx`, `SupplierLedgerPage.tsx`
- **OUTPUT:** Redesigned purchases layout matching the premium aesthetic.
- **VERIFY:** UI passes visual check.

### Task 6: Display MRP & Discount on Bill of Supply
- **Agent:** `frontend-specialist`
- **Skill:** `frontend-design`
- **Priority:** P2
- **Dependencies:** Task 1
- **INPUT:** `ReviewStep.tsx` / Invoice layout
- **OUTPUT:** Bill of Supply conditionally shows MRP and discount % for items classified as medicine.
- **VERIFY:** Generated bill includes the new columns.

## Phase X: Verification
- [ ] Run Lint & Type Check: `npm run lint && npx tsc --noEmit`
- [ ] Accessibility & UX check
- [ ] Socratic Gate was respected
- [ ] Review UI manually in the browser

## ✅ PHASE X COMPLETE
- Lint: ⏳ Pending
- Security: ⏳ Pending
- Build: ⏳ Pending
- Date: [TBD]
