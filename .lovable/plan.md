## Why the preview is blank

`src/lib/supabase.ts` throws at module load when `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing. The project was cloned from GitHub without a `.env`, so the throw happens during `main.tsx` import, React never mounts, and the HTML splash screen stays on screen forever. Console confirms: no React activity, only a 401 on `manifest.json` and the Vite HMR handshake.

## Plan

### 1. Enable Lovable Cloud
Activate Cloud for this project. This auto-provisions a Supabase-backed backend and injects `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (and `VITE_SUPABASE_PUBLISHABLE_KEY`) into the Vite env, which is exactly what `src/lib/supabase.ts` is reading. The supabase client will construct successfully and React will mount.

### 2. Make `supabase.ts` resilient
Soften the hard `throw` so a missing env produces a clear console error and a stub client instead of a white-splash hang. This protects against future env hiccups.

### 3. Confirm the app boots
Reload the preview and verify the Landing page renders. We expect runtime errors from features that hit tables that don't exist yet (admin_users, dealers, branches, profiles, plans, etc.) — those are expected and tracked separately.

### 4. Decide what to build next (separate step, will ask you after preview is live)
The AquaDealer backend is large (dealers, branches, staff, farmers, inventory, billing, suppliers, expenses, subscriptions, admin portal, RPCs like `admin_login`). We will not try to recreate all of it at once. Once the preview loads, I'll ask which slice you want to bring up first (e.g. auth + landing, or dashboard mocks, or admin portal).

### What I will NOT do in this step
- Recreate the full Supabase schema / RLS / RPCs from the original repo
- Touch auth flow, admin portal logic, or any feature code
- Replace React Router with TanStack Router (the project is already React 18 + React Router + Vite, which matches our stack — no migration needed)

### Technical notes
- File touched: `src/lib/supabase.ts` only
- New service enabled: Lovable Cloud
- No package changes
- The PWA service worker (`/sw.js`) and manifest 401 are unrelated to the blank screen and can stay as-is
