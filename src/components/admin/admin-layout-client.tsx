"use client";

import { useState, useEffect } from "react";
import { AdminSidebar } from "./admin-sidebar";

interface AdminLayoutClientProps {
  role: string;
  children: React.ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = "admin-sidebar-collapsed";

export function AdminLayoutClient({ role, children }: AdminLayoutClientProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored !== null) {
      setIsCollapsed(stored === "true");
    }
    setMounted(true);
  }, []);

  // Save collapsed state to localStorage
  const toggleCollapsed = () => {
    const newValue = !isCollapsed;
    setIsCollapsed(newValue);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newValue));
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex overflow-x-hidden">
        <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border p-4" />
        <main className="flex-1 p-6 ml-64 overflow-x-hidden">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden">
      <AdminSidebar
        role={role}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapsed}
      />
      <main
        className={`flex-1 p-6 overflow-x-hidden transition-[margin-left] duration-300 ${
          isCollapsed ? "ml-16" : "ml-64"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
