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
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Key,
  Bot,
} from "lucide-react";

interface AdminSidebarProps {
  role: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
    href: "/admin/exams",
    label: "Exams",
    icon: GraduationCap,
    adminOnly: true,
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
    href: "/admin/feedback",
    label: "Feedback",
    icon: MessageSquarePlus,
    adminOnly: true,
  },
  {
    href: "/admin/api-keys",
    label: "API Keys",
    icon: Key,
    adminOnly: true,
  },
  {
    href: "/admin/bot-users",
    label: "Bot Users",
    icon: Bot,
    adminOnly: true,
  },
];

export function AdminSidebar({ role, isCollapsed = false, onToggleCollapse }: AdminSidebarProps) {
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
      <aside className={cn(
        "fixed left-0 top-0 h-screen bg-card border-r border-border p-4 flex flex-col items-center justify-center transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </aside>
    );
  }

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-card border-r border-border p-4 flex flex-col transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Toggle Button */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="absolute -right-3 top-6 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors z-10"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      )}

      {/* Header */}
      <div className={cn("mb-8", isCollapsed && "flex flex-col items-center")}>
        <div className={cn("flex items-center gap-2 mb-2", isCollapsed && "justify-center")}>
          <Shield className="w-6 h-6 text-primary flex-shrink-0" />
          {!isCollapsed && <span className="text-xl font-bold gradient-text">Admin Panel</span>}
        </div>
        {!isCollapsed && (
          <p className="text-xs text-muted-foreground">
            {isAdmin ? "Administrator" : "Teacher"}
          </p>
        )}
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
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                isCollapsed && "justify-center px-2"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* Back to App */}
      <Link
        href="/dashboard"
        title={isCollapsed ? "Back to App" : undefined}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors",
          isCollapsed && "justify-center px-2"
        )}
      >
        <ArrowLeft className="w-5 h-5 flex-shrink-0" />
        {!isCollapsed && "Back to App"}
      </Link>

      {/* Logout */}
      <button
        onClick={handleLogout}
        title={isCollapsed ? "Log Out" : undefined}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors mt-2",
          isCollapsed && "justify-center px-2"
        )}
      >
        <LogOut className="w-5 h-5 flex-shrink-0" />
        {!isCollapsed && "Log Out"}
      </button>
    </aside>
  );
}
