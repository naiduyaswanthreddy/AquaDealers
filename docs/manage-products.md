# Manage Products Feature Plan

## Overview
Currently, the stock page (inventory) allows viewing products, but lacks comprehensive management tools directly from the listing. The goal is to add a "Manage Product" dropdown/menu to the stock page (`InventoryList.tsx` and `InventoryDetailPage.tsx`) to allow quick actions like editing product details, deleting a product (with safety checks), and potentially duplicating or archiving products.

## Project Type
WEB

## Success Criteria
- [ ] Users can edit product details directly from the inventory list or detail page.
- [ ] Users can safely delete a product (only if there are no existing bills/purchases tied to it, or with appropriate archiving/soft-delete mechanisms).
- [ ] Users have other useful quick actions (e.g., Adjust Stock, View History) easily accessible.
- [ ] All UI changes follow the existing design system without clashing with the current layout.

## Tech Stack
- **React & TypeScript:** For frontend UI components.
- **Supabase:** For backend database operations (soft delete or hard delete logic).
- **Lucide React:** For consistent iconography.

## File Structure
- `src/features/inventory/components/InventoryList.tsx` (Modified)
- `src/features/inventory/pages/InventoryDetailPage.tsx` (Modified)
- `src/features/inventory/components/ManageProductDropdown.tsx` (New)
- `src/features/inventory/components/DeleteProductModal.tsx` (New)
- `src/features/inventory/services/inventoryService.ts` (Modified - Add delete logic)

## Task Breakdown

### 1. Backend Service Updates (Agent: backend-specialist)
- **Goal:** Add safe delete/archive logic to `inventoryService.ts`.
- **INPUT:** Product ID to delete.
- **OUTPUT:** Updated `deleteProduct` method that checks for existing constraints (like sales/purchases) and performs a safe deletion or soft-delete.
- **VERIFY:** Attempt to delete a product with no history (success) and one with history (graceful error/archive).

### 2. Create Management Modals (Agent: frontend-specialist)
- **Goal:** Create a `DeleteProductModal` for confirmation, explaining the consequences of deletion.
- **INPUT:** Product data and delete handler.
- **OUTPUT:** Reusable confirmation modal.
- **VERIFY:** Modal matches the project's alert/danger styling and functions correctly.

### 3. Update Inventory List & Details UI (Agent: frontend-specialist)
- **Goal:** Integrate a "More Options" (`MoreVertical`) dropdown menu on the `InventoryList` cards and the `InventoryDetailPage` header.
- **INPUT:** Existing inventory item cards.
- **OUTPUT:** Dropdown menu containing: "Edit Details", "Adjust Stock", "Delete Product".
- **VERIFY:** Actions trigger the respective modals and update the cache/UI upon success.

## Phase X: Verification
- [ ] Lint: `npm run lint` & `npx tsc --noEmit`
- [ ] UX Audit: Verify dropdown menus are easily accessible on mobile and desktop.
- [ ] Security: Verify only authorized roles (e.g., Admin) can delete products.
- [ ] E2E Testing: Confirm editing and deleting a product reflects immediately on the stock page.
