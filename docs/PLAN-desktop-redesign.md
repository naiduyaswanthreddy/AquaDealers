# PLAN-desktop-redesign

## Goal Description
Completely redesign the desktop layout of all pages to match the new reference design, while strictly ensuring the mobile layout remains exactly as it is without any changes.

## User Review Required
> [!IMPORTANT]
> The redesign introduces a new layout structure (sidebar on the left, main content area on the right). We need to confirm if this sidebar layout should replace the current top navigation (`DesktopNav.tsx`) or exist alongside it. The image provided shows a full-height sidebar. 
> Please confirm if this is correct.

## Open Questions
> [!WARNING]
> 1. Should the new desktop sidebar replace the existing `DesktopNav` entirely, or do we still need a top bar for certain actions (like branch switching, which is currently in `DesktopNav`)?
> 2. For the charts (like "Sales Trend"), is there a preferred charting library we should use (e.g., Recharts, Chart.js), or should we build a custom CSS/SVG representation as currently done in the app?

## Proposed Changes

### Layout Components
#### [MODIFY] AppLayout.tsx
- Update the layout wrapper to support a flexbox structure on desktop (`lg:flex`) to accommodate the new sidebar alongside the main content.
- Ensure all mobile-specific layout logic (e.g., `BottomNav`) remains untouched and only targets screens smaller than `lg`.

#### [NEW] DesktopSidebar.tsx
- Create a new sidebar component for the desktop view, rendering the navigation links (Dashboard, Inventory, Billing, Customers, Dues, Reports, Expenses, Settings).
- Will be hidden on mobile screens (`hidden lg:flex`).

#### [MODIFY] DesktopNav.tsx (Optional)
- Depending on the answer to Open Question 1, this may be deleted or repurposed into a top header for the main content area (e.g., for profile / branch selection).

---

### Page Components
#### [MODIFY] DashboardPage.tsx
- Restructure the desktop view to a grid layout (`lg:grid lg:grid-cols-12`) based on the reference image.
- Create specific card components for "Inventory Items", "Today's Sales", "Pending Dues", "Active Customers".
- Create the "Recent Bills", "Sales Trend", and "Top Products" sections specifically scoped for desktop using Tailwind's `lg:` breakpoint, leaving the mobile layout unaltered.

#### [MODIFY] Other Pages (Inventory, Billing, etc.)
- Wrap their main content containers with constraints or layout adjustments that align them with the new desktop sidebar layout, strictly utilizing `lg:` prefixed Tailwind utilities to avoid mobile interference.

## Verification Plan

### Automated Tests
- Run `npm run typecheck` and `npm run lint` to ensure no errors were introduced.
- Run UI component tests (if any exist) to ensure the mobile layout tests still pass.

### Manual Verification
- Resize the browser window to mobile width (<1024px) to verify that the `BottomNav` and mobile layouts appear and function exactly as they did before.
- Resize to desktop width (>=1024px) to verify the new sidebar and redesigned dashboard appear as per the reference image.
