import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create admin Supabase client for broadcasting
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const { type, title, message, data } = await request.json();

    if (!type || !title) {
      return NextResponse.json(
        { error: "Missing required fields: type, title" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Broadcast to all connected clients via Supabase Realtime
    const channel = supabase.channel("global-notifications");

    // Must subscribe and wait for SUBSCRIBED status before sending
    // Supabase Realtime requires channel to be subscribed before broadcast
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Channel subscription timeout"));
      }, 5000);

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timeout);
          reject(new Error(`Channel subscription failed: ${status}`));
        }
      });
    });

    // Now we can send the broadcast
    const sendResult = await channel.send({
      type: "broadcast",
      event: "new_notification",
      payload: {
        type,
        title,
        message,
        data,
        timestamp: Date.now(),
      },
    });

    console.log(`Broadcast sent: ${type} - "${title}"`, sendResult);

    // Cleanup: unsubscribe after sending
    await supabase.removeChannel(channel);

    // For test_added notifications, also persist to database for offline users
    if (type === "test_added" && data?.testId) {
      // Get all user IDs to notify (active users from last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: activeUsers } = await supabase
        .from("profiles")
        .select("id")
        .gte("updated_at", thirtyDaysAgo.toISOString())
        .limit(1000); // Limit to prevent overload

      if (activeUsers && activeUsers.length > 0) {
        // Batch insert notifications for active users
        const notifications = activeUsers.map((user) => ({
          user_id: user.id,
          type: "system",
          title,
          message,
          metadata: { testId: data.testId, testName: data.testName, notificationType: "test_added" },
          is_read: false,
        }));

        // Insert in batches of 100
        for (let i = 0; i < notifications.length; i += 100) {
          const batch = notifications.slice(i, i + 100);
          await supabase.from("user_notifications").insert(batch);
        }

        console.log(`Broadcast: Notified ${activeUsers.length} users about new test "${data.testName}"`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Broadcast notification error:", error);
    return NextResponse.json(
      { error: "Failed to broadcast notification" },
      { status: 500 }
    );
  }
}
