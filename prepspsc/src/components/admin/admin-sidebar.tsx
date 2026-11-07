"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { createClient, resetClient } from "@/lib/supabase/client";
import { PERMISSIONS } from "@/lib/permissions";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileQuestion,
  MessageSquare,
  MessageSquarePlus,
  BarChart3,
  ArrowLeft,
  Shield,
  Home,
  ShieldAlert,
  LogOut,
  Loader2,
  Brain,
} from "lucide-react";

interface AdminSidebarProps {
  role: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  // Permissions required for teachers (any of these grants access)
  requiredPermissions?: string[];
}

const navItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/admin/study-halls",
    label: "Study Halls",
    icon: Home,
    requiredPermissions: [PERMISSIONS.CREATE_ROOMS, PERMISSIONS.EDIT_ROOMS, PERMISSIONS.DELETE_ROOMS],
  },
  {
    href: "/admin/moderation",
    label: "Moderation",
    icon: ShieldAlert,
    adminOnly: true,
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: Users,
    adminOnly: true,
  },
  {
    href: "/admin/tests",
    label: "Tests",
    icon: BookOpen,
    adminOnly: true,
    requiredPermissions: [PERMISSIONS.CREATE_TESTS, PERMISSIONS.EDIT_TESTS, PERMISSIONS.DELETE_TESTS],
  },
  {
    href: "/admin/questions",
    label: "Questions",
    icon: FileQuestion,
    adminOnly: true,
    requiredPermissions: [PERMISSIONS.UPLOAD_QUESTIONS, PERMISSIONS.EDIT_QUESTIONS, PERMISSIONS.DELETE_QUESTIONS],
  },
  {
    href: "/admin/chat",
    label: "Chat Moderation",
    icon: MessageSquare,
    adminOnly: true,
    requiredPermissions: [PERMISSIONS.MODERATE_CHAT, PERMISSIONS.DELETE_MESSAGES],
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    icon: BarChart3,
    adminOnly: true,
    requiredPermissions: [PERMISSIONS.VIEW_ANALYTICS],
  },
  {
    href: "/admin/ai-management",
    label: "AI Management",
    icon: Brain,
    adminOnly: true,
  },
  {
    href: "/admin/feedback",
    label: "Feedback",
    icon: MessageSquarePlus,
    adminOnly: true,
  },
];

export function AdminSidebar({ role }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = role === "admin";
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(!isAdmin);

  // Fetch user permissions for teachers
  useEffect(() => {
    if (isAdmin) {
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from("user_permissions")
          .select("permission")
          .eq("user_id", user.id);

        setUserPermissions(data?.map(p => p.permission) || []);
      }
      setLoading(false);
    };

    fetchPermissions();
  }, [isAdmin]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    resetClient();
    window.location.href = "/admin-auth/login";
  };

  // Check if user has any of the required permissions
  const hasPermission = (requiredPermissions?: string[]) => {
    if (!requiredPermissions || requiredPermissions.length === 0) return true;
    return requiredPermissions.some(perm => userPermissions.includes(perm));
  };

  // Filter nav items based on role and permissions
  const filteredItems = navItems.filter((item) => {
    // Admins see everything
    if (isAdmin) return true;

    // For teachers: items with adminOnly require explicit permissions
    if (item.adminOnly) {
      // If there are required permissions, check if teacher has any of them
      if (item.requiredPermissions && item.requiredPermissions.length > 0) {
        return hasPermission(item.requiredPermissions);
      }
      // No permissions defined for admin-only item = hidden from teachers
      return false;
    }

    // Items without permission requirements are visible to all teachers
    if (!item.requiredPermissions) return true;

    // Check if teacher has required permissions
    return hasPermission(item.requiredPermissions);
  });

  if (loading) {
    return (
      <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border p-4 flex flex-col items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </aside>
    );
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border p-4 flex flex-col">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-6 h-6 text-primary" />
          <span className="text-xl font-bold gradient-text">Admin Panel</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {isAdmin ? "Administrator" : "Teacher"}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {filteredItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Back to App */}
      <Link
        href="/dashboard"
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to App
      </Link>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors mt-2"
      >
        <LogOut className="w-5 h-5" />
        Log Out
      </button>
    </aside>
  );
}
