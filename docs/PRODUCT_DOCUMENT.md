# AquaDealers Product Document

Reviewed from the current AquaDealers codebase on 2026-07-09.

## 1. Product Summary

AquaDealers is a mobile-first business management platform for aqua feed and aqua medicine dealers. It combines billing, farmer credit, stock lots, supplier purchases, cashbook, GST-ready reports, staff access, and admin subscription controls into one workflow-focused application.

The product is built for Indian aquaculture dealership operations where dealers need to create bills quickly, manage farmer dues safely, track feed and medicine stock accurately, reconcile counter cash, and produce usable records for business review, tax filing, and collections.

## 2. One-Line Positioning

AquaDealers is the complete billing, inventory, dues, cashbook, and reporting software built specifically for aqua feed and medicine dealers.

## 3. Target Users

### Primary Users

- Aqua feed dealers
- Aqua medicine dealers
- Combined feed and medicine shops
- Multi-branch aqua dealerships
- Dealers selling on cash, UPI, cheque, and farmer credit

### Secondary Users

- Shop staff who create bills, add farmers, or check stock
- Accountants who need sales, purchase, GST, cashbook, and profit reports
- Owners who need daily visibility into sales, collections, dues, stock, and cash
- Platform admins who manage dealer subscriptions, support, and master data

## 4. Core Business Problems Solved

1. Fast billing at the counter
2. Accurate farmer due tracking
3. Feed and medicine stock visibility
4. Supplier purchase and payable tracking
5. Medicine expiry and lot-level control
6. Cash, UPI, cheque, and credit separation
7. Daily counter cash reconciliation
8. GST-ready sales and purchase records
9. Staff access control with branch restrictions
10. Mobile-first workflows for real shop usage

## 5. Product Modules

### 5.1 Dashboard

The dashboard gives the owner a quick view of business health.

Key capabilities:

- Today's sales
- Today's collection
- Cash received, UPI received, and cheque received
- Credit given
- Pending dues snapshot
- Low stock alerts
- Expiring medicines
- Recent transactions
- Top sold products
- Sales trends
- Daily summary PDF
- Expiry report PDF

Usage:

1. Open the app after login.
2. Review today's sales, collections, and pending dues.
3. Use alert cards to act on low stock or expiring medicine.
4. Export or share daily summary reports when needed.

### 5.2 Billing

Billing is a three-step invoice flow: items, payment, and review.

Key capabilities:

- Create new bills from `/bills/new`
- Select registered farmers or walk-in customers
- Add feed and medicine products
- Use lot-aware stock selection
- Apply item discounts
- Enable GST billing where configured
- Support payment methods:
  - Cash
  - UPI
  - Credit
  - Other or cheque reference
- Capture partial payments
- Track balance due
- Generate bill/invoice PDFs
- Share invoices through browser sharing or WhatsApp-compatible flows
- Capture digital customer signatures when enabled
- Edit bills when plan/feature access allows it
- View bill audit history
- Create historical bills in bulk

Usage:

1. Go to Bills > New Bill.
2. Select a farmer or use a walk-in customer.
3. Add feed/medicine items and quantities.
4. Choose payment type and amount paid.
5. Review totals, GST, due amount, and signature if required.
6. Save and share the bill.

Business value:

- Counter staff can bill quickly.
- Owners get automatic inventory movement and farmer due updates.
- Credit bills have proof through signature capture.

### 5.3 Farmers and Farmer Ledger

The farmer module is designed around aqua customer credit relationships.

Key capabilities:

- Add and edit farmers
- Store phone, village, mandal, district, and address details
- Track pond acres and stocking date
- Estimate harvest date
- Track crop status:
  - Growing
  - Harvested
  - Partial harvest
  - Crop failed
  - Price distress
- Track risk status:
  - Reliable
  - Monitor
  - Risky
- Set credit limits
- Track opening balance and current due
- View farmer ledger
- Filter farmer transactions by date range
- Separate bills and payments
- Collect payments
- Generate balance statements
- Generate dues reports
- Track farmer-wise purchased items
- Configure farmer-specific product discounts when the feature is enabled

Usage:

1. Add farmer profile before issuing credit.
2. Set credit limit and farm details.
3. Create bills against that farmer.
4. Collect payments from farmer ledger.
5. Use balance statement or dues report for collection follow-up.

Business value:

- Reduces confusion around farmer balances.
- Gives owners a clear credit and risk view.
- Helps collection teams know who owes what and since when.

