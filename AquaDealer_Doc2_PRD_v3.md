=================================================================
AQUADEALER — PRODUCT REQUIREMENTS DOCUMENT (PRD) v3.0
=================================================================

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. PRODUCT OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Product:      AquaDealer
Type:         Web SaaS, mobile-first, browser-only (PWA)
Target users: Aqua feed & medicine dealers — AP, Telangana,
              Odisha, West Bengal
Core promise: Replace the physical register. Simpler than
              KhataBook for daily use. More useful than Tally
              for this specific business. First tool that
              actually understands aqua dealer workflows.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. THE REAL PROBLEM (field-validated)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

From actual dealer field research:

Problem                   | Real Impact
--------------------------|------------------------------------------
Physical registers        | Data lost, damaged, unsearchable
Manual karza tracking     | Forgotten dues = lost money every month
No receipts               | Farmer disputes, no proof
No stock visibility       | Stock-outs, expired medicines, dead cash
Generic apps don't fit    | Wrong vocabulary, wrong workflow
Tally too complex         | Needs trained accountant, dealer can't use
Multi-shop, no visibility | Can't see what's happening at branch 2
GST confusion             | Medicines attract GST, feed doesn't
                          | Dealers don't know what to charge/claim

Key research finding: Credit recovery (28%) and stock
management (39%) are the two biggest risks in aqua
dealership business. No existing tool addresses these
specifically for aqua dealers.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. GST REALITY FOR AQUA DEALERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is critical to get right. Most apps get it wrong.

AQUA FEED (all types — shrimp, prawn, fish):
  HSN Code: 2309
  GST Rate: 0% (EXEMPT)
  Reason: Government exempts all animal/aqua feed from GST

AQUA MEDICINES:
  Generic/unbranded (e.g. Ciprofloxacin):
    HSN: 3004
    GST: 5%
  Branded medicines (e.g. specific branded antibiotics):
    HSN: 3004
    GST: 12%
  Probiotics and pond care products:
    HSN: 3002
    GST: 12%

IMPLICATIONS FOR DEALERS:
  - Most dealers sell both 0% and 5%/12% items
  - Input tax credit available on medicine purchases
  - Net GST payable = GST collected on medicine sales
    minus GST paid on medicine purchases
  - Feed sales never generate GST liability
  - Dealer needs a clean monthly summary to give their CA

IMPLEMENTATION:
  - GST toggle in settings (OFF by default)
  - When OFF: completely hidden, simple bills
  - When ON: full CGST/SGST breakdown, GST report
  - Products pre-loaded with correct HSN + GST rates
  - Feed = 0%, generic medicine = 5%, branded = 12%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. GOALS & SUCCESS METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Metric                          | Target (Month 6)
--------------------------------|------------------
Paying dealers                  | 100+
Trial-to-paid conversion        | ≥ 40%
Day-30 retention                | ≥ 70%
Bills per dealer per month      | ≥ 50
Time to create one bill         | < 60 seconds
NPS score                       | ≥ 50
Support tickets per dealer/month| < 0.5
Multi-branch dealers            | ≥ 20% of base
GST-enabled dealers             | ≥ 15% of base

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. USER PERSONAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PERSONA 1 — Ravi Babu, Feed & Medicine Dealer
  42 years old | Narasapur, West Godavari
  200+ farmers | Physical register + phone calls
  WhatsApp comfortable | Basic Android | Telugu speaking
  Pain: 2 hrs/day manual bookkeeping, forgotten dues
  Need: know who owes what, manage stock, simple bill

PERSONA 2 — Lakshmi, Medicine-heavy Dealer
  35 years old | Bhimavaram, AP
  Lost ₹12,000 on expired medicines last year
  GST-registered dealer, needs proper bills for CA
  Pain: expiry tracking, GST confusion, no receipts
  Need: expiry alerts, correct GST bills, statement PDF

PERSONA 3 — Suresh, Multi-branch Dealer
  48 years old | 2 shops (Tanuku + Narsapur)
  Cannot see what Branch 2 is doing without visiting
  Pain: stock discrepancies, can't track both shops
  Need: combined dashboard, per-branch visibility

PERSONA 4 — Admin (AquaDealer team)
  Manages all dealer accounts
  Need: platform health, revenue, stuck dealers, catalog

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. FEATURE LIST — EVALUATED & FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EVALUATION CRITERIA applied to every feature:
  Does dealer use this daily or weekly? → Keep
  Does it solve a real money problem? → Keep
  Is it simple enough in 30 seconds? → Keep
  Complex without clear daily benefit? → Remove
  Nice to have but not needed? → Remove

