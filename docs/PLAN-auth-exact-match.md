# Exact Replica Auth Redesign

We will reconstruct `LoginPage.tsx` and `RegisterPage.tsx` to precisely match the provided mockups for the desktop views, while maintaining mobile responsiveness.

## User Review Required

> [!IMPORTANT]
> **Missing Assets:**
> 1. **Blue Shrimp Graphic:** The signup page mockup features a massive 3D blue shrimp graphic at the bottom left. I do not have this image file. Can you provide this image or should I generate a placeholder/use an alternative?
> 2. **White Logo:** The signup page mockup uses a white text version of the `full logo.png`. Should I try to generate this using CSS filters (which might alter the shrimp logo colors), or do you have a `white_logo.png`?
> 3. **Wave Background:** The login page mockup features a custom wave background at the bottom. I can use an SVG wave to recreate this precisely.

## Proposed Changes

### src/tailwind.css
- **[MODIFY] tailwind.css**
  - Reset `.auth-split-container` completely to remove borders, shadows, and spacing that deviate from the mockup.
  - Define exact panel colors (`#ffffff` for right sides, `#f3f8fc` for login left side, `#0047b3` gradient for signup left side).
  - Define custom `.auth-wave-bg` and `.auth-card-floating` for the login page right side.

### src/features/auth/pages/LoginPage.tsx
- **[MODIFY] LoginPage.tsx**
  - **Left Panel:** 
    - Implement the light blue background with SVG waves.
    - Insert `full_logo.png`.
    - Add typography: "Smart aqua business management made simple" in alternating dark/blue text.
    - Add descriptive text and 3 feature icons (Inventory, Billing, Growth) using Lucide-react or custom SVGs.
  - **Right Panel:**
    - Create a white floating card layout.
    - Add "Welcome back!" heading.
    - Add "Remember me" checkbox.
    - Update styling on inputs and primary "Login" button to match the mockup perfectly.

### src/features/auth/pages/RegisterPage.tsx
- **[MODIFY] RegisterPage.tsx**
  - **Left Panel:**
    - Implement dark blue gradient background.
    - Insert white logo.
    - Add typography and bullet-point list with checkmarks.
    - Insert the Blue Shrimp graphic (pending asset).
  - **Right Panel:**
    - Full height white panel (no floating card).
    - Align typography and inputs precisely with the mockup.
    - Add "Terms & Conditions" checkbox block.

## Verification Plan
- Visually compare the rendered React components with the provided image side-by-side to guarantee pixel-perfection.
- Ensure all forms still submit correctly via existing Zustand actions.
