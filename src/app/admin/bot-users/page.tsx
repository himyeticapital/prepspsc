import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Bot, Crown, Flame, MessageCircle, Phone, Users } from "lucide-react";

interface BotConnection {
  id: string;
  user_id: string;
  platform: string;
  platform_user_id: string;
  username: string | null;
  is_active: boolean;
  connected_at: string;
  last_interaction_at: string;
  notification_preferences: {
    morning_reminder?: boolean;
    evening_nudge?: boolean;
    streak_alerts?: boolean;
    daily_summary?: boolean;
  } | null;
  profiles: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    phone_number: string | null;
    current_streak: number;
    max_streak: number;
    is_pro_member: boolean;
    total_minutes_all_time: number;
    created_at: string;
  } | null;
  incoming_count: number;
  outgoing_count: number;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remaining = mins % 60;
  if (hours < 24) return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

export default async function BotUsersPage() {
  const supabase = await createClient();

  // Verify admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return <div className="p-6 text-muted-foreground">Unauthorized</div>;
  }

  // Use service role client to bypass RLS for admin queries
  const adminDb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch bot connections with full profile data
  const { data: connections } = await adminDb
    .from("bot_connections")
    .select(
      "*, profiles(full_name, username, avatar_url, current_streak, max_streak, is_pro_member, total_minutes_all_time, created_at, profile_private(phone_number))"
    )
    .order("last_interaction_at", { ascending: false });

  // Fetch message counts per connection (both directions)
  const { data: messageCounts } = await adminDb
    .from("bot_messages")
    .select("connection_id, direction");

  // Count messages per connection by direction
  const incomingMap: Record<string, number> = {};
  const outgoingMap: Record<string, number> = {};
  messageCounts?.forEach((m) => {
    if (m.direction === "incoming") {
      incomingMap[m.connection_id] = (incomingMap[m.connection_id] || 0) + 1;
    } else {
      outgoingMap[m.connection_id] = (outgoingMap[m.connection_id] || 0) + 1;
    }
  });

  const botUsers: BotConnection[] = (connections || []).map((c) => {
    // Phone numbers live in profile_private (one row per profile)
    const priv = c.profiles?.profile_private;
    const phone = (Array.isArray(priv) ? priv[0] : priv)?.phone_number ?? null;
    return {
      ...c,
      profiles: c.profiles ? { ...c.profiles, phone_number: phone } : null,
      incoming_count: incomingMap[c.id] || 0,
      outgoing_count: outgoingMap[c.id] || 0,
    };
  });

  const totalUsers = botUsers.length;
  const activeToday = botUsers.filter((u) => {
    const lastActive = new Date(u.last_interaction_at);
    const today = new Date();
    return lastActive.toDateString() === today.toDateString();
  }).length;
  const proUsers = botUsers.filter((u) => u.profiles?.is_pro_member).length;
  const totalIncoming = Object.values(incomingMap).reduce((a, b) => a + b, 0);
  const totalOutgoing = Object.values(outgoingMap).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bot Users</h1>
        <p className="text-muted-foreground">
          Telegram bot connections and activity
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Connected Users
            </CardTitle>
            <Users className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalUsers}</div>
            {proUsers > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {proUsers} pro member{proUsers !== 1 ? "s" : ""}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Today
            </CardTitle>
            <Bot className="w-5 h-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeToday}</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Messages In
            </CardTitle>
            <MessageCircle className="w-5 h-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalIncoming}</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Messages Out
            </CardTitle>
            <MessageCircle className="w-5 h-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalOutgoing}</div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">All Bot Connections</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>TG Username</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Streak</TableHead>
                <TableHead>Study Time</TableHead>
                <TableHead>Notifications</TableHead>
                <TableHead>Connected</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {botUsers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-center text-muted-foreground py-8"
                  >
                    No bot users yet
                  </TableCell>
                </TableRow>
              ) : (
                botUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {u.profiles?.avatar_url ? (
                          <img
                            src={u.profiles.avatar_url}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                            {(u.profiles?.full_name || "?")[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium flex items-center gap-1">
                            {u.profiles?.full_name || "Unknown"}
                            {u.profiles?.is_pro_member && (
                              <Crown className="w-3.5 h-3.5 text-yellow-500" />
                            )}
                          </div>
                          {u.profiles?.username && (
                            <div className="text-xs text-muted-foreground">
                              @{u.profiles.username}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.username ? `@${u.username}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {u.profiles?.phone_number ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          {u.profiles.phone_number}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="text-blue-400">{u.incoming_count}</span>
                        <span className="text-muted-foreground mx-1">/</span>
                        <span className="text-emerald-400">{u.outgoing_count}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">in / out</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-orange-500" />
                        <span className="text-sm">{u.profiles?.current_streak || 0}d</span>
                      </div>
                      {(u.profiles?.max_streak || 0) > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          best: {u.profiles!.max_streak}d
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatMinutes(u.profiles?.total_minutes_all_time || 0)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.notification_preferences?.morning_reminder && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                            AM
                          </Badge>
                        )}
                        {u.notification_preferences?.evening_nudge && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-500 border-purple-500/20">
                            PM
                          </Badge>
                        )}
                        {u.notification_preferences?.streak_alerts && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-500/10 text-orange-500 border-orange-500/20">
                            Streak
                          </Badge>
                        )}
                        {u.notification_preferences?.daily_summary && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-500 border-blue-500/20">
                            Summary
                          </Badge>
                        )}
                        {!u.notification_preferences && (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground text-sm"
                      title={formatDate(u.connected_at)}
                    >
                      {timeAgo(u.connected_at)}
                    </TableCell>
                    <TableCell
                      className="text-sm"
                      title={formatDate(u.last_interaction_at)}
                    >
                      {timeAgo(u.last_interaction_at)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          u.is_active
                            ? "bg-green-500/10 text-green-500 border-green-500/20"
                            : "bg-red-500/10 text-red-500 border-red-500/20"
                        }
                      >
                        {u.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
