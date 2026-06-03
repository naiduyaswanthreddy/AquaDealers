# UI Redesign: Mobile-Friendly Billing Flow

## Goal Description
Redesign the `NewBillPage` and its associated components to perfectly match the new 3-step mobile-friendly billing flow provided in the reference designs. The new flow reduces friction by condensing farmer selection into the Items step, introducing a dedicated Payment selection grid, and adding an invoice-style Review step with a prominent GST toggle.

## User Review Required
> [!IMPORTANT]
> The current flow has 3 steps: `Farmer`, `Items`, and `Bill (Cart)`. The new design changes this to:
> 1. **Items**: Merges Farmer selection into a compact card at the top.
> 2. **Payment**: A new dedicated step for Payment Types and Credit calculations.
> 3. **Review**: A print-style preview of the final invoice with a GST toggle.

Please confirm if you want to completely replace the existing `CartSidebar` and `FarmerSelector` separate steps with this new consolidated flow.

## Proposed Changes

### `src/features/billing/pages/NewBillPage.tsx`
- **[MODIFY]** Update the step tracking from `['farmer', 'items', 'bill']` to `['items', 'payment', 'review']`.
- **[MODIFY]** Update the step indicator UI to match the screenshot (connected line with numbered circles, rather than floating pill buttons).
- **[MODIFY]** Update the header to include a back arrow (`<- Create Bill`) and step indicator `(Step X of 3)`.

---

### `src/features/billing/components/ProductSelector.tsx` (Step 1: Items)
- **[MODIFY]** Add a compact "Selected Farmer" card at the top with a "Change" button. If no farmer is selected, show a default "Select Customer / Walk-in" card.
- **[MODIFY]** Change the product layout from a grid of cards to vertical list rows.
- **[MODIFY]** Update the product row UI:
  - Left side: Product Name, Price underneath.
  - Middle: `Qty` label with a compact `- [value] +` stepper.
  - Right side: Total amount for that specific item line.
- **[MODIFY]** Add a sticky footer showing `X Items | Subtotal ₹Y` and a full-width blue `Next: Payment ->` button.

---

### `src/features/billing/components/PaymentStep.tsx` (Step 2: Payment)
- **[NEW]** Create a new component for the Payment step.
- **[NEW]** Add a "Bill Summary" card showing Subtotal, Discount, and Total.
- **[NEW]** Add a "Payment Type" grid (Cash, UPI, Credit, Partial, Cheque, Other).
- **[NEW]** Add a "Credit Details" card that dynamically calculates `Current Due + New Bill Amount = Total Due After Bill`.
- **[NEW]** Add a sticky footer with a `Next: Review ->` button.

---

### `src/features/billing/components/ReviewStep.tsx` (Step 3: Review)
- **[NEW]** Create a new component to replace the old `CartSidebar`.
- **[NEW]** Add a GST toggle switch at the top right of the review section.
- **[NEW]** Build the "Bill Preview" card to look like a physical receipt/invoice:
  - Header with Shop Name, Phone, Bill No, Date.
  - Table showing Item, Qty, Rate, Amount.
  - If GST is ON, expand the table to show `GST%` and `GST Amt`, and show tax breakdowns in the subtotal area.
  - Amount in words at the bottom.
- **[NEW]** Add a sticky footer with a white `Back` button and a green `Save Bill ✓` button.

## Verification Plan

### Manual Verification
1. Open the New Bill page.
2. Verify Step 1 accurately reflects the new vertical layout and contains the sticky footer.
3. Proceed to Step 2 and verify the payment type grid and credit calculations are accurate.
4. Proceed to Step 3 and toggle GST ON/OFF. Verify the preview table dynamically updates its columns and totals.
5. Save the bill and verify it persists correctly to the database.