### 5.4 Inventory and Stock Control

Inventory tracks feed and medicine stock with lot-level detail.

Key capabilities:

- Product catalog management
- Feed and medicine distinction
- Current stock by product
- Lot-level tracking
- Purchase date-aware lot display
- Batch number tracking
- Expiry date tracking
- MRP, cost price, selling price, and discount tracking
- Low stock threshold
- Manual stock increase/reduction
- Stock movement history
- Daily stock diary
- Monthly stock analytics
- Available lots and expired lots
- Stock report PDF
- Product image support when enabled
- Rate adjustment workflows
- Delete/edit inventory records with guarded UI flows

Usage:

1. Add products to catalog.
2. Record purchases to add stock.
3. Use inventory detail to review stock, lots, history, and analytics.
4. Adjust stock manually only for corrections.
5. Use stock report for audit or review.

Business value:

- Stock is connected to billing and purchases.
- Medicine expiry risk is visible.
- Dealers can see current stock and movement history without manual ledgers.

### 5.5 Suppliers and Purchases

The supplier module tracks incoming stock and supplier balances.

Key capabilities:

- Add and manage suppliers
- Supplier ledger
- Record new purchase bills
- Add multiple purchase items
- Select purchase date
- Capture invoice number
- Capture batch and expiry details
- Store quantity, MRP, cost percentage, cost price, selling price, GST, and discounts
- Mark purchase as paid or unpaid
- Record partial supplier payments
- Record additional supplier charges
- Update inventory automatically
- Create inventory lots automatically
- Align lot purchase date with selected purchase date
- Prompt rate adjustments when purchase pricing changes
- View purchase detail page with linked lot snapshot

Usage:

1. Open Purchases > New Purchase.
2. Select supplier and purchase date.
3. Add purchased products and pricing details.
4. Mark paid/unpaid and record payment method.
5. Save the purchase.
6. Review supplier ledger and inventory lot updates.

Business value:

- Purchase entry becomes the source for inventory lots and supplier ledger.
- Selected purchase date remains consistent across purchase detail, stock lot view, stock history, and purchase reports.
- Owners can understand payables and stock cost clearly.

### 5.6 Cashbook and Daily Counter

Cashbook separates counter cash from UPI and other movements.

Key capabilities:

- Track cash inflows
- Track cash outflows
- Track UPI inflows separately
- Track shop expenses
- Add manual income and expense entries
- Monthly cashbook ledger
- Running balance
- Daily counter summary
- Expected closing cash
- Physical cash count
- Variance calculation
- Close day workflow

Usage:

1. Review daily counter summary.
2. Add manual money-in or money-out entries if needed.
3. Enter physical cash counted at day end.
4. Close the day and review variance.

Business value:

- Helps owners avoid mixing UPI, cheque, and cash.
- Makes daily counter mistakes visible.
- Creates a reliable audit trail for shop cash.

### 5.7 Expenses

Expenses track non-stock business costs.

Supported categories:

- Transport
- Rent
- Staff salary
- Electricity
- Vehicle
- Other

Key capabilities:

- Add expense entries
- Assign payment method/category
- Feed expense data into reports and cashbook
- Include expenses in profit and loss calculations

Usage:

1. Open Expenses.
2. Add operational expense with category and amount.
3. Review it in expense report, cashbook, and P&L.

### 5.8 Reports and Exports

AquaDealers includes operational, accounting, GST, and performance reports.

Main reports:

- Sales Report
- Purchase Report
- Stock Report
- Payment Report
- Customer Dues
- Profit and Loss
- GST Report
- Top Products

Monthly finance pack includes:

- Sales Register
- Purchase Register
- Expense Report
- Cash Book
- Bank Reconciliation worksheet
- GST Pack
- Profit and Loss
- Receivables Aging
- Payables Aging
- Top Products

GST-related exports:

- GSTR-1 outward supplies
- GSTR-2 inward supplies
- GSTR-3B summary route
- GSTR-4 composition summary
- GSTR-9 annual return guidance

Export formats:

- CSV
- Excel-compatible HTML
- PDF

Usage:

1. Open Reports.
2. Select month/year or custom date range.
3. Open a report card.
4. Export as CSV, Excel-compatible file, or PDF.

Business value:

- Reduces dependency on manual Excel ledgers.
- Gives accountant-ready datasets.
- Helps owners understand profit, GST, dues, and product performance.

