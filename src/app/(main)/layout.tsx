import { BackgroundLayer } from "@/components/layout/background-layer";
import { OtakufyNavbar } from "@/components/layout/otakufy-navbar";
import { SidebarDock } from "@/components/layout/sidebar-dock";
import { MobileNav } from "@/components/layout/mobile-nav";
import { MobileHeader } from "@/components/layout/mobile-header";
import { WidgetPortal } from "@/components/widgets/widget-portal";
import { RevisionCheckerProvider } from "@/components/providers/revision-checker-provider";
import { StatusNoteProvider } from "@/components/providers/status-note-provider";
import { NewsBot } from "@/components/news/news-bot";
import { createClient } from "@/lib/supabase/server";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated users see landing page without app shell
  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden w-full max-w-full">
      {/* Study AI Revision Checker */}
      <RevisionCheckerProvider />

      {/* Status Notes (Instagram Notes-like) */}
      <StatusNoteProvider />

      {/* Full-screen background */}
      <BackgroundLayer />

      {/* Mobile Header with Logo (mobile only) */}
      <MobileHeader />

      {/* Desktop Navigation */}
      <OtakufyNavbar className="hidden md:flex" />

      {/* Left Sidebar Dock (Desktop only) */}
      <SidebarDock className="hidden md:flex" />

      {/* Main Content */}
      <main className="relative z-10 md:pl-20 pt-16 pb-24 md:pb-6 min-h-screen overflow-hidden w-full">
        <div className="w-full max-w-full px-4 py-6 overflow-x-hidden mx-auto">
          {children}
        </div>
      </main>

      {/* Widget Portal - Floating widgets */}
      <WidgetPortal />

      {/* Current Affairs Bot - Floating button */}
      <NewsBot />

      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  );
}
