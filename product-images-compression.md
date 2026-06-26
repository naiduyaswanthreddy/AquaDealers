# Product Images & Compression Feature

## 1. Context & Goals
The objective is to introduce image support for products (Feeds and Medicines) and implement client-side image compression across the application (including existing farmer profile images) to optimize storage and load times.

## 2. Design Decisions
1. **Feed Images:** There will be **one generic feed image** per branch. This will likely be stored in the `branches` table or a `branch_settings` structure, rather than on every individual product.
2. **Medicine Images:** Individual medicine products will have their own image (stored on `inventory` or `products`).
3. **Compression Settings:** Images will be heavily compressed for maximum speed (e.g., max 800x800 resolution, max size ~200KB) to ensure rapid loading even on slow connections.

## 3. Task Breakdown

### Phase 1: Client-Side Image Compression
- [ ] Install `browser-image-compression` library.
- [ ] Create a reusable utility function `compressImage(file: File)` in `src/lib/imageUtils.ts`.
- [ ] Update `AddFarmerPage` and `EditFarmerPage` (and `farmerService.ts`) to compress farmer profile pictures before sending them to Supabase Storage.
- [ ] Add an option to capture images directly from the camera (using HTML5 `<input type="file" accept="image/*" capture="environment" />`) in addition to selecting from the gallery.

### Phase 2: Schema & Storage Updates
- [ ] Create a new Supabase migration to add `image_url` to the `inventory` table (or `products` table depending on the answer to Question 2).
- [ ] Update TypeScript types in `src/types/database.ts` to include the new `image_url` field.
- [ ] Create a new Supabase Storage bucket (e.g., `product-images`) with appropriate public access policies.
- [ ] Ensure that uploading and viewing these product images is locked behind the `proplus` subscription plan tier (using `useSubscriptionStore` and/or `limits`).

### Phase 3: UI Implementation
- [ ] **Inventory/Products:** Add an image upload UI in the "Add Product" and "Edit Product" forms for both feeds and medicines.
- [ ] Apply the new `compressImage` utility to product image uploads.
- [ ] Update the `InventoryPage`, `InventoryDetailPage`, and billing autocomplete dropdowns to display the product/feed images next to the product names.
- [ ] Implement a fallback placeholder image for products without an uploaded image.

## 4. Agent Assignments
- **backend-specialist**: Database migrations, TypeScript types, and Storage Bucket setup.
- **frontend-specialist**: `browser-image-compression` integration, Farmer form updates, Product UI updates, and image display logic.

## 5. Verification Checklist
- [ ] `browser-image-compression` successfully compresses 5MB images to < 500KB without breaking.
- [ ] Farmer profiles correctly upload compressed images.
- [ ] Feed products can upload/update their images (branch-specific).
- [ ] Medicine products can upload/update their images.
- [ ] Product images appear correctly in the inventory lists, detail pages, and billing search dropdowns.
- [ ] Invalid file types or excessively large files show proper error messages.