### 5.9 GST Ledger

GST functionality supports tax-aware sales and purchase records.

Key capabilities:

- Enable GST billing in settings
- Generate sales and purchase GST data
- Track output GST
- Track input GST
- Calculate net GST payable
- Export GST-focused reports

Usage:

1. Enable GST billing in Settings.
2. Create GST-enabled bills and purchases.
3. Open GST page or reports.
4. Export summaries for accountant review.

### 5.10 Settings

Settings configure shop identity, billing behavior, language, and security.

Key capabilities:

- Dealer name
- Shop name
- Phone and email
- Address
- GSTIN
- App language
- Bill signature requirement
- GST billing enable/disable
- Farmer product discounts enable/disable where plan allows
- Authorized signatory signature
- PIN setup/change
- PIN timeout configuration
- Billing templates page

Supported languages in codebase:

- English
- Hindi
- Telugu

Usage:

1. Complete shop profile.
2. Enable GST if applicable.
3. Enable bill signatures if credit proof is required.
4. Set PIN and timeout for local app security.
5. Configure invoice templates.

### 5.11 Staff Management

Staff management allows owners to create limited staff access.

Key capabilities:

- Create staff members
- Assign staff PIN
- Reset staff PIN
- Activate/deactivate staff
- Share staff portal link
- Restrict staff by branch
- Configure feature access as:
  - Visible
  - Disabled
  - Hidden

Staff permission areas:

- Dashboard
- Bill history
- New bill
- Farmer list
- Add farmer
- Inventory
- Suppliers
- Cashbook
- Expenses
- Reports
- Settings
- Branches
- Staff management

Usage:

1. Open Staff.
2. Create staff profile with phone/name/PIN.
3. Choose branches.
4. Choose feature permissions.
5. Share the generated staff portal link.

Business value:

- Owners can allow counter billing without exposing sensitive reports/settings.
- Branch-specific access supports multi-location operations.

### 5.12 Staff Portal

The staff portal is reachable through a shop/branch-specific URL structure.

Key capabilities:

- Staff login by PIN
- Staff-specific navigation
- Restricted feature access
- Dedicated staff home route
- Branch-aware workflows

Usage:

1. Owner creates staff member.
2. Owner shares staff portal link.
3. Staff logs in using assigned PIN.
4. Staff sees only allowed modules.

### 5.13 Onboarding

Dealer onboarding is a guided setup flow.

Steps:

1. Shop details
2. Language selection
3. Product catalog setup
4. First farmer
5. PIN setup

Usage:

1. Register/login.
2. Complete each setup step.
3. Start using dashboard, billing, farmers, and inventory.

Business value:

- Reduces setup friction.
- Helps dealers reach first bill faster.
- Gives admins visibility into stuck onboarding.

### 5.14 Public Landing and Shop Pages

Public routes support marketing and shop discovery.

Public pages:

- Landing page
- Features page
- Pricing page
- Contact page
- SEO pages for aqua billing, medicine inventory, dealer management, and stock management
- Public shop profile route by shop slug

Marketing messages visible in codebase:

- Complete inventory and billing software for aqua feed and medicine dealers
- Create bills in seconds
- Track farmer dues safely
- Manage feed and medicine stock
- Reduce cash variance

### 5.15 Admin Portal

The admin portal is separate from the dealer app.

Admin modules:

- Admin login
- Platform dashboard
- Dealer list
- Dealer profile
- Subscription management
- Add-ons
- Product catalog
- Support
- Broadcast messages
- Analytics
- Settings
- Audit logs

Admin dashboard KPIs:

- Total dealers
- Active dealers
- Trial dealers
- Revenue metric
- New signups in 30 days
- Bills today
- Expiring subscriptions
- Stuck onboarding

Business value:

- Platform operators can manage customers, plans, support, and communication.
- Admins can identify onboarding issues and subscription risk.

## 6. Typical End-to-End Workflows

### Workflow A: First-Time Dealer Setup

1. Register account.
2. Complete shop details.
3. Select preferred language.
4. Add product catalog.
5. Add first farmer.
6. Set PIN.
7. Start billing.

### Workflow B: Daily Counter Billing

1. Open New Bill.
2. Select farmer or walk-in customer.
3. Add products and quantities.
4. Select cash, UPI, credit, or other payment.
5. Capture amount paid and references.
6. Review bill.
7. Save, print/share PDF, and optionally collect signature.
8. Inventory and dues update automatically.

