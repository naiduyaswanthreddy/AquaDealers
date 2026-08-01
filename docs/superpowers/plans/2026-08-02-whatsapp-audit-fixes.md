# WhatsApp Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four WhatsApp-sharing defects: deduplicate invoice-image share logic, standardise on the `invoiceMessage` template, remove a dead import, and make the report-share toast accurate when no phone number is available.

**Architecture:** Add one shared `shareInvoiceImageViaWhatsApp` function to `src/lib/billPdfGenerator.ts` (already owns invoice capture logic), then replace the duplicate handlers in the two billing components. Fix the toast in `whatsAppService.ts` to be phone-aware. No new files; four files touched total.

**Tech Stack:** React 18, TypeScript, `html-to-image`, `sonner` toasts, `jsPDF`, native Web Share API / Clipboard API.

## Global Constraints

- Never change the image-capture approach (PNG via `html-to-image` at 2× pixelRatio) — it is intentional.
- Never add new WhatsApp buttons, flows, or features — fixes only.
- `whatsAppMessages.ts` is the single source of truth for all message text; do not build messages inline anywhere else.
- `normalizeIndianPhone` from `whatsAppService.ts` is the single source of truth for phone normalisation.
- All imports use the `@/` alias (e.g. `@/lib/whatsAppService`).

---

### Task 1: Context-aware toast in `sharePdfViaWhatsApp`

**Files:**
- Modify: `src/lib/whatsAppService.ts` (lines 77–107)

**Interfaces:**
- Consumes: nothing new — modifying existing `sharePdfViaWhatsApp(pdfBlob, filename, message, phone?)`
- Produces: same function signature, different toast text when `phone` is absent

- [ ] **Step 1: Open `src/lib/whatsAppService.ts` and locate the toast at the bottom of `sharePdfViaWhatsApp` (line ~104)**

Current code (lines 96–107):
```ts
  const waUrl = buildWaUrl(normalizedPhone, message);

  // Small delay so the browser processes the download first.
  await new Promise(r => setTimeout(r, 400));
  window.open(waUrl, '_blank', 'noopener,noreferrer');

  // Step 3: Show a helpful toast so the user knows to attach the PDF.
  toast.info('PDF saved! Attach it in the WhatsApp chat that just opened.', {
    duration: 6000,
  });
};
```

- [ ] **Step 2: Replace the toast with a phone-aware version**

```ts
  const waUrl = buildWaUrl(normalizedPhone, message);

  await new Promise(r => setTimeout(r, 400));
  window.open(waUrl, '_blank', 'noopener,noreferrer');

  if (normalizedPhone) {
    toast.info('PDF downloaded. Attach it in the WhatsApp chat that just opened.', {
      duration: 6000,
    });
  } else {
    toast.info('PDF downloaded. Open WhatsApp, find your contact, and attach the PDF.', {
      duration: 6000,
    });
  }
};
```

- [ ] **Step 3: Verify the change manually**

Open the app → Dashboard → Today's Snapshot → "Share on WhatsApp".
Expected: PDF downloads, WhatsApp opens to search/home screen, toast says "PDF downloaded. Open WhatsApp, find your contact, and attach the PDF." (no mention of "chat").

Open a bill with a farmer who has a phone number → Share on WhatsApp (this path goes through `shareInvoiceImageViaWhatsApp` which you write in Task 2, so test this after Task 4 is done).

- [ ] **Step 4: Commit**

```bash
git add src/lib/whatsAppService.ts
git commit -m "fix: context-aware toast in sharePdfViaWhatsApp when no phone"
```

---

### Task 2: Add `shareInvoiceImageViaWhatsApp` to `billPdfGenerator.ts`

**Files:**
- Modify: `src/lib/billPdfGenerator.ts`

**Interfaces:**
- Consumes:
  - `invoiceMessage(farmerName, billNumber, billDate, total, amountPaid, balanceDue, shopName)` from `@/lib/whatsAppMessages`
  - `normalizeIndianPhone(phone)` and `buildWaUrl(phone, text)` from `@/lib/whatsAppService`
- Produces:
  ```ts
  export const shareInvoiceImageViaWhatsApp = async (
    bill: any,
    dealer: Dealer | null,
    elementId: string,
    phone?: string | null
  ): Promise<void>
  ```
  Throws on error; callers catch and show a toast.

- [ ] **Step 1: Add the new imports at the top of `src/lib/billPdfGenerator.ts`**

Current imports (lines 1–6):
```ts
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { formatDate, formatCurrency } from './utils';
import type { Dealer } from '@/types/database';
import { sharePdfViaWhatsApp } from './whatsAppService';
import { invoiceMessage } from './whatsAppMessages';
```

