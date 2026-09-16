# Staff Inventory Action Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the single `inventory` staff permission into 5 independently-toggleable action-level permissions (Add/receive stock, Edit selling price, View cost price/margin, Adjust stock manually, Delete product) without changing what any existing staff member can currently do, on the day this ships.

**Architecture:** Reuse the existing `StaffPermissions` mechanism exactly as-is — it's already a JSONB dict of `key -> 'visible'|'disabled'|'hidden'`, resolved through `getStaffFeatureMode()`. Add 5 new keys to that same dict. A one-time DB migration backfills every existing `staff_members` row with values that reproduce today's actual behavior (4 of the 5 actions are currently *unconditionally available* to any staff member who can see Inventory at all — verified by reading every trigger site — so backfilling them to `'visible'` is exact, not an approximation). Only after the backfill lands do later tasks make the frontend actually check the new keys.

**Tech Stack:** React 18 + TypeScript, Zustand, TanStack Query, Supabase (Postgres + PostgREST), Vitest + React Testing Library.

## Global Constraints

- "View stock" (the base list/detail pages) is **not** one of the 5 new keys — it stays exactly as today, gated only by the existing `inventory` key (`App.tsx:290-293`). The 5 new keys are all sub-actions that only matter once a staff member can already see the page at all.
- Every existing staff member's effective access to these 5 actions must be bit-for-bit identical immediately after this ships — verified per-task, not just asserted.
- Never rename or remove an existing `StaffFeatureKey`. Only add.
- `STAFF_FEATURES` (the whole-module list — drives `StaffHomePage.tsx` tiles and `STAFF_NAV_ITEMS`) must NOT gain these 5 new entries. They belong in a separate list (`STAFF_ACTION_FEATURES`) consumed only by the dealer's staff-editor screen. (Verified: `StaffHomePage.tsx:19-20,63` filters `STAFF_FEATURES` to build nav tiles and a "Hidden modules" count — adding sub-action entries there would spawn 5 nonsensical nav tiles and silently change that count for every staff member.)
- `getStaffFeatureMode(key, permissions, isStaffMode)` and `isStaffFeatureVisible(...)` signatures do not change — every existing call site keeps working unchanged.
- `StaffFeatureKey`/`StaffAccessMode`/`StaffPermissions` must still be importable from `@/lib/staffAccess` after Task 1 (verified: `MorePage.tsx:32`, `lib/constants.ts:2`, `FeatureGate.tsx:3`, `DesktopSidebar.tsx:21` import `StaffFeatureKey` from that path today).
- Migration files go in `supabase/migrations/`, named `YYYYMMDDHHMMSS_description.sql`.
- Test dealer for manual QA: dealer UUID `f90ec65c-28e1-482e-b15f-1595bc6869e2` ("Sri Venkateswara"), branch "Main Shop" (`f27713a0-5fad-4cb8-b6ca-e896fdddd61b`) — safe to create/edit/delete test data here (see project memory `supabase-project-credentials`). Never use the production dealer for QA.
- **Test runner note:** `vitest` cannot run on this machine (Node v20.11.1, needs ≥20.12 for a `node:util` export the installed rolldown/vitest requires) — this is a pre-existing environment gap, not something to fix as part of this plan. Write every test file the plan calls for exactly as specified (correct, ready for CI), verify via `npx tsc --noEmit -p tsconfig.json` instead of actually running `vitest`, and rely on the plan's manual QA steps against the test dealer for runtime behavior. Report test files as "written, not executed (vitest blocked in this environment)" rather than claiming a PASS you didn't see.

---

### Task 1: Single source of truth for staff permission types

**Files:**
- Modify: `src/lib/staffAccess.ts:1-61`

**Interfaces:**
- Consumes: `StaffFeatureKey`, `StaffAccessMode`, `StaffPermissions` (currently defined twice — `src/types/database.ts:92-110` and duplicated in this file)
- Produces: same three type names, still importable from `@/lib/staffAccess`, now re-exported instead of redefined

Today `src/types/database.ts:92-110` and `src/lib/staffAccess.ts:20-61` define the exact same three types independently ("kept in sync manually"). We're about to add 5 new keys — doing it in only one of the two copies is a latent bug waiting to happen. Collapse to one definition before touching anything else.

- [ ] **Step 1: Point staffAccess.ts at the database.ts types**

In `src/lib/staffAccess.ts`, replace:

```ts
export type StaffAccessMode = 'visible' | 'disabled' | 'hidden';

export type StaffFeatureKey =
  | 'dashboard'
  | 'billHistory'
  | 'newBill'
  | 'farmerList'
  | 'addFarmer'
  | 'inventory'
  | 'suppliers'
  | 'cashbook'
  | 'expenses'
  | 'reports'
  | 'settings'
  | 'branches'
  | 'staffManagement'
  | 'transactions';
```

with:

```ts
export type { StaffAccessMode, StaffFeatureKey, StaffPermissions } from '@/types/database';
```

Then find this later in the same file (currently right after `StaffDealerProfileInput`):

```ts
export interface StaffPermissions extends Record<StaffFeatureKey, StaffAccessMode> {}
```

and delete it — it's now covered by the re-export above. Leave everything else in the file (`StaffFeatureDefinition`, `StaffNavDefinition`, `StaffDealerProfileInput`, `STAFF_FEATURES`, `STAFF_DEFAULT_PERMISSIONS`, etc.) exactly where it is.

- [ ] **Step 2: Verify nothing broke**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors (every existing importer of `StaffFeatureKey`/`StaffAccessMode`/`StaffPermissions` from `@/lib/staffAccess` — `MorePage.tsx`, `lib/constants.ts`, `FeatureGate.tsx`, `DesktopSidebar.tsx`, and others — still resolves the same type, just from a re-export).

- [ ] **Step 3: Commit**

```bash
git add src/lib/staffAccess.ts
git commit -m "refactor(staff): single-source StaffPermissions types to avoid drift before extending them"
```

---

### Task 2: Add the 5 new permission keys (data only, nothing reads them yet)