### Workflow C: Purchase Stock From Supplier

1. Open New Purchase.
2. Select supplier and purchase date.
3. Enter invoice number.
4. Add products with quantity, batch, expiry, MRP, cost, GST, and selling price.
5. Mark paid or unpaid.
6. Save purchase.
7. Inventory lots and supplier ledger update automatically.

### Workflow D: Farmer Collection Follow-Up

1. Open Dues or Farmer List.
2. Filter farmers by due/risk/status.
3. Open farmer ledger.
4. Review bills and payments.
5. Collect payment.
6. Share balance statement if required.

### Workflow E: End-of-Day Closing

1. Open Dashboard and Cashbook.
2. Review sales, collection, credit, and expenses.
3. Enter physical counter cash.
4. Close day.
5. Review cash variance.
6. Export daily summary if needed.

### Workflow F: Monthly Accounting Review

1. Open Reports.
2. Select month/year or custom range.
3. Export sales register, purchase register, expense report, cashbook, GST pack, P&L, receivables, payables, and top products.
4. Share files with accountant or owner.

## 7. Unique Selling Propositions

### 7.1 Built Specifically for Aqua Dealers

Generic billing software does not understand farmer dues, pond cycles, feed/medicine categories, medicine expiry, supplier purchase lots, and credit-heavy aquaculture sales. AquaDealers is designed around these exact workflows.

### 7.2 Mobile-First Counter Experience

The app is optimized for shop counters and mobile usage, with bottom navigation, quick billing, large controls, and workflows built for repeated daily use.

### 7.3 Farmer Credit Ledger at the Center

The system treats farmer credit as a core workflow, not an afterthought. Every credit bill, payment, balance statement, risk status, and aging view helps the owner manage collections.

### 7.4 Purchase-to-Stock Automation

Supplier purchases automatically create inventory lots, update stock, connect to supplier ledgers, and preserve purchase dates for later review.

### 7.5 Lot and Expiry Awareness

Medicine lots, batch numbers, expiry dates, and FIFO-like lot selection reduce wastage and give owners clearer control over stock movement.

### 7.6 Cash, UPI, Cheque, and Credit Separation

The system separates physical cash from UPI and other payments, helping dealers understand what should actually be in the cash counter.

### 7.7 Signature Proof for Credit Bills

Digital customer signature capture gives dealers stronger proof for credit transactions and collections.

### 7.8 GST and Accountant-Friendly Reports

Sales, purchase, GST, cashbook, P&L, receivables, payables, and top product exports reduce manual report preparation.

### 7.9 Staff and Branch Controls

Owners can give staff only the access they need, with branch restrictions and feature visibility control.

### 7.10 Admin and Subscription Infrastructure

The product includes a platform-side admin portal for subscriptions, dealer management, support, audit logs, product catalog, analytics, and broadcasts.

## 8. Subscription and Feature Gating

The codebase supports plan-based features and limits.

Feature gates include:

- Core app access
- Expenses
- Cashbook
- Suppliers
- Export
- WhatsApp/share workflows
- GST
- Reports
- Voice
- Multi-language
- PDF
- Priority support
- App PIN
- Staff
- Signature proof
- Farmer photo
- Product image
- Custom templates
- Farmer product discounts
- Edit bills

Plan limits include:

- Branch limit
- Farmer limit
- Bill limit

Expired subscription behavior:

- New bill creation is blocked when subscription is expired.
- Limits can block invoice creation when the plan bill limit is reached.

## 9. Data and Operational Concepts

Important business entities:

- Dealer
- Branch
- Staff member
- Farmer
- Product
- Inventory item
- Inventory lot
- Inventory movement
- Bill
- Bill item
- Supplier
- Stock purchase
- Supplier payment
- Cashbook entry
- Expense
- Subscription
- Admin audit event

Important date concepts:

- Bill date: date of sale
- Purchase date: selected date of supplier purchase
- Lot received date: aligned to purchase date for stock purchase lots
- Cash entry date: date of cash movement
- Expiry date: product/medicine lot expiry

## 10. Technical Foundation

Frontend:

- React 18
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Lucide icons
- Framer Motion

State and data:

- Zustand
- TanStack Query
- Supabase JavaScript client
- Local/offline helpers

Backend/database:

- Supabase
- PostgreSQL
- SQL migrations
- RPC functions for billing, purchases, reports, inventory, dashboard, and admin operations

