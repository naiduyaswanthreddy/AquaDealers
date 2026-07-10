# Stock Details UI Update Plan

## 1. Goal
Update the Stock Details page UI to match the provided modern, clean design to reduce visual clutter and improve data hierarchy.

## 2. UI Analysis & Structure
Based on the provided image, the new UI consists of the following key sections:
*   **Header (Blue Section):**
    *   Product image and Title ("Avanti 3p").
    *   Category badge ("FEED") and Status warning ("LOW STOCK").
    *   Pricing information (Selling Price & Cost Price per unit).
    *   Primary Action Buttons ("Add Stock", "Adjust Stock").
*   **Current Stock Card:**
    *   Overlaps the blue header for depth.
    *   Prominent display of current units and alert threshold.
    *   Expiry date warning.
    *   4-item grid: Stock Value, Available Lots, Unit type, Tax (GST).
*   **Today's Movement Card:**
    *   Date selector.
    *   4-column layout: Opening, In, Out (Sold), Remaining.
*   **Quick Stats Section:**
    *   Horizontal scrollable row or grid of colored cards: Current Stock, Sold This Month, Stock Value, Available Lots.
*   **Recent Activity List:**
    *   Transaction history with icons indicating Sale (Out), Purchase (In), Adjustment (Neutral).
    *   Shows quantity changes and timestamps.
*   **Bottom Navigation Tabs:**
    *   Overview, Analytics, Lots, History.

## 3. Socratic Gate (Open Questions for the User)
Before we proceed with the implementation, please clarify the following:

> [!IMPORTANT]
> 1. **Framework & Styling:** Which specific UI framework (e.g., React Native, Flutter, React web with mobile view) and styling solution (Tailwind, styled-components) are you using for this project?
> 2. **Data Fetching:** Are all these data points (Today's Movement, Quick Stats, Recent Activity) already available via an existing API endpoint, or will we need to update the backend/data layer to support these new aggregations?
> 3. **Interactivity:** For the bottom navigation (Overview, Analytics, Lots, History), should these be separate pages, or tabs within the same page that switch out the content below the "Current Stock" card?

## 4. Proposed Implementation Phases
*   **Phase 1: Component Structure & Layout:** Build the scaffolding for the new layout (Header, overlapping cards, scrollable lists) using mock data.
*   **Phase 2: Styling & Theming:** Apply the specific color palette (blue header, soft colored stat cards), typography, and iconography from the design.
*   **Phase 3: Data Integration:** Connect the UI components to real data sources.
*   **Phase 4: Refinement & Interactivity:** Add navigation tab logic, date picker interaction for "Today's Movement", and ensure responsive behavior.

## 5. Verification Plan
*   **Visual QA:** Compare the implemented UI side-by-side with the provided image on different screen sizes.
*   **Functional Testing:** Ensure "Add Stock" and "Adjust Stock" buttons trigger the correct modals/flows. Verify tab switching works correctly.
