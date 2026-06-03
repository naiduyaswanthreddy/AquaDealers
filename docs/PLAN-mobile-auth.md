# PLAN-mobile-auth

## Objective
Redesign the mobile view for `LoginPage.tsx` and `RegisterPage.tsx` to match the exact aesthetic provided in the UI mockup. The desktop view will remain unchanged.

## Target Design (Mobile Only)
1. **Top Section (Blue Background)**:
   - Deep blue background (`bg-[#0052cc]`).
   - A back arrow at the top-left (`<ArrowLeft />`).
   - **Login**: Contains the main white logo (`full logo white.png`) centered.
   - **Signup**: Keeps a smaller top blue section with just the back arrow to preserve vertical space for the form.
2. **Bottom Section (White Card)**:
   - A white container overlapping the blue background with top rounded corners (`rounded-t-[2rem]` or `rounded-t-3xl`).
   - Clean, spacious inputs with unified borders.
   - Input fields use left icons (user, mail, lock) with slightly softer borders and styling.
   - Big, full-width `primary` blue button for submission.

## Task Breakdown

### Task 1: Update `LoginPage.tsx` Mobile Layout
- Adjust the main container for mobile: change background to blue (`bg-[#0052cc]`).
- Create a mobile-only top header showing the back arrow and the white logo.
- Wrap the form in a white container with `rounded-t-3xl`, applying negative margin or absolute positioning to pull it over the blue background.
- Ensure the desktop layout (`lg:grid-cols-[1.1fr_0.9fr]`) remains untouched by using `md:` or `lg:` media queries.

### Task 2: Update `RegisterPage.tsx` Mobile Layout
- Adjust the main container for mobile to have the blue background (`bg-[#0052cc]`).
- Create a slim mobile-only top header with the back arrow.
- Wrap the registration form in a white container with `rounded-t-[2rem]`.
- Verify that the 8 input fields fit properly by using compact spacing (`gap-3`, `h-[2.75rem]`), while matching the mockup's sleek input styles.
- Add the required `terms & conditions` layout matching the screenshot.

### Task 3: Component Tweaks (If needed)
- Ensure the `Button` and `Input` components support the specific visual styling shown in the mockup (they currently do based on previous UI work, but may need minor class overrides like `rounded-xl`).

## Agent Assignments
- **frontend-specialist**: To execute the React/Tailwind code changes.

## Verification Checklist
- [ ] Mobile Login screen matches the top-blue/bottom-white-card design.
- [ ] Mobile Signup screen matches the layout and fits without excessive scrolling.
- [ ] Desktop layouts are completely unaffected and retain their side-by-side split view.
- [ ] Back buttons work correctly (navigating to the previous page or home).