Replace with (add the two new imports):
```ts
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { formatDate, formatCurrency } from './utils';
import type { Dealer } from '@/types/database';
import { sharePdfViaWhatsApp, normalizeIndianPhone, buildWaUrl } from './whatsAppService';
import { invoiceMessage } from './whatsAppMessages';
```

- [ ] **Step 2: Append `shareInvoiceImageViaWhatsApp` at the end of `src/lib/billPdfGenerator.ts`**

Add after the existing `shareBillPdfViaWhatsApp` function:

```ts
/**
 * Captures the invoice template as a PNG and shares it via WhatsApp.
 *
 * If the browser supports Web Share API with files (mobile AND desktop Chrome/Edge
 * on Windows), the native share sheet opens — image + message go directly to
 * WhatsApp in one click, no Ctrl+V needed.
 *
 * Fallback (Firefox, older browsers): image is copied to clipboard and the
 * farmer's WhatsApp chat is opened; the user pastes (Ctrl+V) to send.
 *
 * Throws on error so the caller can show a toast.
 */
export const shareInvoiceImageViaWhatsApp = async (
  bill: any,
  dealer: Dealer | null,
  elementId: string,
  phone?: string | null
): Promise<void> => {
  const { toast } = await import('sonner');

  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Invoice element '#${elementId}' not found in DOM`);

  const shopName = dealer?.shop_name || 'AquaDealers';
  const farmerName = bill.farmer_name_snapshot || (bill as any).farmers?.name || null;
  const billDate = bill.bill_date ?? '';

  const message = invoiceMessage(
    farmerName,
    bill.bill_number,
    billDate,
    bill.total ?? 0,
    bill.amount_paid ?? 0,
    bill.balance_due ?? 0,
    shopName
  );

  const originalStyle = element.style.cssText;
  element.style.width = '794px';
  element.style.maxWidth = 'none';

  let dataUrl: string;
  try {
    dataUrl = await toPng(element, { pixelRatio: 2, skipFonts: false });
  } finally {
    element.style.cssText = originalStyle;
  }

  const res = await fetch(dataUrl);
  const imageBlob = await res.blob();
  const imageFile = new File([imageBlob], `Invoice_${bill.bill_number}.png`, { type: 'image/png' });

  // Web Share API with files works on mobile AND on desktop Chrome/Edge (Windows).
  // When available, the native share sheet opens — image + message go to WhatsApp
  // in one click with no clipboard paste needed.
  if (navigator.canShare?.({ files: [imageFile] })) {
    await navigator.share({ files: [imageFile], text: message });
    return;
  }

  // Fallback for Firefox / older browsers: copy image to clipboard, open chat.
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': imageBlob })]);

  const normalized = normalizeIndianPhone(phone);
  const waUrl = normalized
    ? `https://wa.me/91${normalized}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  await new Promise(r => setTimeout(r, 300));
  window.open(waUrl, '_blank', 'noopener,noreferrer');

  toast.success(
    normalized
      ? 'Invoice image copied! Press Ctrl+V in the WhatsApp chat to paste and send it.'
      : 'Invoice image copied! Open WhatsApp, find your contact, and press Ctrl+V to send.',
    { duration: 10000 }
  );
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd D:\AquaDealer && npx tsc --noEmit
```

Expected: zero errors related to `billPdfGenerator.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/billPdfGenerator.ts
git commit -m "feat: extract shareInvoiceImageViaWhatsApp to billPdfGenerator"
```

---

### Task 3: Migrate `BillDetailsPage` to use the shared function

**Files:**
- Modify: `src/features/billing/pages/BillDetailsPage.tsx`

**Interfaces:**
- Consumes: `shareInvoiceImageViaWhatsApp(bill, dealer, elementId, phone)` from `@/lib/billPdfGenerator` (defined in Task 2)
- Produces: nothing new — simplified component

- [ ] **Step 1: Update the import block at the top of `BillDetailsPage.tsx`**

Current (line 13):
```ts
import { downloadBillPdf, shareBillPdfViaWhatsApp } from '@/lib/billPdfGenerator';
```

Replace with:
```ts
import { downloadBillPdf, shareInvoiceImageViaWhatsApp } from '@/lib/billPdfGenerator';
```

- [ ] **Step 2: Replace `handleShareWhatsApp` (lines 109–198) with the slim version**

Delete the entire existing `handleShareWhatsApp` function and replace with:

