# AquaDealers

AquaDealers is a mobile-first dealer management app for aqua feed and medicine shops. It helps dealers create bills quickly, track farmer credit, manage stock movement, understand daily cash/UPI collections, and keep legally useful proof such as customer signatures on credit bills.

## The 15-Module Architecture

The application is logically divided into 15 distinct modules to handle every aspect of the aqua feed dealership:

### 1. Daily Billing
- **New Invoice**: Creates bills in three steps: `Items`, `Payment`, and `Review`.
- **Customer Selection**: Walk-in customers and registered farmers.
- **Product Selection**: Optimized for mobile with feed and medicine category cards.
- **Payment Step**: Handles Cash, UPI, Cheque, Credit, and partial payments.
- **Invoice Type**: `Tax Invoice` (with GST) or `Bill of Supply` (without GST).
- **PDF Generation**: Receipts and invoices are generated natively using jsPDF and shared via WhatsApp/Web Share API.

### 2. Credit and Farmer Ledger
- Track farmer credit limits, running balances, and statement history.
- **Balance Statement PDF**: Generate and share complete farmer account statements with opening and closing balances.
- **Ledger UI**: See all historical bills and payments for a farmer.

### 3. Inventory and Stock Control
- Manage feed and medicine separately.
- Real-time stock alerts and lot breakdown.
- Support for low-stock thresholds and manual stock adjustments.
- **Daily Stock Diary**: View movement (in, out, adjustments) for any specific day.

### 4. Stock Ledger Report
- Comprehensive date-range based reports on stock movement.
- View exact allocations: See which farmers bought which stock and in what quantities.
- Export as PDF or share directly.

### 5. Supplier and Purchase Ledger
- Track incoming stock purchases and supplier invoices.
- Record payments made to suppliers and track supplier balances.
- View ledger of purchases for specific suppliers.

### 6. Cashbook and Daily Counter
- Track cash, UPI, and cheque inflows and outflows.
- Calculate expected physical cash in the counter vs. actual counted cash.
- **Close Day**: End of day reconciliation with variance tracking.

### 7. Financials and Expenses
- Track operational expenses (rent, salaries, transport).
- Expenses impact the daily cashbook automatically.

### 8. Outstanding Dues Management
- Centralized view of all farmers with pending balances.
- **Dues Report PDF**: Generate an aggregate report of all outstanding dues for collections.

### 9. Dashboard and Analytics
- Real-time snapshots of Today's Sales, Collections, and Credit.
- Quick alerts for Expiring Medicines and Low Stock.
- **Daily Summary**: Auto-generate a PDF summarizing the day's financial activity.

### 10. Expiry Alerts
- Proactive tracking of medicine lots by expiration date.
- Visual alerts and **Expiry Report PDF** generation.

### 11. Customer Signature Proof
- Digital signatures captured directly on the device for credit bills.
- Stored as compact stroke JSON for low storage overhead.

### 12. Settings and Profile
- Manage GST rules, signature requirements, and shop branding.

### 13. Staff and Security
- Role-based staff access control.
- Global PIN lock overlay for quick security.
- Staff-specific portals and feature gating.

### 14. Admin Portal
- Super-admin view for managing dealers, subscriptions, and system-wide configurations.
- Audit logs, broadcast messaging, and master product catalogs.

### 15. Reports and Exports (PDF Suite)
All major views provide PDF export and Web Share capabilities:
- Bill Invoices
- Farmer Balance Statements
- Dues Overview
- Stock Movement Ledger
- Daily Summary
- Expiry Alerts

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand, TanStack Query
- **Backend & DB**: Supabase (PostgreSQL, RPCs, Edge Functions)
- **Routing**: React Router
- **PDF Generation**: jsPDF

## Local Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Create `.env` from `.env.example`:
```bash
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 3. Run the app
```bash
npm run dev
```

### 4. Type-check
```bash
npx tsc --noEmit
```

### 5. Build
```bash
npm run build
```

### 6. Tests
```bash
npm test
```
If Vitest fails before starting because of Node runtime features, update Node to a newer LTS version.

## Development Notes

- **PDF Sharing**: Avoid `html2canvas` for native PDF generation. Always use `jsPDF` for reliable vector text rendering, and `navigator.share` (or fallbacks) for WhatsApp sharing.
- **State Flow**: User context (`useAuthStore`) and active branch (`useBranchStore`) should always be respected for multi-branch dealers.
- **Mobile First**: Keep UI components thumb-friendly, avoid wide un-scrollable tables.
- **Cash vs UPI**: Treat UPI inflows separately from the physical cash counter balance.
