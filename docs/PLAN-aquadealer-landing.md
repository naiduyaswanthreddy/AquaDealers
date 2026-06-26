# PLAN: AquaDealers B2B Landing & Shop Routing

## Goal Description
Create a high-conversion, interactive, and beautifully designed B2B landing page for AquaDealers to attract shop owners, alongside the core dealer authentication routes (`/login`, `/signup`) and the dynamic public-facing mini-storefronts (`/{shopname}`).

### Core Objectives:
1. **Target Audience**: Water/Aqua shop owners looking to digitize or scale their business.
2. **Key Messaging**: Clearly communicate the "Why" (power of the platform), address specific pain points, and present AquaDealers as the definitive solution.
3. **Design Aesthetics**: Bright, trustworthy, utilizing glassmorphism, scroll-triggered storytelling, 3D elements, and bold typography.

---

## 🎨 UI/UX Pro Max Design System

### Pattern
- **Name**: Scroll-Triggered Storytelling
- **Conversion Focus**: Narrative increases time-on-page 3x. Use progress indicators. Mobile: simplify animations.
- **Sections**:
  1. **Intro Hook**: Stunning hero with glassmorphism & 3D elements showing a modern dashboard.
  2. **Chapter 1 (Problem)**: The chaotic reality of running a shop manually (Pain Points).
  3. **Chapter 2 (Journey)**: Transitioning to digital, seamless management.
  4. **Chapter 3 (Solution)**: How powerful AquaDealers is (inventory, customers, billing).
  5. **Climax CTA**: "Join the Network" -> `/signup`.

### Style & Atmosphere
- **Vibe**: Bright, Trustworthy, Modern SaaS, Exaggerated Minimalism.
- **Key Effects**: `font-size: clamp(3rem, 10vw, 8rem)`, `font-weight: 900`, massive whitespace, glassmorphism overlays on bright backgrounds.

### Colors
| Role | Hex | Purpose |
|------|-----|---------|
| Primary | `#3B82F6` (Blue) | Trust, Water theme |
| Secondary | `#60A5FA` (Light Blue) | Accents, Gradients |
| CTA | `#F97316` (Orange) | High-contrast conversion button |
| Background | `#F8FAFC` (Slate 50) | Bright, clean base |
| Text | `#1E293B` (Slate 800) | High readability |

### Typography
- **Font**: `Plus Jakarta Sans` (weights: 300 to 700)
- **Mood**: Friendly, modern, SaaS, clean, approachable, professional.

---

## 🚀 Proposed Architecture & Routes

### 1. `/` (Root Landing Page)
- **Purpose**: Sell the platform to dealers.
- **Key Components**:
  - `HeroSection`: 3D scroll-triggered animation of a storefront transforming into a dashboard.
  - `PainPointsSection`: Glassmorphic cards highlighting common dealer struggles (tracking jars, pending payments, customer management).
  - `SolutionSection`: Features showcase (automated billing, inventory tracking).
  - `Testimonial/SocialProof`: Trust indicators.
  - `CallToAction`: Big, bold buttons leading to `/signup`.

### 2. `/login` & `/signup` (Authentication)
- **Purpose**: Dealer onboarding and access.
- **Design**: Split-screen design (one side features a brand image/3D graphic, the other side the auth form). Minimalist, utilizing glassmorphic form containers.

### 3. `/{shopname}` (Dynamic Shop Routing)
- **Purpose**: Public-facing mini-storefront for each dealer's customers.
- **Architecture**: Dynamic routing in the framework (e.g., `[shopname].jsx` in Next.js/React Router).
- **Design**: Clean, brand-adaptable, focusing on products/services offered by the specific dealer.

---

## 📋 Task Breakdown for Implementation

- [ ] **Phase 1: Foundation & Setup**
  - Install dependencies (Framer Motion for scroll-triggers, GSAP/Three.js if advanced 3D is needed).
  - Setup Global CSS with `Plus Jakarta Sans` and Tailwind theme configurations.

- [ ] **Phase 2: Routing Setup**
  - Configure application router (React Router or Next.js App Router).
  - Implement `/`, `/login`, `/signup`, and `/:shopname` shells.

- [ ] **Phase 3: Landing Page Implementation**
  - Build the Hero Section with scroll-linked animations.
  - Build the Pain Points & Solutions sections using Glassmorphism.
  - Build the Footer and CTA elements.

- [ ] **Phase 4: Auth & Shop Pages**
  - Create the Auth pages (Login/Signup).
  - Build the template for the `/{shopname}` storefront.

- [ ] **Phase 5: UX Polish & Pre-Delivery**
  - Add hover states, smooth transitions, and ensure WCAG AA contrast.
  - Run `checklist.py` for UX, accessibility, and responsiveness.

---

## ❓ Open Questions / User Review Required

> [!IMPORTANT]
> **To the User**: Please review the following before we execute.
> 1. For the `/{shopname}` routing, do we need to implement a database check to ensure the shop exists before rendering, and if not, redirect to a 404?
> 2. For the 3D scroll-triggered elements, should we use CSS/Framer Motion for 2.5D visual effects, or do you have actual 3D `.glb`/`.gltf` models you want to use via Three.js? (CSS/Framer Motion is usually faster to build and performant).

---

## 🔍 Verification Plan
1. **Routing Check**: Verify all 4 routes map correctly and load.
2. **Design Audit**: Run UX/Accessibility audit to ensure glassmorphism works on Light Mode without contrast issues.
3. **Responsiveness**: Verify scroll-triggers work perfectly on Mobile devices without jank.