```ts
  const handleShareWhatsApp = async () => {
    if (!bill) return;
    const phone = bill.farmer_phone_snapshot || (bill as any).farmers?.phone;
    if (!phone) {
      toast.error(
        `${bill.farmer_name_snapshot || 'This farmer'} doesn't have a phone number. Add one in their profile first.`,
        { duration: 5000 }
      );
      return;
    }
    try {
      setIsSharing(true);
      await shareInvoiceImageViaWhatsApp(bill, dealer, 'print-content', phone);
    } catch (err) {
      console.error('Failed to share invoice', err);
      toast.error('Failed to generate invoice image. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };
```

- [ ] **Step 3: Verify the page still renders and the share button works**

Run the dev server and open a bill that belongs to a farmer with a phone number.
Click "Share on WhatsApp". Expected:
- On mobile: native share sheet opens with the invoice image
- On desktop: clipboard toast appears ("Invoice image copied! Press Ctrl+V…"), WhatsApp opens to the farmer's chat

Open a bill for a farmer with no phone. Click the button. Expected: error toast "doesn't have a phone number".

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd D:\AquaDealer && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/billing/pages/BillDetailsPage.tsx
git commit -m "fix: use shareInvoiceImageViaWhatsApp in BillDetailsPage"
```

---

### Task 4: Migrate `CheckoutSuccessModal` + remove dead import

**Files:**
- Modify: `src/features/billing/components/CheckoutSuccessModal.tsx`

**Interfaces:**
- Consumes: `shareInvoiceImageViaWhatsApp(bill, dealer, elementId, phone)` from `@/lib/billPdfGenerator` (defined in Task 2)
- Produces: nothing new

- [ ] **Step 1: Update the import from `billPdfGenerator` (line 10)**

Current:
```ts
import { shareBillPdfViaWhatsApp } from '@/lib/billPdfGenerator';
```

Replace with:
```ts
import { shareInvoiceImageViaWhatsApp } from '@/lib/billPdfGenerator';
```

- [ ] **Step 2: Replace `handleShareWhatsApp` (lines 67–145) with the slim version**

Delete the entire existing `handleShareWhatsApp` function and replace with:

```ts
  const handleShareWhatsApp = async () => {
    if (!bill) return;
    const phone = bill.farmer_phone_snapshot || (bill as any).farmers?.phone;
    if (!phone) {
      toast.error(
        `${bill.farmer_name_snapshot || 'This farmer'} doesn't have a phone number. Add one in their profile first.`,
        { duration: 5000 }
      );
      return;
    }
    try {
      setIsSharing(true);
      await shareInvoiceImageViaWhatsApp(bill, dealer, 'print-content-wrapper', phone);
    } catch (err) {
      console.error('Failed to share invoice:', err);
      toast.error('Failed to generate invoice image. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };
```

Note: `elementId` is `'print-content-wrapper'` here (CheckoutSuccessModal renders the template in a `div#print-content-wrapper`), vs `'print-content'` in BillDetailsPage. This is preserved from the original code.

- [ ] **Step 3: Remove the unused `normalizeIndianPhone` dynamic import**

The original function had a dynamic `import('@/lib/whatsAppService')` inside the handler body. The new slim handler has no such import. Verify there are no remaining dynamic imports of `whatsAppService` inside `handleShareWhatsApp` — the static import at the top (`import { openWhatsAppText } from '@/lib/whatsAppService'`) is still needed for `DeliveryPinCard`.

- [ ] **Step 4: Remove the hidden template div if no longer needed**

The hidden `div#print-content-wrapper` at the bottom of the modal JSX (lines 284–297) is still required — `shareInvoiceImageViaWhatsApp` captures it by ID. Leave it in place.

- [ ] **Step 5: Verify the modal share button works end-to-end**

Create a new bill for a farmer with a phone number. On the success modal, click "Share on WhatsApp".
Expected:
- On mobile: share sheet opens with invoice image
- On desktop: clipboard toast ("Invoice image copied! Press Ctrl+V…"), correct farmer's chat opens in WhatsApp

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd D:\AquaDealer && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/billing/components/CheckoutSuccessModal.tsx
git commit -m "fix: use shareInvoiceImageViaWhatsApp in CheckoutSuccessModal, remove dead import"
```

---

## Self-Review Checklist

- [x] Defect 1 (duplicate logic) → Tasks 2, 3, 4 — shared function extracted, both components migrated
- [x] Defect 2 (inline message) → Task 2 — `invoiceMessage()` used inside shared function
- [x] Defect 3 (dead import) → Task 4 — `shareBillPdfViaWhatsApp` import replaced
- [x] Defect 4 (confusing toast) → Task 1 — toast is now phone-aware
- [x] No placeholders
- [x] Types consistent: `shareInvoiceImageViaWhatsApp(bill: any, dealer: Dealer | null, elementId: string, phone?: string | null): Promise<void>` — same signature used in Tasks 2, 3, 4
- [x] `elementId` difference (`'print-content'` vs `'print-content-wrapper'`) is explicitly called out in Task 4 Step 2