**Files:**
- Modify: `src/types/database.ts:94-108`
- Modify: `src/lib/staffAccess.ts` (imports, new `STAFF_ACTION_FEATURES` list, `STAFF_DEFAULT_PERMISSIONS`, `StaffFeatureDefinition`)
- Test: `src/lib/staffAccess.test.ts` (new file)

**Interfaces:**
- Consumes: `StaffFeatureDefinition` (`src/lib/staffAccess.ts:38-45`), `getStaffFeatureMode` (`src/lib/staffAccess.ts:195-202`, unchanged)
- Produces: 5 new `StaffFeatureKey` values (`'inventoryAddStock' | 'inventoryEditPrice' | 'inventoryViewCostPrice' | 'inventoryAdjustStock' | 'inventoryDeleteProduct'`), a new exported `STAFF_ACTION_FEATURES: StaffFeatureDefinition[]` array, and a new optional `parentKey?: StaffFeatureKey` field on `StaffFeatureDefinition` — later tasks (3-9) rely on all of these names exactly as spelled here.

This task only *adds* the keys and their metadata. No component reads them yet, so this cannot change behavior for anyone — it's purely additive data, verified by a unit test on the default-resolution logic.

- [ ] **Step 1: Write the failing test**

Create `src/lib/staffAccess.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getStaffFeatureMode, STAFF_DEFAULT_PERMISSIONS } from './staffAccess';

describe('new inventory action permission defaults', () => {
  it('gives brand-new staff (no permissions object at all) the documented defaults', () => {
    expect(getStaffFeatureMode('inventoryAddStock', undefined, true)).toBe('hidden');
    expect(getStaffFeatureMode('inventoryEditPrice', undefined, true)).toBe('visible');
    expect(getStaffFeatureMode('inventoryViewCostPrice', undefined, true)).toBe('hidden');
    expect(getStaffFeatureMode('inventoryAdjustStock', undefined, true)).toBe('visible');
    expect(getStaffFeatureMode('inventoryDeleteProduct', undefined, true)).toBe('hidden');
  });

  it('STAFF_DEFAULT_PERMISSIONS has a value for every one of the 5 new keys', () => {
    expect(STAFF_DEFAULT_PERMISSIONS.inventoryAddStock).toBeDefined();
    expect(STAFF_DEFAULT_PERMISSIONS.inventoryEditPrice).toBeDefined();
    expect(STAFF_DEFAULT_PERMISSIONS.inventoryViewCostPrice).toBeDefined();
    expect(STAFF_DEFAULT_PERMISSIONS.inventoryAdjustStock).toBeDefined();
    expect(STAFF_DEFAULT_PERMISSIONS.inventoryDeleteProduct).toBeDefined();
  });

  it('a dealer (isStaffMode=false) always gets visible regardless of the key', () => {
    expect(getStaffFeatureMode('inventoryViewCostPrice', undefined, false)).toBe('visible');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/staffAccess.test.ts`