MODULE | FEATURE                           | STATUS | WHY
-------|-----------------------------------|--------|------------------------
Dashboard | Today's stats (4 cards)       | ✅ Keep | Used every morning
Dashboard | Collect Today smart list      | ✅ Keep | Saves money daily
Dashboard | Low stock + expiry cards      | ✅ Keep | Prevents problems
Dashboard | Branch switcher               | ✅ Keep | Multi-branch essential
Farmers  | List, search, voice           | ✅ Keep | 50x/day usage
Farmers  | Karza ledger + ageing         | ✅ Keep | Core value
Farmers  | Crop status + harvest est     | ✅ Keep | Know when to collect
Farmers  | Risk dot 🟢🟡🔴               | ✅ Keep | Simple, powerful
Farmers  | Credit limit + warning        | ✅ Keep | Prevents bad debt
Farmers  | Statement PDF                 | ✅ Keep | Ends disputes
Billing  | 3-step bill                   | ✅ Keep | Core job
Billing  | Cash/UPI/Credit/Partial/Cheque| ✅ Keep | All payment types
Billing  | Non-GST mode (simple)         | ✅ Keep | Default for most
Billing  | GST mode (toggle)             | ✅ Keep | For registered dealers
Billing  | CGST/SGST calculation         | ✅ Keep | Legally required
Billing  | 80mm thermal print            | ✅ Keep | Farmers need receipts
Billing  | WhatsApp bill share           | ✅ Keep | Faster than print
Stock    | Feed bag inventory            | ✅ Keep | Daily check
Stock    | Medicine with expiry          | ✅ Keep | Saves ₹thousands
Stock    | Stock purchase recording      | ✅ Keep | Tracks cost price
Dues     | Ageing tabs (30/60/90)        | ✅ Keep | Weekly review
Dues     | Bulk WhatsApp reminder        | ✅ Keep | Recover money
Expenses | Simple 5-tap entry            | ✅ Keep | Track outflows
CashBook | Daily cash register           | ✅ Keep | Replaces diary
Suppliers| Simple balance + payment      | ✅ Keep | Track what owed
Reports  | Daily report                  | ✅ Keep | End of day
Reports  | Monthly + profit estimate     | ✅ Keep | Monthly review
Reports  | Dues ageing PDF               | ✅ Keep | Bank loan use
Reports  | GST summary                   | ✅ Keep | CA gets this monthly
Branches | Multi-branch dashboard        | ✅ Keep | Many dealers need this
Branches | Staff logins (view+bill only) | ✅ Keep | Branch management
Settings | Language switch               | ✅ Keep | Core usability
Settings | Thermal printer setup         | ✅ Keep | Print setup
Settings | PIN lock                      | ✅ Keep | Security
Settings | Data export Excel             | ✅ Keep | Data ownership
Offline  | Full PWA offline mode         | ✅ Keep | Rural internet poor
Voice    | Search all main screens       | ✅ Keep | Hands-busy counter
Onboard  | 5-step wizard                 | ✅ Keep | Zero training
-------|-----------------------------------|--------|------------------------
        | GST auto-filing GSTR-1/2/3     | ❌ Remove | CA does this
        | Estimate/quotation bills        | ❌ Remove | Not aqua workflow
        | Delivery challan                | ❌ Remove | Not aqua workflow
        | Barcode scanning                | ❌ Remove | No barcodes in aqua
        | Demand forecasting              | ❌ Remove | Too complex for v1
        | Pond-size billing warnings      | ❌ Remove | Dealer knows farmers
        | Company analytics               | ❌ Remove | Not daily need
        | IVR call reminders              | ❌ Remove | WhatsApp sufficient
        | Bank reconciliation             | ❌ Remove | Too complex
        | Payroll                         | ❌ Remove | Not needed
        | Feed consumption intelligence   | ❌ Remove | Too complex to maintain
        | QR code farmer portal           | ❌ Remove | Farmers won't use

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. FEATURE SPECIFICATIONS — SELECTED KEY SPECS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GST BILLING FLOW:
  Non-GST dealer (default):
    Bill shows: Product | Qty | Rate | Total
    No GST mentioned anywhere
    Clean, simple

  GST dealer (toggle ON):
    Bill shows: Product | Qty | Rate | GST% | GST Amt | Total
    Footer shows:
      Subtotal:    ₹10,000
      CGST @2.5%:     ₹125  ← for 5% items: CGST = 2.5%
      SGST @2.5%:     ₹125  ← for 5% items: SGST = 2.5%
      CGST @6%:       ₹600  ← for 12% items: CGST = 6%
      SGST @6%:       ₹600  ← for 12% items: SGST = 6%
      TOTAL:       ₹11,450
    Feed bags always show ₹0 GST (0% exempt)
    Each saved bill updates gst_ledger for that month

  GST Report output:
    Output Tax (collected from farmers on medicine sales)
    Input Tax Credit (paid when buying medicines from supplier)
    Net payable = Output - Input
    HSN-wise breakdown table
    Note: "Give this to your CA for GSTR-3B filing"

