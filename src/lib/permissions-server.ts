import { createClient } from "@/lib/supabase/server";
import { Permission } from "@/lib/permissions";

interface UserPermissionData {
  userId: string;
  role: string;
  permissions: Permission[];
  isAdmin: boolean;
  isTeacher: boolean;
}

/**
 * Get the current user's permissions (server-side)
 */
export async function getCurrentUserPermissions(): Promise<UserPermissionData | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, permissions")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return null;
  }

  const permissions = (profile.permissions as Permission[]) || [];

  return {
    userId: user.id,
    role: profile.role,
    permissions,
    isAdmin: profile.role === "admin",
    isTeacher: profile.role === "teacher",
  };
}

/**
 * Check if the current user has a specific permission (server-side)
 */
export async function checkPermission(
  permission: Permission
): Promise<boolean> {
  const userData = await getCurrentUserPermissions();

  if (!userData) {
    return false;
  }

  // Admins have all permissions
  if (userData.isAdmin) {
    return true;
  }

  return userData.permissions.includes(permission);
}

/**
 * Check if the current user has any of the specified permissions (server-side)
 */
export async function checkAnyPermission(
  permissions: Permission[]
): Promise<boolean> {
  const userData = await getCurrentUserPermissions();

  if (!userData) {
    return false;
  }

  // Admins have all permissions
  if (userData.isAdmin) {
    return true;
  }

  return permissions.some((p) => userData.permissions.includes(p));
}

/**
 * Check if the current user has all of the specified permissions (server-side)
 */
export async function checkAllPermissions(
  permissions: Permission[]
): Promise<boolean> {
  const userData = await getCurrentUserPermissions();

  if (!userData) {
    return false;
  }

  // Admins have all permissions
  if (userData.isAdmin) {
    return true;
  }

  return permissions.every((p) => userData.permissions.includes(p));
}

/**
 * Require a specific permission - throws if not authorized
 */
export async function requirePermission(permission: Permission): Promise<void> {
  const hasPermission = await checkPermission(permission);

  if (!hasPermission) {
    throw new Error(`Permission denied: ${permission}`);
  }
}

/**
 * Require any of the specified permissions - throws if not authorized
 */
export async function requireAnyPermission(
  permissions: Permission[]
): Promise<void> {
  const hasPermission = await checkAnyPermission(permissions);

  if (!hasPermission) {
    throw new Error(
      `Permission denied: requires one of ${permissions.join(", ")}`
    );
  }
}

/**
 * Require all of the specified permissions - throws if not authorized
 */
export async function requireAllPermissions(
  permissions: Permission[]
): Promise<void> {
  const hasPermission = await checkAllPermissions(permissions);

  if (!hasPermission) {
    throw new Error(`Permission denied: requires all of ${permissions.join(", ")}`);
  }
}