Reports and files:

- jsPDF
- xlsx
- HTML/CSV export helpers
- PDF report utilities

Progressive web app features:

- Service worker
- Reload/update prompt
- Version checking
- Offline queue utilities

Observability and analytics:

- Sentry
- PostHog

## 11. Security and Access

Security features visible in the codebase:

- Protected routes
- PIN lock overlay
- PIN timeout
- Staff PIN login
- Staff feature permissions
- Staff branch restrictions
- Admin login/session handling
- Subscription gates
- Feature gates
- Supabase row-level access patterns through dealer IDs and branch IDs
- Admin audit log module

## 12. Product Strengths

- Strong domain fit for aqua feed and medicine shops
- Complete daily workflow coverage
- Mobile-first UI
- Farmer credit and dues focus
- Purchase, inventory, and supplier ledger integration
- Reports suitable for business owners and accountants
- Staff access control
- Admin portal for SaaS operations
- Supports English, Hindi, and Telugu
- Built as a modern web/PWA app

## 13. Suggested Product Messaging

### Short Pitch

AquaDealers helps aqua feed and medicine dealers run billing, stock, farmer dues, supplier purchases, cashbook, and reports from one mobile-first app.

### Sales Pitch

Most aqua dealers still manage bills, farmer credit, stock, supplier purchases, and cash collections across notebooks, WhatsApp, Excel, and memory. AquaDealers brings all of this into one simple workflow. Create bills in seconds, track farmer dues safely, know exactly what stock is available, reconcile cash at day end, and export reports for your accountant.

### Website Hero Copy

Complete billing, stock, dues, cashbook, and GST reports for aqua feed and medicine dealers.

### Owner-Focused Message

Know today's sales, collections, credit, stock, dues, and cash variance without calling your staff or checking multiple registers.

### Accountant-Focused Message

Export sales, purchase, cashbook, GST, receivables, payables, and profit reports from one place.

### Staff-Focused Message

Give staff a simple billing portal with only the access they need.

## 14. Demo Script

1. Show dashboard with today's sales, collection, dues, low stock, and expiring medicines.
2. Create a farmer profile with credit limit and pond details.
3. Create a bill for that farmer.
4. Select products, payment type, and partial amount.
5. Save bill and show due update.
6. Open farmer ledger and collect payment.
7. Record supplier purchase and show stock lot update.
8. Open inventory detail and show lots/history/analytics.
9. Open cashbook and close the day.
10. Open reports and export sales, purchase, P&L, GST, and dues.
11. Show staff management permissions.
12. Show admin portal overview for platform operations.

## 15. Competitive Advantages

Compared with generic billing apps:

- Aqua-specific farmer and pond context
- Feed/medicine inventory workflows
- Supplier-to-lot stock flow
- Medicine expiry alerts
- Farmer credit ledger and dues reports
- Mobile-first shop counter UI

Compared with Excel/manual ledgers:

- Automatic dues calculation
- Automatic inventory movement
- Safer cashbook reconciliation
- Faster reports
- Less duplicate entry
- Better owner visibility

Compared with accounting-only tools:

- Built for daily shop operations, not only bookkeeping
- Billing, stock, farmer, supplier, and staff workflows in one place
- Practical mobile usage for non-accountant staff

## 16. Future Product Opportunities

These are logical extensions based on the existing architecture:

- Automated WhatsApp payment reminders
- Barcode/QR stock scanning
- Supplier invoice image capture and OCR
- Advanced branch-level profitability
- Dealer-to-farmer app or customer portal
- Smart reorder suggestions
- Low stock auto-purchase planning
- Demand forecasting by season and crop stage
- More GST return automation
- Bank statement import for reconciliation
- Offline-first bill creation with automatic sync
- Role templates for common staff types

## 17. Current Product Readiness Notes

The codebase already includes:

- Dealer app routes
- Admin portal routes
- Onboarding
- Billing
- Farmer ledgers
- Inventory lots
- Supplier purchases
- Cashbook
- Expenses
- Reports
- GST routes
- Staff management
- Settings
- Public marketing pages
- PDF/export utilities
- Subscription and feature gates

Recommended ongoing maintenance:

- Keep README and this document aligned after major feature changes.
- Keep migrations deployed in order.
- Validate report calculations after schema changes.
- Test billing, purchase, and cashbook workflows after every release.
- Keep plan definitions synchronized with UI feature gates.

