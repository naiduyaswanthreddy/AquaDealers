# Farmer Page UI Update (Ledger Dashboard)

## Overview
Update the farmer page UI to match the provided layout showing the farmer's ledger, bills, payments, and account summary. The design should be clean, modern, and optimize for mobile-first viewing, leveraging the provided reference screenshot.

## Project Type
WEB

## Success Criteria
- The farmer page exactly matches the provided layout (Header card with risk badge, summary row, tabs, transaction list, and footer summary).
- Transactions and balances are displayed with correct colors (red for due amounts, green for payments/positive balances).
- The tabs (Ledger, Bills, Payments, Details) are implemented and functional.
- The UI is responsive and looks perfect on both mobile and desktop.

## Tech Stack
- React/Next.js (assuming existing stack)
- Tailwind CSS (for layout and styling)
- Lucide React / Heroicons (for SVG icons, if any)

## File Structure
- `src/components/farmer/FarmerHeaderCard.tsx`
- `src/components/farmer/FarmerSummaryRow.tsx`
- `src/components/farmer/FarmerTabs.tsx`
- `src/components/farmer/FarmerLedgerList.tsx`
- `src/components/farmer/FarmerFooterSummary.tsx`
- `src/pages/farmer/[id].tsx` (or equivalent route depending on Next.js/Vite)

## Task Breakdown

1.  **Task 1: Farmer Header Card Component**
    - **Agent**: `frontend-specialist`
    - **Skills**: `frontend-design`, `tailwind-patterns`
    - **INPUT**: Farmer details (Name, Pond, Risk Status).
    - **OUTPUT**: A green card component with Avatar, Name, Pond, and Risk Badge.
    - **VERIFY**: Component renders correctly with the `#10B981` green background and white text.

2.  **Task 2: Account Summary Row Component**
    - **Agent**: `frontend-specialist`
    - **Skills**: `frontend-design`, `tailwind-patterns`
    - **INPUT**: Total Due, Credit Limit, Available Balance.
    - **OUTPUT**: A row with three columns displaying the balances with correct typography and colors.
    - **VERIFY**: Total due amount is styled in red (`#DC2626`).

3.  **Task 3: Tabs Component**
    - **Agent**: `frontend-specialist`
    - **Skills**: `react-best-practices`
    - **INPUT**: Active tab state and list of tabs.
    - **OUTPUT**: A tab navigation bar with a blue active indicator (`border-b-2 border-blue-600`).
    - **VERIFY**: Clicking tabs changes the active state visually.

4.  **Task 4: Ledger List Component**
    - **Agent**: `frontend-specialist`
    - **Skills**: `react-best-practices`
    - **INPUT**: List of transactions (bills, payments).
    - **OUTPUT**: A list grouped by month, displaying date, title, details, and amount.
    - **VERIFY**: Payments display in green, bills display with strikethrough/gray or default colors as needed.

5.  **Task 5: Footer Summary Component**
    - **Agent**: `frontend-specialist`
    - **Skills**: `frontend-design`
    - **INPUT**: Opening Balance, Total Debit, Total Credit, Current Due.
    - **OUTPUT**: A clean summary block at the bottom of the list.
    - **VERIFY**: Current Due is highlighted in red.

6.  **Task 6: Page Integration**
    - **Agent**: `frontend-specialist`
    - **Skills**: `app-builder`
    - **INPUT**: All created components.
    - **OUTPUT**: The integrated farmer page.
    - **VERIFY**: The whole page looks exactly like the design reference on mobile and desktop breakpoints.

## Open Questions for User
> [!IMPORTANT]
> - Are the values (Total Due, Ledger history) coming from a specific API endpoint that is already built, or should we use mock data for now?
> - Do you want smooth animations when switching between the Tabs (Ledger, Bills, Payments)?
> - Should we implement the other tabs (Bills, Payments, Details) immediately, or just focus on the 'Ledger' tab as shown in the screenshot for now?

## ✅ PHASE X Verification (To be completed after execution)
- [ ] Lint: Pass
- [ ] Security: No critical issues
- [ ] Build: Success
