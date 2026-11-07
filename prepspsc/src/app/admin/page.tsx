import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, FileQuestion, TrendingUp, Home } from "lucide-react";

export default async function AdminDashboard() {
  const supabase = await createClient();

  // Get current user's role
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id)
    .single();

  const isAdmin = profile?.role === "admin";

  // Fetch stats (admins see all, teachers see limited)
  const [usersResult, testsResult, questionsResult, attemptsResult, roomsResult] = await Promise.all([
    isAdmin ? supabase.from("profiles").select("id", { count: "exact", head: true }) : Promise.resolve({ count: 0 }),
    isAdmin ? supabase.from("tests").select("id", { count: "exact", head: true }) : Promise.resolve({ count: 0 }),
    isAdmin ? supabase.from("questions").select("id", { count: "exact", head: true }) : Promise.resolve({ count: 0 }),
    isAdmin ? supabase.from("test_attempts").select("id", { count: "exact", head: true }).eq("status", "completed") : Promise.resolve({ count: 0 }),
    supabase.from("rooms").select("id", { count: "exact", head: true }),
  ]);

  // Admin stats
  const adminStats = [
    {
      title: "Total Users",
      value: usersResult.count || 0,
      icon: Users,
      color: "text-primary",
    },
    {
      title: "Total Tests",
      value: testsResult.count || 0,
      icon: BookOpen,
      color: "text-accent",
    },
    {
      title: "Total Questions",
      value: questionsResult.count || 0,
      icon: FileQuestion,
      color: "text-chart-4",
    },
    {
      title: "Tests Completed",
      value: attemptsResult.count || 0,
      icon: TrendingUp,
      color: "text-chart-5",
    },
  ];

  // Teacher stats (limited view)
  const teacherStats = [
    {
      title: "Study Halls",
      value: roomsResult.count || 0,
      icon: Home,
      color: "text-primary",
    },
  ];

  const stats = isAdmin ? adminStats : teacherStats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isAdmin ? "Admin" : "Teacher"} Dashboard</h1>
        <p className="text-muted-foreground">
          {isAdmin ? "Overview of your PrepSPSC platform" : "Manage your study halls"}
        </p>
      </div>

      {/* Stats Grid */}
      <div className={`grid gap-4 ${isAdmin ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2"}`}>
        {stats.map((stat) => (
          <Card key={stat.title} className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions - Admin only */}
      {isAdmin && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <a
                href="/admin/tests"
                className="block p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
              >
                Create New Test
              </a>
              <a
                href="/admin/questions"
                className="block p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
              >
                Add Questions
              </a>
              <a
                href="/admin/users"
                className="block p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
              >
                Manage Users
              </a>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Teacher quick link to Study Halls */}
      {!isAdmin && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Get Started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <a
                href="/admin/study-halls"
                className="block p-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
              >
                Manage Study Halls
              </a>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