Expected: FAIL — TypeScript error, `'inventoryAddStock'` is not assignable to type `StaffFeatureKey` (the keys don't exist yet).

(If `vitest` cannot run in this environment — see the Global Constraints note — instead confirm this step's intent via `npx tsc --noEmit -p tsconfig.json`: it should report the exact same "not assignable to type StaffFeatureKey" errors on this new test file before Step 3 adds the keys.)

- [ ] **Step 3: Add the 5 keys to the type union**

In `src/types/database.ts`, replace:

```ts
export type StaffFeatureKey =
  | 'dashboard'
  | 'billHistory'
  | 'newBill'
  | 'farmerList'
  | 'addFarmer'
  | 'inventory'
  | 'suppliers'
  | 'cashbook'
  | 'expenses'
  | 'reports'
  | 'settings'
  | 'branches'
  | 'staffManagement'
  | 'transactions';
```

with:

```ts
export type StaffFeatureKey =
  | 'dashboard'
  | 'billHistory'
  | 'newBill'
  | 'farmerList'
  | 'addFarmer'
  | 'inventory'
  | 'inventoryAddStock'
  | 'inventoryEditPrice'
  | 'inventoryViewCostPrice'
  | 'inventoryAdjustStock'
  | 'inventoryDeleteProduct'
  | 'suppliers'
  | 'cashbook'
  | 'expenses'
  | 'reports'
  | 'settings'
  | 'branches'
  | 'staffManagement'
  | 'transactions';
```

- [ ] **Step 4: Add `parentKey` to `StaffFeatureDefinition` and a new `STAFF_ACTION_FEATURES` list**

In `src/lib/staffAccess.ts`, first extend the icon import list (currently `FileBarChart, GitBranch, History, Home, Package, PiggyBank, Plus, ReceiptText, Settings, ShieldCheck, Users, Users2, Wallet`) to also pull in `Eye, PackagePlus, Pencil, SlidersHorizontal, Trash2`:

```ts
import {
  Eye,
  FileBarChart,
  GitBranch,
  History,
  Home,
  Package,
  PackagePlus,
  Pencil,
  PiggyBank,
  Plus,
  ReceiptText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
  Users2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
```

Then update `StaffFeatureDefinition` to add the optional field:

```ts
export interface StaffFeatureDefinition {
  key: StaffFeatureKey;
  label: string;
  description: string;
  route: string;
  icon: LucideIcon;
  color: string;
  /** When set, this is a sub-action of a whole-module StaffFeatureKey (e.g. 'inventory'),
   *  not a standalone nav destination. Sub-actions live in STAFF_ACTION_FEATURES, never
   *  in STAFF_FEATURES, so they never appear as their own nav tile. */
  parentKey?: StaffFeatureKey;
}
```

Then add the new list right after the closing `];` of `STAFF_FEATURES` (`src/lib/staffAccess.ts:168` in the current file):

```ts
// Sub-actions of an already-listed whole-module feature (see STAFF_FEATURES).
// Deliberately NOT part of STAFF_FEATURES: that list drives StaffHomePage's nav
// tiles and its "Hidden modules" count, and none of these are a nav destination
// on their own — they only make sense as a toggle inside the dealer's staff
// editor. Rendered nested under their parent by StaffPage.tsx (see Task 3).
export const STAFF_ACTION_FEATURES: StaffFeatureDefinition[] = [
  {
    key: 'inventoryAddStock',
    label: 'Add/Receive Stock',
    description: 'Record a stock purchase to add quantity to inventory.',
    route: '/inventory',
    icon: PackagePlus,
    color: 'bg-emerald-100 text-emerald-700',
    parentKey: 'inventory',
  },
  {
    key: 'inventoryEditPrice',
    label: 'Edit Selling Price',
    description: 'Change a product\'s selling price, MRP, or discount.',
    route: '/inventory',
    icon: Pencil,
    color: 'bg-emerald-100 text-emerald-700',
    parentKey: 'inventory',
  },
  {
    key: 'inventoryViewCostPrice',
    label: 'View Cost Price / Margin',
    description: 'See what the dealer paid for stock and the profit margin.',
    route: '/inventory',
    icon: Eye,
    color: 'bg-emerald-100 text-emerald-700',
    parentKey: 'inventory',
  },
  {
    key: 'inventoryAdjustStock',
    label: 'Adjust Stock Manually',
    description: 'Correct a stock quantity without a purchase record.',
    route: '/inventory',
    icon: SlidersHorizontal,
    color: 'bg-emerald-100 text-emerald-700',
    parentKey: 'inventory',
  },
  {
    key: 'inventoryDeleteProduct',
    label: 'Delete Product',
    description: 'Remove a product from active stock.',
    route: '/inventory',
    icon: Trash2,
    color: 'bg-emerald-100 text-emerald-700',
    parentKey: 'inventory',
  },
];
```

- [ ] **Step 5: Add defaults for the 5 new keys**

In `src/lib/staffAccess.ts`, `STAFF_DEFAULT_PERMISSIONS` currently reads:

```ts
export const STAFF_DEFAULT_PERMISSIONS: StaffPermissions = {
  dashboard: 'hidden',
  billHistory: 'hidden',
  newBill: 'visible',
  farmerList: 'hidden',
  addFarmer: 'visible',
  inventory: 'hidden',
  suppliers: 'hidden',
  cashbook: 'hidden',
  expenses: 'hidden',
  reports: 'hidden',
  settings: 'hidden',
  branches: 'hidden',
  staffManagement: 'hidden',
  transactions: 'visible',
};
```

Replace with (adds the 5 new keys; every existing key's value is untouched):

```ts
export const STAFF_DEFAULT_PERMISSIONS: StaffPermissions = {
  dashboard: 'hidden',
  billHistory: 'hidden',
  newBill: 'visible',
  farmerList: 'hidden',
  addFarmer: 'visible',
  inventory: 'hidden',
  // Defaults below apply only to brand-new staff created after this ships.
  // Every staff member that already existed keeps their exact current
  // behavior via the one-time backfill migration in Task 4, not via these
  // defaults.
  inventoryAddStock: 'hidden', // mirrors the 'suppliers' default it used to piggyback on
  inventoryEditPrice: 'visible',
  inventoryViewCostPrice: 'hidden', // new conservative default: hide margins from new hires unless the dealer opts in
  inventoryAdjustStock: 'visible',
  inventoryDeleteProduct: 'hidden', // destructive action: conservative default for new hires
  suppliers: 'hidden',
  cashbook: 'hidden',
  expenses: 'hidden',
  reports: 'hidden',
  settings: 'hidden',
  branches: 'hidden',
  staffManagement: 'hidden',
  transactions: 'visible',
};
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/lib/staffAccess.test.ts`
Expected: PASS (3 tests)

(If `vitest` cannot run in this environment, confirm via `npx tsc --noEmit -p tsconfig.json` instead — it should now be clean — and report the test as written/not executed rather than claiming a PASS.)

- [ ] **Step 7: Run full typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/types/database.ts src/lib/staffAccess.ts src/lib/staffAccess.test.ts
git commit -m "feat(staff): add 5 inventory action-level permission keys (not enforced yet)"
```

---

### Task 3: Show the 5 new toggles in the dealer's staff editor, nested under Inventory

**Files:**
- Modify: `src/features/staff/pages/StaffPage.tsx:27-49` (imports, `FEATURE_GROUPS`)
- Modify: `src/features/staff/pages/StaffPage.tsx:271-323` (`renderPermissionControls`)

**Interfaces:**
- Consumes: `STAFF_ACTION_FEATURES` (Task 2), `StaffFeatureDefinition.parentKey` (Task 2), existing `STAFF_FEATURES`, `setFeatureMode` (`StaffPage.tsx:195-203`, unchanged, already generic over any `StaffFeatureKey`)
- Produces: nothing new for later tasks — this is a leaf UI task

Once this lands, a dealer editing a staff member sees 5 new rows nested under "Inventory" and can toggle them. Because nothing in the rest of the app reads these keys yet (Task 2 only added defaults, Tasks 5-9 haven't wired any gate yet), toggling them has **no effect on staff-side behavior until Task 4's backfill and Tasks 5-9 land** — this task is purely "make the control visible and save-able," which already works today because `setFeatureMode`, `getDefaultFormState`, and `normalizePermissions` are all key-agnostic (verified: `StaffPage.tsx:62-71`, `StaffPage.tsx:195-203`, `staffService.ts:52-54` all spread/merge over `StaffPermissions` generically, no per-key logic to update).

- [ ] **Step 1: Import STAFF_ACTION_FEATURES**

In `src/features/staff/pages/StaffPage.tsx`, change:

```ts
import {
  STAFF_DEFAULT_PERMISSIONS,
  STAFF_FEATURES,
} from '@/lib/staffAccess';
```

to:

```ts
import {
  STAFF_ACTION_FEATURES,
  STAFF_DEFAULT_PERMISSIONS,
  STAFF_FEATURES,
} from '@/lib/staffAccess';
```

- [ ] **Step 2: Render each group's children nested under their parent row**

Replace the body of `renderPermissionControls` (`StaffPage.tsx:271-323`) — specifically the `{group.keys.map((featureKey) => { ... })}` block — with a version that also renders any `STAFF_ACTION_FEATURES` whose `parentKey` matches the row just rendered:

```tsx
  const renderPermissionControls = (permissions: StaffPermissions) => (
    <div className="space-y-4">
      {FEATURE_GROUPS.map((group) => (
        <div key={group.title} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">
              {group.title}
            </div>
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
              Hidden / Disabled / Visible
            </div>
          </div>
          <div className="space-y-3">
            {group.keys.map((featureKey) => {
              const definition = STAFF_FEATURES.find((feature) => feature.key === featureKey);
              if (!definition) return null;

              const currentMode = permissions[featureKey];
              const children = STAFF_ACTION_FEATURES.filter((feature) => feature.parentKey === featureKey);

              return (
                <React.Fragment key={featureKey}>
                  <div className="rounded-2xl border border-border bg-white px-4 py-4">
                    <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-text-primary">{definition.label}</div>
                        <p className="mt-1 text-sm leading-6 text-text-secondary">{definition.description}</p>
                      </div>
                      <div className="grid min-w-full grid-cols-3 gap-2 rounded-2xl border border-border bg-surface p-2 sm:min-w-[20rem]">
                        {(['hidden', 'disabled', 'visible'] as StaffAccessMode[]).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setFeatureMode(featureKey, mode)}
                            className={cn(
                              'flex min-h-11 items-center justify-center rounded-xl border px-2 py-2 text-center text-[0.68rem] font-black uppercase tracking-[0.14em] transition-all',
                              currentMode === mode
                                ? 'border-transparent'
                                : 'border-primary/15 bg-primary/8 text-primary/75 hover:border-primary/20 hover:text-primary'
                            )}
                            style={getModeButtonStyle(mode, currentMode)}
                            aria-pressed={currentMode === mode}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {children.length > 0 && (
                    <div className="ml-4 space-y-2 border-l-2 border-border pl-4">
                      {currentMode !== 'visible' && (
                        <p className="text-xs font-semibold text-text-muted">
                          These only take effect while {definition.label} above is Visible.
                        </p>
                      )}
                      {children.map((child) => {
                        const childMode = permissions[child.key];
                        return (
                          <div
                            key={child.key}
                            className={cn(
                              'rounded-2xl border border-border bg-white px-4 py-3',
                              currentMode !== 'visible' && 'opacity-50'
                            )}
                          >
                            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-text-primary">{child.label}</div>
                                <p className="mt-1 text-xs leading-5 text-text-secondary">{child.description}</p>
                              </div>
                              <div className="grid min-w-full grid-cols-3 gap-2 rounded-2xl border border-border bg-surface p-2 sm:min-w-[18rem]">
                                {(['hidden', 'disabled', 'visible'] as StaffAccessMode[]).map((mode) => (
                                  <button
                                    key={mode}
                                    type="button"
                                    disabled={currentMode !== 'visible'}
                                    onClick={() => setFeatureMode(child.key, mode)}
                                    className={cn(
                                      'flex min-h-10 items-center justify-center rounded-xl border px-2 py-2 text-center text-[0.65rem] font-black uppercase tracking-[0.14em] transition-all disabled:cursor-not-allowed',
                                      childMode === mode
                                        ? 'border-transparent'
                                        : 'border-primary/15 bg-primary/8 text-primary/75 hover:border-primary/20 hover:text-primary'
                                    )}
                                    style={getModeButtonStyle(mode, childMode)}
                                    aria-pressed={childMode === mode}
                                  >
                                    {mode}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
```

Note the `disabled={currentMode !== 'visible'}` on each child button: a dealer cannot set a sub-permission while the parent module is Hidden/Disabled, avoiding a confusing state where e.g. "View Cost Price: Visible" is set but Inventory itself is Hidden (the value is still saved as whatever it was, just not editable until the parent is Visible again — this matches the "only take effect while X is Visible" copy above the group).

- [ ] **Step 3: Manual verification**

Run the dev server (`npm run dev`), open `/staff` as the test dealer, click "Add Staff" (or edit an existing one), scroll to "Business Modules" → Inventory. Confirm:
1. Five new rows appear indented under Inventory, each with its own Hidden/Disabled/Visible toggle.
2. If Inventory's own toggle is not Visible, the 5 child rows show as greyed out and their buttons don't respond to clicks.
3. Set Inventory to Visible, then toggle a couple of the new child rows, save the staff member, reopen the edit modal — the toggles you set are still there (proves `setFeatureMode`/`normalizePermissions` round-trip the new keys correctly with no code changes needed there).

- [ ] **Step 4: Commit**

```bash
git add src/features/staff/pages/StaffPage.tsx
git commit -m "feat(staff): show inventory action permissions nested under Inventory in the staff editor"
```

---

### Task 4: Backfill existing staff so nothing changes for them

**Files:**
- Create: `supabase/migrations/20260917000000_backfill_inventory_action_permissions.sql`

**Interfaces:**
- Consumes: `staff_members.permissions` JSONB column (existing)
- Produces: every existing `staff_members` row gains all 5 new keys with values that reproduce today's actual behavior — Tasks 5-9 depend on this having already run before their gates go live for existing staff.

This is the step that makes "don't break anything" true. Four of the five actions are **currently unconditionally available** to any staff member who can already see Inventory (verified in Task 2's research: no gate at all exists today on Edit Price, View Cost Price, Adjust Stock, or Delete Product) — so backfilling them to `'visible'` for every existing row is not a guess, it's restoring exactly what's true today. The fifth, Add Stock, is currently gated by the `suppliers` key (`InventoryPage.tsx:90`, `App.tsx:317-318`) — so it's backfilled from each row's own current `suppliers` value, not a fixed constant, so a staff member who currently *can't* add stock still can't after this ships, and one who can, still can.

- [ ] **Step 1: Write the migration**

```sql
-- Backfill the 5 new inventory action permission keys (added in the frontend
-- in a prior deploy — see StaffFeatureKey in src/types/database.ts) onto every
-- existing staff_members row, with values chosen so no existing staff member's
-- effective access changes:
--
-- - inventoryAddStock copies each row's own current `suppliers` value, because
--   that's the key that has gated Add Stock until now (InventoryPage.tsx:90,
--   App.tsx's /purchases/new route).
-- - inventoryEditPrice, inventoryViewCostPrice, inventoryAdjustStock,
--   inventoryDeleteProduct all become 'visible', because none of the four had
--   ANY permission gate before this — any staff member who could see Inventory
--   at all could already do all four unconditionally.
--
-- Idempotent: only touches rows that don't already have inventoryAddStock, so
-- re-running this migration (or a dealer having already customized the new
-- keys through the UI before this ran) is safe.

UPDATE public.staff_members
SET permissions = permissions
  || jsonb_build_object('inventoryAddStock', COALESCE(permissions->>'suppliers', 'hidden'))
  || jsonb_build_object('inventoryEditPrice', 'visible')
  || jsonb_build_object('inventoryViewCostPrice', 'visible')
  || jsonb_build_object('inventoryAdjustStock', 'visible')
  || jsonb_build_object('inventoryDeleteProduct', 'visible')
WHERE NOT (permissions ? 'inventoryAddStock');
```

Save this to `supabase/migrations/20260917000000_backfill_inventory_action_permissions.sql`.

- [ ] **Step 2: Dry-run the exact logic against the test dealer first**

Before pushing to the whole database, confirm the backfill expression does what's intended against one real row. Using the Supabase REST API with the secret key (see project memory `supabase-project-credentials` for the URL/keys) against the TEST dealer's staff member "Yash":

```bash
curl -s "https://fvcafioxkgbljcjomixs.supabase.co/rest/v1/staff_members?dealer_id=eq.f90ec65c-28e1-482e-b15f-1595bc6869e2&select=id,name,permissions" \
  -H "apikey: <secret key from memory>" \
  -H "Authorization: Bearer <secret key from memory>"
```

Expected: a JSON row for "Yash" whose `permissions` object does NOT yet contain `inventoryAddStock` (confirms the `WHERE` clause will match it) and DOES contain a `suppliers` key with some value — note that value, it's what `inventoryAddStock` should become after the migration.

- [ ] **Step 3: Apply the migration**

```bash
npx supabase db push
```

Expected output includes `Applying migration 20260917000000_backfill_inventory_action_permissions.sql...` with no errors.

- [ ] **Step 4: Verify the backfill against the same test row**

Re-run the same `curl` command from Step 2. Expected: the same staff member's `permissions` now includes all 5 new keys, with `inventoryAddStock` exactly equal to whatever `suppliers` was, and the other 4 set to `"visible"`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260917000000_backfill_inventory_action_permissions.sql
git commit -m "fix(staff): backfill new inventory action permissions so existing staff keep current access"
```

---

### Task 5: Enforce "Add/Receive Stock"

**Files:**
- Modify: `src/features/inventory/pages/InventoryPage.tsx:90`
- Modify: `src/App.tsx:317-318`

**Interfaces:**
- Consumes: `getStaffFeatureMode` (unchanged), `'inventoryAddStock'` key (Task 2 + backfilled in Task 4)

This is the only one of the 5 that has a *replaced* gate (was `suppliers`, becomes `inventoryAddStock`) rather than a newly-added one. Because Task 4 backfilled `inventoryAddStock` to match each row's current `suppliers` value, this swap is behavior-neutral for every existing staff member at the moment it ships; going forward the two keys can be set independently.

- [ ] **Step 1: Swap the button-level check**

In `src/features/inventory/pages/InventoryPage.tsx:90`, replace:

```ts
const canAddStock = getStaffFeatureMode('suppliers', currentStaff?.permissions, !!currentStaff) === 'visible';
```

with:

```ts
const canAddStock = getStaffFeatureMode('inventoryAddStock', currentStaff?.permissions, !!currentStaff) === 'visible';
```

- [ ] **Step 2: Swap the route-level gate**

In `src/App.tsx:317-318`, replace:

```tsx
            <Route path="/purchases/new"          element={<FeatureGate allowed={['suppliers']} title="New Purchase"   description="You do not have access to purchases."><NewPurchasePage /></FeatureGate>} />
            <Route path="/purchases/:purchaseId"  element={<FeatureGate allowed={['suppliers']} title="Purchase Detail" description="You do not have access to purchases."><PurchaseDetailPage /></FeatureGate>} />
```

with:

```tsx
            <Route path="/purchases/new"          element={<FeatureGate allowed={['inventoryAddStock']} title="New Purchase"   description="You do not have access to purchases."><NewPurchasePage /></FeatureGate>} />
            <Route path="/purchases/:purchaseId"  element={<FeatureGate allowed={['inventoryAddStock']} title="Purchase Detail" description="You do not have access to purchases."><PurchaseDetailPage /></FeatureGate>} />
```

Do NOT change `/suppliers` or `/suppliers/:id` (`App.tsx:315-316`) — those stay on the `suppliers` key. They're the separate Suppliers/Purchases module (out of scope for this plan; see the plan's "What's deliberately out of scope here" section).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 4: Manual verification against the test dealer**

1. In `/staff`, edit test staff member "Yash": set Inventory → Visible, and the new "Add/Receive Stock" sub-toggle → Hidden. Save.
2. Log into the staff portal as Yash (staff PIN login), open `/inventory`. Confirm the "Add Stock" button is gone.
3. Try navigating directly to `/purchases/new` in the browser address bar while still logged in as Yash. Confirm it shows the "You do not have access to purchases" access-restricted page, not the purchase form.
4. Back in `/staff` as the dealer, set "Add/Receive Stock" → Visible for Yash. Save, reload the staff session, confirm the button reappears and `/purchases/new` now opens the form.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventory/pages/InventoryPage.tsx src/App.tsx
git commit -m "feat(staff): gate Add Stock by its own permission instead of piggybacking on Suppliers"
```

---

### Task 6: Enforce "Edit Selling Price"

**Files:**
- Modify: `src/features/inventory/pages/InventoryDetailPage.tsx`

**Interfaces:**
- Consumes: `getStaffFeatureMode`, `useStaffStore`, `'inventoryEditPrice'` key

Three trigger points open the same price-editing surface in this file: the mobile pencil icon (line 501), the desktop "Edit" button (line 541), and the per-lot "Edit" link (line 1108, opens the inline "Edit Lot" modal). All three get the same gate.

- [ ] **Step 1: Import the staff permission helpers**

Near the top of `src/features/inventory/pages/InventoryDetailPage.tsx`, add to the existing import block:

```ts
import { useStaffStore } from '@/stores/staffStore';
import { getStaffFeatureMode } from '@/lib/staffAccess';
```

- [ ] **Step 2: Compute the permission flags once**

Right after the existing `const updateLotPricing = useUpdateInventoryLotPricing();` line (`InventoryDetailPage.tsx:179`), add:

```ts
  const currentStaff = useStaffStore((s) => s.currentStaff);
  const canEditPrice = getStaffFeatureMode('inventoryEditPrice', currentStaff?.permissions, !!currentStaff) === 'visible';
```

- [ ] **Step 3: Gate the mobile edit icon**

At `InventoryDetailPage.tsx:499-506`, replace:

```tsx
          <button
            type="button"
            onClick={() => setIsEditInventoryOpen(true)}
            className="sm:hidden flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Edit product prices"
          >
            <Pencil className="h-[1.1rem] w-[1.1rem]" />
          </button>
```

with:

```tsx
          canEditPrice ? (
            <button
              type="button"
              onClick={() => setIsEditInventoryOpen(true)}
              className="sm:hidden flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Edit product prices"
            >
              <Pencil className="h-[1.1rem] w-[1.1rem]" />
            </button>
          ) : null
```

(This sits inside the `topRightAction={ ... }` prop, so wrapping it in a ternary that can return `null` is enough — no surrounding JSX to worry about.)

- [ ] **Step 4: Gate the desktop Edit button**

At `InventoryDetailPage.tsx:538-545`, replace:

```tsx
            <Button
              className="!hidden sm:!flex bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/30 font-semibold h-12 rounded-xl"
              fullWidth
              onClick={() => setIsEditInventoryOpen(true)}
              leftIcon={<Pencil className="h-5 w-5 opacity-80" />}
            >
              Edit
            </Button>
```

with:

```tsx
            {canEditPrice && (
              <Button
                className="!hidden sm:!flex bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/30 font-semibold h-12 rounded-xl"
                fullWidth
                onClick={() => setIsEditInventoryOpen(true)}
                leftIcon={<Pencil className="h-5 w-5 opacity-80" />}
              >
                Edit
              </Button>
            )}
```

(This one sits directly inside the `action={ <div className="grid grid-cols-2 gap-3 ..."> ... </div> }` JSX block alongside the Adjust Stock and Add Stock buttons, so `{canEditPrice && (...)}` is a normal sibling expression — no extra wrapping needed.)

- [ ] **Step 5: Gate the per-lot edit trigger**

At `InventoryDetailPage.tsx:1106-1111`, replace:

```tsx
                            <button
                              type="button"
                              onClick={() => openLotEditor(lot as InventoryLot)}
                              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                            >
```

with:

```tsx
                            <button
                              type="button"
                              onClick={() => openLotEditor(lot as InventoryLot)}
                              disabled={!canEditPrice}
                              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
```

(A `disabled` button here rather than removing it entirely, since it sits inline in a lot row and outright removing it would need reflowing the row's layout — disabling communicates the same thing with a much smaller diff.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 7: Manual verification against the test dealer**

1. In `/staff`, edit Yash: Inventory → Visible, "Edit Selling Price" → Hidden. Save.
2. As Yash, open any inventory item's detail page. Confirm no edit pencil/button appears (mobile and desktop), and any per-lot "Edit" link under the Lots tab is greyed out and unclickable.
3. Set "Edit Selling Price" → Visible for Yash. Confirm all three edit entry points reappear/re-enable and opening the modal still saves correctly.

- [ ] **Step 8: Commit**

```bash
git add src/features/inventory/pages/InventoryDetailPage.tsx
git commit -m "feat(staff): gate editing selling price/MRP behind inventoryEditPrice permission"
```

---

### Task 7: Enforce "View Cost Price / Margin"

**Files:**
- Modify: `src/features/inventory/pages/InventoryDetailPage.tsx`

**Interfaces:**
- Consumes: `getStaffFeatureMode`, `currentStaff` (both already available from Task 6, same file)

Three read-only spots show cost price or a profit figure derived from it: the header badge (line 514-517), the stock-card stat cell (line 592-598), and the "Profit This Month" quick-stat card (line 776-783). All three get hidden outright (not greyed — an unreadable number next to a visible label is worse than no cell at all).

- [ ] **Step 1: Compute the second flag**

Right after the `canEditPrice` line added in Task 6 Step 2, add:

```ts
  const canViewCostPrice = getStaffFeatureMode('inventoryViewCostPrice', currentStaff?.permissions, !!currentStaff) === 'visible';
```

- [ ] **Step 2: Hide the header Cost badge**

At `InventoryDetailPage.tsx:514-517`, replace:

```tsx
            <div className="inline-flex flex-1 sm:flex-none items-center justify-between sm:justify-start gap-2 bg-white/10 px-2.5 sm:px-3.5 py-2 rounded-xl border border-white/10 backdrop-blur-sm whitespace-nowrap">
              <span className="text-white/70 text-[10px] sm:text-xs uppercase tracking-wider font-bold">Cost</span>
              <span className="text-white font-bold text-sm sm:text-base">₹{inventory.cost_price?.toLocaleString()} <span className="text-[10px] sm:text-xs font-semibold text-white/50 capitalize">/ {inventory.product.unit}</span></span>
            </div>
```

with:

```tsx
            {canViewCostPrice && (
              <div className="inline-flex flex-1 sm:flex-none items-center justify-between sm:justify-start gap-2 bg-white/10 px-2.5 sm:px-3.5 py-2 rounded-xl border border-white/10 backdrop-blur-sm whitespace-nowrap">
                <span className="text-white/70 text-[10px] sm:text-xs uppercase tracking-wider font-bold">Cost</span>
                <span className="text-white font-bold text-sm sm:text-base">₹{inventory.cost_price?.toLocaleString()} <span className="text-[10px] sm:text-xs font-semibold text-white/50 capitalize">/ {inventory.product.unit}</span></span>
              </div>
            )}
```

(This sits alongside the "Selling" badge in the same flex row at `InventoryDetailPage.tsx:509-518` — removing one item from a `flex` row reflows cleanly, no layout math needed.)

- [ ] **Step 3: Hide the stock-card Cost stat cell**

At `InventoryDetailPage.tsx:592-598`, replace:

```tsx
             <div className="hidden lg:flex flex-col gap-1 items-center justify-center text-center border-l border-slate-100">
                <div className="flex items-center gap-1.5">
                   <ArrowDownCircle className="w-3.5 h-3.5 text-slate-400" />
                   <span className="text-[10px] font-medium text-slate-500">Cost</span>
                </div>
                <span className="text-sm font-bold text-slate-800">₹{inventory.cost_price?.toLocaleString() ?? '—'}</span>
             </div>
```

with:

```tsx
             {canViewCostPrice && (
               <div className="hidden lg:flex flex-col gap-1 items-center justify-center text-center border-l border-slate-100">
                  <div className="flex items-center gap-1.5">
                     <ArrowDownCircle className="w-3.5 h-3.5 text-slate-400" />
                     <span className="text-[10px] font-medium text-slate-500">Cost</span>
                  </div>
                  <span className="text-sm font-bold text-slate-800">₹{inventory.cost_price?.toLocaleString() ?? '—'}</span>
               </div>
             )}
```

(This is one cell inside `grid grid-cols-4 lg:grid-cols-6` at `InventoryDetailPage.tsx:581`. Removing one cell leaves the grid with an empty slot rather than reflowing to fill the gap — acceptable and not worth a dynamic column-count calculation for one staff-only edge case.)

- [ ] **Step 4: Hide the Profit This Month card**

At `InventoryDetailPage.tsx:776-783`, replace:

```tsx
                {/* 2. Profit This Month */}
                <div className="flex-none w-28 bg-[#F4F7FB] border border-[#E5EDF6] rounded-[18px] p-3.5 text-center flex flex-col items-center justify-center shadow-sm">
                   <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[11px] mb-2">₹</div>
                   <span className="text-[10px] font-medium text-slate-500 mb-1 leading-tight">Profit This Mth</span>
                   <span className="text-sm font-black text-blue-600 leading-none mt-auto">
                     ₹{(((inventory.selling_price || 0) - (inventory.cost_price || 0)) * (selectedMonthData ? selectedMonthData.sold : 0)).toLocaleString()}
                   </span>
                </div>
```

with:

```tsx
                {/* 2. Profit This Month */}
                {canViewCostPrice && (
                  <div className="flex-none w-28 bg-[#F4F7FB] border border-[#E5EDF6] rounded-[18px] p-3.5 text-center flex flex-col items-center justify-center shadow-sm">
                     <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[11px] mb-2">₹</div>
                     <span className="text-[10px] font-medium text-slate-500 mb-1 leading-tight">Profit This Mth</span>
                     <span className="text-sm font-black text-blue-600 leading-none mt-auto">
                       ₹{(((inventory.selling_price || 0) - (inventory.cost_price || 0)) * (selectedMonthData ? selectedMonthData.sold : 0)).toLocaleString()}
                     </span>
                  </div>
                )}
```

(This is one card in a horizontally-scrolling `flex` row of independent cards — the "1. Sold This Month" and "3. Total Purchased" cards are unaffected siblings.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 6: Manual verification against the test dealer**

1. Edit Yash: Inventory → Visible, "View Cost Price / Margin" → Hidden. Save.
2. As Yash, open an inventory item's detail page. Confirm: no "Cost" badge in the header, no "Cost" cell in the stock-summary card, no "Profit This Mth" card in the quick-stats row. Selling price, stock value, and the other stats still show normally.
3. Set "View Cost Price / Margin" → Visible for Yash. Confirm all three reappear with correct values.

- [ ] **Step 7: Commit**

```bash
git add src/features/inventory/pages/InventoryDetailPage.tsx
git commit -m "feat(staff): gate cost price and margin display behind inventoryViewCostPrice permission"
```

---

### Task 8: Enforce "Adjust Stock Manually"

**Files:**
- Modify: `src/features/inventory/pages/InventoryDetailPage.tsx`
- Modify: `src/features/inventory/components/InventoryList.tsx`

**Interfaces:**
- Consumes: `getStaffFeatureMode`, `'inventoryAdjustStock'` key

Two separate trigger points: the "Adjust Stock" button on the detail page (line 522-529), and the inline table-row icon button in the desktop inventory list (`InventoryList.tsx:371-381`). The mobile card grid has no adjust-stock quick action today (verified — only the desktop table row has it), so nothing to change there.

- [ ] **Step 1: Compute the flag in InventoryDetailPage.tsx**

Right after the `canViewCostPrice` line added in Task 7 Step 1, add:

```ts
  const canAdjustStock = getStaffFeatureMode('inventoryAdjustStock', currentStaff?.permissions, !!currentStaff) === 'visible';
```

- [ ] **Step 2: Gate the detail-page Adjust Stock button**

At `InventoryDetailPage.tsx:522-529`, replace:

```tsx
            <Button
              className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/30 font-semibold h-12 rounded-xl"
              fullWidth
              onClick={() => setIsAdjustOpen(true)}
              leftIcon={<Boxes className="h-5 w-5 opacity-80" />}
            >
              Adjust Stock
            </Button>
```

with:

```tsx
            {canAdjustStock && (
              <Button
                className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/30 font-semibold h-12 rounded-xl"
                fullWidth
                onClick={() => setIsAdjustOpen(true)}
                leftIcon={<Boxes className="h-5 w-5 opacity-80" />}
              >
                Adjust Stock
              </Button>
            )}
```

(Sibling of the Add Stock and Edit buttons inside the same `action={ <div className="grid grid-cols-2 gap-3 ..."> }` block — same pattern as Task 6 Step 4.)

- [ ] **Step 3: Gate the InventoryList.tsx table-row button**

In `src/features/inventory/components/InventoryList.tsx`, add the staff-permission imports near the top:

```ts
import { useStaffStore } from '@/stores/staffStore';
import { getStaffFeatureMode } from '@/lib/staffAccess';
```

Then, inside the `InventoryList` component body (right after `const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);` at line 23), add:

```ts
  const currentStaff = useStaffStore((s) => s.currentStaff);
  const canAdjustStock = getStaffFeatureMode('inventoryAdjustStock', currentStaff?.permissions, !!currentStaff) === 'visible';
```

Then at `InventoryList.tsx:369-383`, replace:

```tsx
                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button 
                        type="button"
                        className="inline-flex p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                        title="Adjust Stock"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAdjustingItem(item);
                        }}
                      >
                        <Boxes className="w-5 h-5 opacity-80" />
                      </button>
                    </div>
                  </td>
```

with:

```tsx
                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {canAdjustStock && (
                        <button
                          type="button"
                          className="inline-flex p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                          title="Adjust Stock"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAdjustingItem(item);
                          }}
                        >
                          <Boxes className="w-5 h-5 opacity-80" />
                        </button>
                      )}
                    </div>
                  </td>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 5: Manual verification against the test dealer**

1. Edit Yash: Inventory → Visible, "Adjust Stock Manually" → Hidden. Save.
2. As Yash, open the inventory list (desktop width). Confirm the per-row "Adjust Stock" icon is gone. Open an item's detail page — confirm the "Adjust Stock" button is gone too.
3. Set "Adjust Stock Manually" → Visible for Yash. Confirm both reappear and opening the modal still works.

- [ ] **Step 6: Commit**

```bash
git add src/features/inventory/pages/InventoryDetailPage.tsx src/features/inventory/components/InventoryList.tsx
git commit -m "feat(staff): gate manual stock adjustment behind inventoryAdjustStock permission"
```

---

### Task 9: Enforce "Delete Product"

**Files:**
- Modify: `src/features/inventory/pages/InventoryDetailPage.tsx`

**Interfaces:**
- Consumes: `getStaffFeatureMode`, `'inventoryDeleteProduct'` key

Only one trigger point is actually reachable in the app today (`InventoryDetailPage.tsx:1323` — `ManageProductModal.tsx` also has a delete button, but it's confirmed dead code, never imported anywhere in `src/`, so there is nothing to change there).

- [ ] **Step 1: Compute the flag**

Right after the `canAdjustStock` line added in Task 8 Step 1, add:

```ts
  const canDeleteProduct = getStaffFeatureMode('inventoryDeleteProduct', currentStaff?.permissions, !!currentStaff) === 'visible';
```

- [ ] **Step 2: Gate the Delete Product button**

At `InventoryDetailPage.tsx:1312-1327`, replace:

```tsx
      <section className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/60 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-base font-extrabold text-rose-700">
              <Trash2 className="h-5 w-5" />
              Delete Product
            </div>
            <p className="mt-1 max-w-2xl text-sm font-medium text-rose-600">
              Remove this product from active stock. If sales or purchase history exists, it will be archived to keep records intact.
            </p>
          </div>
          <Button variant="outline" className="border-rose-200 bg-white text-rose-700 hover:bg-rose-100" onClick={() => setIsDeleteOpen(true)}>
            Delete Product
          </Button>
        </div>
      </section>
```

with (only the `<Button>` is conditional — the warning copy above it stays visible either way, as a smaller diff that still fully prevents the action):

```tsx
      <section className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/60 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-base font-extrabold text-rose-700">
              <Trash2 className="h-5 w-5" />
              Delete Product
            </div>
            <p className="mt-1 max-w-2xl text-sm font-medium text-rose-600">
              Remove this product from active stock. If sales or purchase history exists, it will be archived to keep records intact.
            </p>
          </div>
          {canDeleteProduct && (
            <Button variant="outline" className="border-rose-200 bg-white text-rose-700 hover:bg-rose-100" onClick={() => setIsDeleteOpen(true)}>
              Delete Product
            </Button>
          )}
        </div>
      </section>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 4: Manual verification against the test dealer**

Use a throwaway product for this one — deletion is real, even if the underlying `delete_product` RPC archives rather than hard-deletes when history exists.

1. In `/inventory`, add a brand-new test product with zero sales/purchase history via "New Product", so it's safe to actually delete.
2. Edit Yash: Inventory → Visible, "Delete Product" → Hidden. Save.
3. As Yash, open that test product's detail page, scroll to the danger-zone section at the bottom. Confirm the "Delete Product" button is gone (the warning text can still show).
4. Set "Delete Product" → Visible for Yash. Confirm the button reappears and deleting the test product still works end-to-end.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventory/pages/InventoryDetailPage.tsx
git commit -m "feat(staff): gate product deletion behind inventoryDeleteProduct permission"
```

---

## What's deliberately out of scope here

- **Suppliers/Purchases, Billing, Farmers, Cashbook/Expenses, Reports** modules from the original 6-module table — same recipe (Tasks 1-4's pattern), separate plan once this one ships and the pattern's proven.
- Splitting "Record purchase" (a future Suppliers permission) from "Add/receive stock" (`inventoryAddStock`, this plan) — today they are the literal same route/RPC (`/purchases/new`), so this plan intentionally keeps them as one permission. If a future Suppliers module plan wants "record purchase" to be a distinct concept, it will need to decide whether `/purchases/new` requires one key or both (AND), which is a design call for that plan, not this one.
- Masking `cost_price` inside `EditInventoryModal`/the per-lot editor for a staff member who can edit price but can't view cost (today, `inventoryEditPrice: visible` + `inventoryViewCostPrice: hidden` together means that staff member can still see cost_price *inside* the edit form, just not on the read-only detail page). Flagged as a real gap, not silently handled.
- `ManageProductModal.tsx` is dead code (unused anywhere in `src/`) — left untouched. Worth a separate cleanup, not part of this plan.
