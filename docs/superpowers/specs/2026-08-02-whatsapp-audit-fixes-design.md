# WhatsApp Sharing Audit & Fixes — Design Spec

**Date:** 2026-08-02  
**Scope:** Fix existing WhatsApp flows only. No new features.

---

## Background

A full audit of all WhatsApp usage in the codebase found that the core
infrastructure (`whatsAppService.ts`, `whatsAppMessages.ts`) is solid. Four
targeted defects need fixing.

---

## Defect 1 — Duplicate invoice-image share logic

**Files:** `BillDetailsPage.tsx`, `CheckoutSuccessModal.tsx`

Both components contain identical ~50-line `handleShareWhatsApp` functions that:
1. Capture the invoice template DOM element as a PNG via `html-to-image`
2. On mobile: share via Web Share API
3. On desktop: copy image to clipboard, open the farmer's WhatsApp chat

This is the right UX (images show inline in WhatsApp; PDFs require a download
step). The problem is pure duplication — two copies of the same logic means
future changes must be made twice and bugs diverge silently.

**Fix:** Add `shareInvoiceImageViaWhatsApp(bill, dealer, elementId, phone)` to
`src/lib/billPdfGenerator.ts`. Both components call this one function.

**Signature:**
```ts
export const shareInvoiceImageViaWhatsApp = async (
  bill: any,
  dealer: Dealer | null,
  elementId: string,
  phone?: string | null
): Promise<void>
```

**Behaviour (unchanged from current):**
- Temporarily widens the element to 794 px, captures PNG at 2× pixel ratio, restores styles
- Mobile (`/Android|iPhone|iPad/.test(navigator.userAgent)` + `canShare`): `navigator.share({ files: [imageFile], text: message })`
- Desktop: `navigator.clipboard.write([ClipboardItem])` + `window.open(waUrl)`
- Throws on error so the caller can show a toast

---

## Defect 2 — Inline message instead of template

**Files:** `BillDetailsPage.tsx`, `CheckoutSuccessModal.tsx`

Both build the WhatsApp message inline with `[...].join('\n')`. The canonical
template already exists in `src/lib/whatsAppMessages.ts` as `invoiceMessage()`.

The inline messages differ from the template in wording (`Namaste` vs `Hello`,
`-- *shop*` vs `— *shop*`).

**Fix:** Inside `shareInvoiceImageViaWhatsApp`, call `invoiceMessage()` to build
the message. Inline construction in both components is removed entirely when
they switch to the shared function.

---

## Defect 3 — Dead import in CheckoutSuccessModal

**File:** `src/features/billing/components/CheckoutSuccessModal.tsx`

`shareBillPdfViaWhatsApp` is imported but never called. The component uses the
image approach instead.

**Fix:** Remove the import.

---

## Defect 4 — Confusing toast for report sharing without a phone

**File:** `src/lib/whatsAppService.ts` → `sharePdfViaWhatsApp`

Report PDFs (daily summary, expiry, dues, stock, balance statement) call
`sharePdfViaWhatsApp` without a phone number. WhatsApp opens to a blank search
screen. The current toast says:

> "PDF saved! Attach it in the WhatsApp chat that just opened."

This is misleading — there is no specific chat open, only WhatsApp's home
screen.

**Fix:** Make the toast phone-aware:
- When `phone` is provided and valid → keep current message (a specific chat is open)
- When `phone` is absent → "PDF downloaded. Open WhatsApp, find your contact, and attach the PDF."

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/billPdfGenerator.ts` | Add `shareInvoiceImageViaWhatsApp` |
| `src/lib/whatsAppService.ts` | Context-aware toast in `sharePdfViaWhatsApp` |
| `src/features/billing/pages/BillDetailsPage.tsx` | Replace 50-line handler with one call |
| `src/features/billing/components/CheckoutSuccessModal.tsx` | Replace 50-line handler + remove dead import |

---

## Out of Scope

- Payment receipt sharing
- QR sharing
- Any new WhatsApp button or flow
- Refactoring working flows (LedgerActions, CollectToday, BalanceStatementModal, etc.)
