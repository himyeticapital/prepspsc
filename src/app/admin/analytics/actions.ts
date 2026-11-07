"use server";

import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

async function verifyAdmin() {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await authClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") throw new Error("Forbidden");
  return user;
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getIndividualUserAnalytics() {
  await verifyAdmin();
  const supabase = getServiceClient();

  // Fetch all profiles with key fields
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url, role, is_pro_member, xp_points, xp_level, current_streak, max_streak, total_minutes_all_time, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  // Fetch test attempts per user (completed only)
  const { data: attempts } = await supabase
    .from("test_attempts")
    .select("user_id, score, total_marks, status, completed_at")
    .eq("status", "completed");

  // Build per-user test stats
  const userTestStats: Record<string, { count: number; totalPercent: number; lastTest: string | null }> = {};
  (attempts || []).forEach((a) => {
    if (!userTestStats[a.user_id]) userTestStats[a.user_id] = { count: 0, totalPercent: 0, lastTest: null };
    userTestStats[a.user_id].count++;
    if (a.score != null && a.total_marks) {
      userTestStats[a.user_id].totalPercent += (a.score / a.total_marks) * 100;
    }
    if (a.completed_at && (!userTestStats[a.user_id].lastTest || a.completed_at > userTestStats[a.user_id].lastTest!)) {
      userTestStats[a.user_id].lastTest = a.completed_at;
    }
  });

  // Fetch study logs per user for last 7 days
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { data: recentLogs } = await supabase
    .from("daily_study_logs")
    .select("user_id, minutes_studied")
    .gte("date", weekAgo.toISOString().split("T")[0]);

  const recentMinutes: Record<string, number> = {};
  (recentLogs || []).forEach((l) => {
    recentMinutes[l.user_id] = (recentMinutes[l.user_id] || 0) + l.minutes_studied;
  });

  // Fetch last active (most recent study log date per user)
  const { data: lastActiveLogs } = await supabase
    .from("daily_study_logs")
    .select("user_id, date")
    .order("date", { ascending: false });

  const lastActive: Record<string, string> = {};
  (lastActiveLogs || []).forEach((l) => {
    if (!lastActive[l.user_id]) lastActive[l.user_id] = l.date;
  });

  // Fetch AI generation counts per user
  const { data: aiGens } = await supabase
    .from("ai_generations")
    .select("user_id, created_at");

  const aiGenCount: Record<string, number> = {};
  const lastAiGen: Record<string, string> = {};
  (aiGens || []).forEach((g) => {
    aiGenCount[g.user_id] = (aiGenCount[g.user_id] || 0) + 1;
    if (g.created_at && (!lastAiGen[g.user_id] || g.created_at > lastAiGen[g.user_id])) {
      lastAiGen[g.user_id] = g.created_at;
    }
  });

  return (profiles || []).map((p) => {
    const tests = userTestStats[p.id];
    return {
      id: p.id,
      full_name: p.full_name,
      username: p.username,
      avatar_url: p.avatar_url,
      role: p.role,
      is_pro_member: p.is_pro_member,
      xp_points: p.xp_points || 0,
      xp_level: p.xp_level || 1,
      current_streak: p.current_streak || 0,
      max_streak: p.max_streak || 0,
      total_minutes: p.total_minutes_all_time || 0,
      recent_minutes_7d: recentMinutes[p.id] || 0,
      tests_taken: tests?.count || 0,
      avg_score: tests ? Math.round(tests.totalPercent / tests.count) : 0,
      ai_generations: aiGenCount[p.id] || 0,
      last_active: [lastActive[p.id], userTestStats[p.id]?.lastTest, lastAiGen[p.id], p.updated_at]
        .filter(Boolean)
        .sort()
        .pop() || null,
      joined: p.created_at,
    };
  });
}

export async function getUserDetail(userId: string) {
  await verifyAdmin();
  const supabase = getServiceClient();

  // Fetch test attempts with test titles
  const { data: attempts } = await supabase
    .from("test_attempts")
    .select("id, test_id, score, total_marks, status, started_at, completed_at, time_taken_seconds, attempt_number")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(50);

  // Fetch test titles for all test_ids
  const testIds = [...new Set((attempts || []).map((a) => a.test_id))];
  const testTitles: Record<number, string> = {};
  if (testIds.length > 0) {
    const { data: tests } = await supabase
      .from("tests")
      .select("id, title, test_type")
      .in("id", testIds);
    (tests || []).forEach((t) => {
      testTitles[t.id] = t.title;
    });
  }

  const testHistory = (attempts || []).map((a) => ({
    id: a.id,
    test_title: testTitles[a.test_id] || `Test #${a.test_id}`,
    score: a.score,
    total_marks: a.total_marks,
    percent: a.score != null && a.total_marks ? Math.round((a.score / a.total_marks) * 100) : null,
    status: a.status,
    time_taken_seconds: a.time_taken_seconds,
    attempt_number: a.attempt_number,
    date: a.completed_at || a.started_at,
  }));

  // AI generations by type
  const { data: aiGens } = await supabase
    .from("ai_generations")
    .select("id, generation_type, title, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const aiByType: Record<string, number> = {};
  (aiGens || []).forEach((g) => {
    aiByType[g.generation_type] = (aiByType[g.generation_type] || 0) + 1;
  });

  // Blurt sessions
  const { data: blurts } = await supabase
    .from("blurt_sessions")
    .select("id, topic, mode, score, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Guided learning sessions
  const { data: guided } = await supabase
    .from("guided_learning_sessions")
    .select("id, subject, topics, status, total_exchanges, checkpoints_passed, checkpoints_total, understanding_score, created_at, completed_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    tests: testHistory,
    ai: {
      breakdown: aiByType,
      recent: (aiGens || []).slice(0, 10).map((g) => ({
        type: g.generation_type,
        title: g.title,
        date: g.created_at,
      })),
    },
    blurts: (blurts || []).map((b) => ({
      topic: b.topic,
      mode: b.mode,
      score: b.score,
      date: b.created_at,
    })),
    guided: (guided || []).map((s) => ({
      subject: s.subject,
      topics: s.topics,
      status: s.status,
      exchanges: s.total_exchanges,
      checkpoints: `${s.checkpoints_passed}/${s.checkpoints_total}`,
      understanding: s.understanding_score,
      date: s.created_at,
    })),
  };
}

export async function getRoomAnalytics() {
  await verifyAdmin();
  const supabase = getServiceClient();

  // Fetch all rooms
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name, category, privacy_level, is_active, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  // Fetch subscription counts per room
  const { data: subscriptions } = await supabase
    .from("user_room_subscriptions")
    .select("room_id, user_id, joined_at");

  // Fetch message counts per room
  const { data: messages } = await supabase
    .from("messages")
    .select("room_id, user_id, created_at");

  // Fetch profile names for all involved users
  const allUserIds = new Set([
    ...(subscriptions || []).map((s) => s.user_id),
    ...(messages || []).map((m) => m.user_id),
  ]);
  const profileNames: Record<string, string> = {};
  if (allUserIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, username")
      .in("id", [...allUserIds]);
    (profiles || []).forEach((p) => {
      profileNames[p.id] = p.full_name || p.username || "Unknown";
    });
  }

  // Build per-room stats
  const roomStats = (rooms || []).map((room) => {
    const roomSubs = (subscriptions || []).filter((s) => s.room_id === room.id);
    const roomMsgs = (messages || []).filter((m) => m.room_id === room.id);

    // Count messages per user in this room
    const msgCountByUser: Record<string, number> = {};
    roomMsgs.forEach((m) => {
      msgCountByUser[m.user_id] = (msgCountByUser[m.user_id] || 0) + 1;
    });
    const topChatters = Object.entries(msgCountByUser)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([uid, count]) => ({ name: profileNames[uid] || "Unknown", messages: count }));

    return {
      id: room.id,
      name: room.name,
      category: room.category,
      privacy_level: room.privacy_level,
      subscribers: roomSubs.length,
      subscriber_names: roomSubs.map((s) => ({
        name: profileNames[s.user_id] || "Unknown",
        joined_at: s.joined_at,
      })),
      total_messages: roomMsgs.length,
      unique_chatters: new Set(roomMsgs.map((m) => m.user_id)).size,
      top_chatters: topChatters,
    };
  });

  // Build per-user room activity
  const userRoomActivity: Record<string, { rooms_subscribed: string[]; messages_sent: number }> = {};
  (subscriptions || []).forEach((s) => {
    if (!userRoomActivity[s.user_id]) {
      userRoomActivity[s.user_id] = { rooms_subscribed: [], messages_sent: 0 };
    }
    const roomName = (rooms || []).find((r) => r.id === s.room_id)?.name || `Room #${s.room_id}`;
    userRoomActivity[s.user_id].rooms_subscribed.push(roomName);
  });
  (messages || []).forEach((m) => {
    if (!userRoomActivity[m.user_id]) {
      userRoomActivity[m.user_id] = { rooms_subscribed: [], messages_sent: 0 };
    }
    userRoomActivity[m.user_id].messages_sent++;
  });

  return { roomStats, userRoomActivity };
}

export async function getFeatureAnalytics() {
  await verifyAdmin();
  const supabase = getServiceClient();

  // Fetch all feature usage
  const { data: usage } = await supabase
    .from("feature_usage")
    .select("user_id, feature, action, metadata, created_at")
    .order("created_at", { ascending: false });

  // Aggregate by feature
  const featureCounts: Record<string, number> = {};
  const featureUsers: Record<string, Set<string>> = {};
  (usage || []).forEach((u) => {
    featureCounts[u.feature] = (featureCounts[u.feature] || 0) + 1;
    if (!featureUsers[u.feature]) featureUsers[u.feature] = new Set();
    featureUsers[u.feature].add(u.user_id);
  });

  const featureStats = Object.entries(featureCounts).map(([feature, count]) => ({
    feature,
    total_uses: count,
    unique_users: featureUsers[feature]?.size || 0,
  })).sort((a, b) => b.total_uses - a.total_uses);

  // Per-user widget usage
  const userFeatureUsage: Record<string, Record<string, number>> = {};
  (usage || []).forEach((u) => {
    if (!userFeatureUsage[u.user_id]) userFeatureUsage[u.user_id] = {};
    userFeatureUsage[u.user_id][u.feature] = (userFeatureUsage[u.user_id][u.feature] || 0) + 1;
  });

  return { featureStats, userFeatureUsage };
}
