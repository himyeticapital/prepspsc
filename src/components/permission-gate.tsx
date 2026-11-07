"use client";

import { ReactNode } from "react";
import { usePermissions, Permission } from "@/hooks/use-permissions";

interface PermissionGateProps {
  /** Single permission required */
  permission?: Permission;
  /** Multiple permissions - user needs ANY of these */
  anyOf?: Permission[];
  /** Multiple permissions - user needs ALL of these */
  allOf?: Permission[];
  /** Content to show if user has permission */
  children: ReactNode;
  /** Content to show if user doesn't have permission (optional) */
  fallback?: ReactNode;
  /** If true, show loading state while checking permissions */
  showLoading?: boolean;
}

/**
 * Conditionally renders content based on user permissions.
 *
 * Usage examples:
 *
 * // Single permission
 * <PermissionGate permission={PERMISSIONS.UPLOAD_QUESTIONS}>
 *   <UploadButton />
 * </PermissionGate>
 *
 * // Any of multiple permissions
 * <PermissionGate anyOf={[PERMISSIONS.CREATE_TESTS, PERMISSIONS.EDIT_TESTS]}>
 *   <TestManager />
 * </PermissionGate>
 *
 * // All permissions required
 * <PermissionGate allOf={[PERMISSIONS.CREATE_ROOMS, PERMISSIONS.MODERATE_CHAT]}>
 *   <RoomAdmin />
 * </PermissionGate>
 *
 * // With fallback
 * <PermissionGate permission={PERMISSIONS.VIEW_ANALYTICS} fallback={<AccessDenied />}>
 *   <Analytics />
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  anyOf,
  allOf,
  children,
  fallback = null,
  showLoading = false,
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } =
    usePermissions();

  if (isLoading && showLoading) {
    return null;
  }

  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (anyOf && anyOf.length > 0) {
    hasAccess = hasAnyPermission(anyOf);
  } else if (allOf && allOf.length > 0) {
    hasAccess = hasAllPermissions(allOf);
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

/**
 * Hook-based alternative for more complex permission logic
 */
export { usePermissions, PERMISSIONS } from "@/hooks/use-permissions";
export type { Permission };
