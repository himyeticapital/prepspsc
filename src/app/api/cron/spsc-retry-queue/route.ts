/**
 * SPSC Form Retry Queue
 * Processes queued form submissions that failed due to portal being down
 * Runs every 30 minutes
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendMessage, sendPhoto } from "@/lib/bot/adapters/telegram";
import * as automation from "@/lib/bot/spsc-automation";
import { decrypt } from "@/lib/bot/encryption";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const maxDuration = 300; // 5 minutes max

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if automation service is healthy
    const isHealthy = await automation.checkHealth();
    if (!isHealthy) {
      return NextResponse.json({
        status: "skipped",
        message: "Automation service is not available",
      });
    }

    // Get applications in retry queue
    const { data: applications } = await supabase
      .from("spsc_form_applications")
      .select("*, profiles!inner(id)")
      .eq("status", "queued_retry")
      .lt("retry_count", 10)
      .order("created_at", { ascending: true })
      .limit(5); // Process max 5 at a time

    if (!applications || applications.length === 0) {
      return NextResponse.json({
        status: "ok",
        message: "No applications in retry queue",
      });
    }

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const app of applications) {
      // Increment retry count
      await supabase
        .from("spsc_form_applications")
        .update({
          retry_count: app.retry_count + 1,
          status: "filling_form",
          updated_at: new Date().toISOString(),
        })
        .eq("id", app.id);

      try {
        // Start a new automation session
        const sessionResult = await automation.startSession(app.user_id, app.id);

        if ("error" in sessionResult) {
          throw new Error(sessionResult.error);
        }

        // Decrypt credentials
        const email = decrypt(app.portal_email_encrypted);
        const password = decrypt(app.portal_password_encrypted);

        // For retries, we need the user to solve CAPTCHA
        // Send CAPTCHA to user and set status to awaiting_captcha
        const { data: connection } = await supabase
          .from("bot_connections")
          .select("platform_user_id")
          .eq("user_id", app.user_id)
          .eq("platform", "telegram")
          .eq("is_active", true)
          .single();

        if (connection) {
          // Store session ID for later use
          await supabase
            .from("spsc_form_applications")
            .update({
              automation_session_id: sessionResult.sessionId,
              status: "awaiting_captcha",
              updated_at: new Date().toISOString(),
            })
            .eq("id", app.id);

          // Send CAPTCHA to user
          await sendPhoto(
            connection.platform_user_id,
            sessionResult.captchaBase64,
            `🔄 <b>Retry attempt ${app.retry_count + 1}/10</b>\n\nThe portal is reachable now! Please solve this CAPTCHA to continue your application:`,
            [{ text: "❌ Cancel", callbackData: "spsc_cancel_retry" }]
          );

          succeeded++;
        } else {
          // No active Telegram connection, mark as failed
          await supabase
            .from("spsc_form_applications")
            .update({
              status: "failed",
              last_error: "No active Telegram connection for CAPTCHA solving",
              updated_at: new Date().toISOString(),
            })
            .eq("id", app.id);
          failed++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`Retry failed for application ${app.id}:`, errorMsg);

        // Update status based on retry count
        const newStatus = app.retry_count + 1 >= 10 ? "failed" : "queued_retry";
        await supabase
          .from("spsc_form_applications")
          .update({
            status: newStatus,
            last_error: errorMsg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", app.id);

        // Notify user if final failure
        if (newStatus === "failed") {
          const { data: connection } = await supabase
            .from("bot_connections")
            .select("platform_user_id")
            .eq("user_id", app.user_id)
            .eq("platform", "telegram")
            .eq("is_active", true)
            .single();

          if (connection) {
            await sendMessage(connection.platform_user_id, {
              text: `❌ <b>Form submission failed</b>\n\nAfter ${app.retry_count + 1} attempts, we couldn't submit your application for "${app.target_post_name || "SPSC recruitment"}".\n\nError: ${errorMsg}\n\nPlease try submitting manually at the portal or use /fillspscform to start over.`,
              parseMode: "HTML",
              buttons: [
                { text: "🔗 Go to Portal", url: "https://spscrecruitment.sikkim.gov.in/rpaonline/login" },
                { text: "🔄 Start Over", callbackData: "spsc_start" },
              ],
            });
          }
        }

        failed++;
      }

      processed++;
    }

    return NextResponse.json({
      status: "ok",
      processed,
      succeeded,
      failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Retry queue error:", error);
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
