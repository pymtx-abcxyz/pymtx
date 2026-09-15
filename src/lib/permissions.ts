import {
  UserRole,
  isBusinessStaffRole,
  normalizeUserRole,
} from "./domain";
import type { AuthUser } from "./auth";

/** Business portal staff roles (after normalizing legacy BUSINESS → OWNER). */
export function businessStaffRoles(): UserRole[] {
  return [UserRole.OWNER, UserRole.CLERK, UserRole.BUSINESS];
}

export function canAccessBusiness(user: AuthUser, businessId: string): boolean {
  const role = normalizeUserRole(user.role);
  if (role === UserRole.ADMIN) return true;
  return isBusinessStaffRole(role) && user.businessId === businessId;
}

/** Stripe Connect onboarding / login links. */
export function canManageConnect(user: AuthUser): boolean {
  const role = normalizeUserRole(user.role);
  return role === UserRole.ADMIN || role === UserRole.OWNER;
}

/** Invite / remove clerks. */
export function canManageStaff(user: AuthUser): boolean {
  const role = normalizeUserRole(user.role);
  return role === UserRole.ADMIN || role === UserRole.OWNER;
}

/** CSV / invoice upload. */
export function canUploadInvoices(user: AuthUser): boolean {
  const role = normalizeUserRole(user.role);
  return (
    role === UserRole.ADMIN ||
    role === UserRole.OWNER ||
    role === UserRole.CLERK
  );
}

/** Read invoices / aging. */
export function canViewInvoices(user: AuthUser): boolean {
  return canUploadInvoices(user);
}

export function forbidden(message = "Forbidden"): Response {
  return Response.json({ error: message }, { status: 403 });
}
