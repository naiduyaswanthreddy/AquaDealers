# Robustness Features Implementation Plan

This plan addresses the 13 robustness features requested to make the AquaDealers application more resilient, user-friendly, and enterprise-ready.

## Current State Assessment

1. **Pagination**: Partially implemented client-side (`useLoadMoreList.ts`). True server-side Supabase cursor pagination is missing.
2. **Indexed queries**: Missing explicit PostgreSQL index definitions for common filtered queries.
3. **Server-side filtering**: Missing robust implementation; much filtering is done client-side.
4. **Archival strategy**: Missing. Old records clutter active views.
5. **Wrong entries handling**: Missing edit flows for past transactions.
6. **Network loss handling**: Missing. Supabase standard JS client used without offline mutation queuing.
7. **Duplicate clicks**: **Implemented**. `isSubmitting` wired to `Button` loading/disabled states.
8. **Angry staff**: Missing. No cooldowns or soft-locks on rapid destructive actions.
9. **Partial sync**: Missing. No conflict resolution strategy (e.g., versioning).
10. **Accidental deletes**: Missing. Using raw DB deletes instead of soft deletes, lacking undo functionality.
11. **Month-end confusion**: Partially implemented (`DateRangeFilter` exists). Needs clear boundary logic.
12. **Low-literacy usage**: Partially implemented. Needs more color-coded Badges and explicit iconography.
13. **Empty states**: **Implemented**. `EmptyState` used consistently.

## Proposed Changes

We will implement the missing and incomplete features in phases:

### Phase 1: Database & API Hardening

#### [MODIFY] supabase database schema (SQL)
- Add `deleted_at` timestamp to all major tables for soft deletes.
- Add `status` field including 'archived' state for old records.
- Add `version` integer for conflict resolution during partial sync.
- Create explicit PostgreSQL indexes (via Supabase SQL Editor/Migrations) for frequently filtered/sorted columns.

#### [MODIFY] src/lib/supabase.ts
- Add wrapper functions for standard CRUD operations that respect `deleted_at` (soft deletes).

### Phase 2: Server-side Filtering & Pagination

#### [MODIFY] src/features/*/services/*Service.ts
- Update data fetching services to use Supabase range queries (`.range()`) for pagination instead of returning all rows.
- Implement robust `.ilike()` and `.eq()` server-side filters.

#### [MODIFY] src/lib/useLoadMoreList.ts
- Refactor to accept an async fetch function and support true server-side offset/cursor pagination.

### Phase 3: Offline Handling & Sync

#### [NEW] src/lib/offlineQueue.ts
- Implement a local mutation queue (using IndexedDB) to store actions when offline.
- Add network listeners to flush the queue when coming back online.

#### [NEW] src/lib/syncService.ts
- Implement conflict resolution logic (checking the `version` field) to handle partial sync safely.

### Phase 4: UI / UX Enhancements

#### [MODIFY] src/components/ui/Button.tsx
- Add rate-limiting/cooldown logic to dangerous actions (prevent "angry staff" rapid clicking).

#### [NEW] src/components/ui/ConfirmDialog.tsx
- Create a reusable, friendly confirmation dialog for destructive actions, replacing `window.confirm`.

#### [MODIFY] src/components/ui/DateRangeFilter.tsx
- Enhance to explicitly handle month boundaries (e.g., adding "End of Month" visual cues).

#### [MODIFY] src/features/* (Various Pages)
- Add "Edit" actions to past transactions (Wrong entries handling).
- Increase icon usage and color coding for states (Low-literacy usage).

## Verification Plan

- Go offline (DevTools network tab) and try to submit a form, verify it queues, then reconnect and verify sync.
- Verify `isSubmitting` blocks double clicks.
- Check that deleting a record sets `deleted_at` instead of removing the row.
- Verify that old data can be archived and doesn't appear in default active lists.
- Check paginated lists with > 50 items to ensure server-side filtering works correctly.