MULTI-BRANCH FLOW:
  After login: if dealer has multiple branches, show
  branch picker on first load
  Branch context persists per session
  "All Branches" mode: combined dashboard numbers
  Per-branch mode: all data filtered to that branch
  Switching branch: instant, no re-login

COLLECT TODAY LOGIC:
  Farmer appears in "Collect Today" if ANY of:
    crop_status = 'harvested' AND total_due > 0
    OR total_due > 0 AND oldest bill > 60 days
    OR total_due > credit_limit
  Shows max 5 farmers, sorted by urgency
  Each shows: name, due amount, reason (harvested/60 days/over limit)
  One tap → WhatsApp with pre-filled message

FARMER STATEMENT PDF:
  Full account history for one farmer
  Header: dealer shop name, farmer name, date range
  Table: Date | Bill # | Debit | Credit | Balance
  Footer: Total Due as of today
  Professional, dispute-proof
  Shareable directly on WhatsApp

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. NON-FUNCTIONAL REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Requirement                    | Target
-------------------------------|---------------------------
Page load on 3G                | < 2 seconds
Time to create bill            | < 60 seconds
Offline sync on reconnect      | < 5 seconds
Works on Android 8+ Chrome     | Yes
Works on 2GB RAM phone         | Yes
Data encrypted at rest         | AES-256 (Supabase)
HTTPS only                     | Yes
RLS — no cross-dealer leakage  | 100% enforced at DB level
Uptime                         | 99.5%
GST calculation accuracy       | 100% — no rounding errors

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. BUILD PHASES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phase | Scope                                       | Week
------|---------------------------------------------|------
1     | Supabase schema, RLS, seed catalog           | 1
      | (HSN codes + GST rates pre-loaded)           |
2     | Auth (OTP + PIN) + registration              | 1–2
3     | Onboarding wizard + branch setup             | 2
4     | Dashboard (branch switcher) + Farmer + Ledger| 2–3
5     | Billing — non-GST complete                   | 3–4
6     | Billing — GST mode + gst_ledger updates      | 4–5
7     | Stock + medicine + supplier + cashbook +     | 5–6
      | expenses                                     |
8     | Reports (daily, monthly, dues, GST summary)  | 6–7
      | + PDF + 80mm print + WhatsApp                |
9     | i18n (3 languages) + voice + offline PWA     | 7–8
10    | Multi-branch (staff logins) + Admin portal   | 8–10

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. 22 PRE-LAUNCH TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 1. Dealer registers with phone OTP
 2. Onboarding 5 steps, all recorded in DB
 3. Language switch live without re-login
 4. Voice search finds farmer (all 3 languages)
 5. Non-GST bill: 5 items + partial → correct balance
 6. Bill deducts inventory correctly
 7. GST bill: CGST + SGST per line calculated correctly
 8. GST bill: gst_ledger output totals update correctly
 9. Stock purchase with GST: input tax credit recorded
10. GST report: net payable = output - input (verified)
11. Low stock alert on dashboard
12. Medicine expiry alert < 30 days
13. WhatsApp reminder correct name + amount + tone
14. 80mm thermal print correct (real printer, real test)
15. Bill PDF correct with GST breakdown
16. Daily + monthly reports correct totals
17. Expense entry → cash book auto-updated
18. Supplier credit → supplier balance updated
19. Branch switch → all data changes to that branch
20. Offline: bill → reconnect → saved and synced
21. Admin impersonate: write attempts blocked
22. Dealer A cannot read Dealer B data (SQL test)

=================================================================
END OF PRD v3.0
=================================================================
