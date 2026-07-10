/**
 * In-memory holders for the staff and admin session tokens minted by
 * staff_portal_login / admin_login. The Supabase client attaches them to every
 * request as x-staff-token / x-admin-token headers; the database resolves the
 * header to a validated session (see migration 20260710000004).
 *
 * The stores (staffStore / adminAuthStore) are the source of truth and push
 * tokens here on login, logout, and persist rehydration.
 */

let staffSessionToken: string | null = null;
let adminSessionToken: string | null = null;

export const setStaffSessionToken = (token: string | null): void => {
  staffSessionToken = token || null;
};

export const getStaffSessionToken = (): string | null => staffSessionToken;

export const setAdminSessionToken = (token: string | null): void => {
  adminSessionToken = token || null;
};

export const getAdminSessionToken = (): string | null => adminSessionToken;
