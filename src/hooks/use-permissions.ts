"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Permission, PERMISSIONS } from "@/lib/permissions";

interface UsePermissionsResult {
  permissions: Permission[];
  role: string | null;
  isAdmin: boolean;
  isTeacher: boolean;
  isLoading: boolean;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  refetch: () => Promise<void>;
}

export function usePermissions(): UsePermissionsResult {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPermissions([]);
        setRole(null);
        setIsLoading(false);
        return;
      }

      // Fetch user profile with role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, permissions")
        .eq("id", user.id)
        .single();

      if (profile) {
        setRole(profile.role);
        // Use cached permissions from profile if available
        if (profile.permissions && Array.isArray(profile.permissions)) {
          setPermissions(profile.permissions as Permission[]);
        } else {
          // Fallback to fetching from user_permissions table
          const { data: userPermissions } = await supabase
            .from("user_permissions")
            .select("permission")
            .eq("user_id", user.id);

          if (userPermissions) {
            setPermissions(
              userPermissions.map((p) => p.permission as Permission)
            );
          }
        }
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const isAdmin = role === "admin";
  const isTeacher = role === "teacher";

  // Admins have all permissions
  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      if (isAdmin) return true;
      return permissions.includes(permission);
    },
    [isAdmin, permissions]
  );

  const hasAnyPermission = useCallback(
    (permissionsToCheck: Permission[]): boolean => {
      if (isAdmin) return true;
      return permissionsToCheck.some((p) => permissions.includes(p));
    },
    [isAdmin, permissions]
  );

  const hasAllPermissions = useCallback(
    (permissionsToCheck: Permission[]): boolean => {
      if (isAdmin) return true;
      return permissionsToCheck.every((p) => permissions.includes(p));
    },
    [isAdmin, permissions]
  );

  return {
    permissions,
    role,
    isAdmin,
    isTeacher,
    isLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refetch: fetchPermissions,
  };
}

// Export permission constants for convenience
export { PERMISSIONS };
export type { Permission };
