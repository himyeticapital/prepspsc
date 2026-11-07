import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export async function GET(request: NextRequest) {
  // Initialize clients inside handler to avoid build-time errors
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    // Verify cron secret (mandatory — fail closed)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    // Find Pro users expiring in exactly 7, 3, or 1 day(s)
    const reminderDays = [7, 3, 1];
    let totalSent = 0;

    for (const days of reminderDays) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + days);

      // Query profiles expiring on this target date (within that day)
      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);

      const { data: expiringProfiles, error } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, pro_expires_at, pro_cancelled")
        .eq("is_pro_member", true)
        .or("pro_cancelled.is.null,pro_cancelled.eq.false")
        .gte("pro_expires_at", dayStart.toISOString())
        .lte("pro_expires_at", dayEnd.toISOString());

      if (error) {
        console.error(`Error querying profiles for ${days}-day reminder:`, error);
        continue;
      }

      if (!expiringProfiles || expiringProfiles.length === 0) continue;

      // Send emails to each expiring user
      for (const profile of expiringProfiles) {
        try {
          // Get user email from auth
          const { data: userData, error: userError } =
            await supabaseAdmin.auth.admin.getUserById(profile.id);

          if (userError || !userData.user?.email) continue;

          const email = userData.user.email;
          const name = profile.full_name || "there";
          const renewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pricing`;

          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || "PrepSPSC <hello@prepspsc.com>",
            to: email,
            subject:
              days === 1
                ? "Your Pro membership expires tomorrow!"
                : `Your Pro membership expires in ${days} days`,
            html: getReminderEmailHtml(name, days, renewUrl),
            tags: [
              { name: "type", value: "renewal-reminder" },
              { name: "days_left", value: String(days) },
            ],
          });

          totalSent++;
        } catch (emailError) {
          console.error(`Failed to send email to ${profile.id}:`, emailError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${totalSent} renewal reminder(s)`,
      count: totalSent,
    });
  } catch (error) {
    console.error("Renewal reminder cron error:", error);
    return NextResponse.json(
      { error: "Failed to send renewal reminders" },
      { status: 500 }
    );
  }
}

function getReminderEmailHtml(
  name: string,
  daysLeft: number,
  renewUrl: string
): string {
  const urgency =
    daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="background-color:#1a1a1f;border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.1);">
      <div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:24px;font-weight:bold;color:#fff;">Prep<span style="color:#f97316;">SPSC</span></span>
      </div>

      <h1 style="color:#fff;font-size:20px;margin:0 0 16px;">
        Hi ${name},
      </h1>

      <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.6;margin:0 0 16px;">
        Your <strong style="color:#f97316;">Pro membership</strong> expires <strong style="color:#fff;">${urgency}</strong>.
      </p>

      <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.6;margin:0 0 24px;">
        Renew now to keep access to unlimited AI generations, 1.5x XP multiplier, premium tests, streak shields, and all Pro features.
      </p>

      <div style="text-align:center;margin-bottom:24px;">
        <a href="${renewUrl}" style="display:inline-block;background:linear-gradient(to right,#f97316,#eab308);color:#fff;font-weight:600;font-size:15px;padding:12px 32px;border-radius:8px;text-decoration:none;">
          Renew Subscription
        </a>
      </div>

      <p style="color:rgba(255,255,255,0.4);font-size:13px;line-height:1.5;margin:0;text-align:center;">
        If you don&apos;t renew, your account will automatically switch to the Free plan after expiry. You won&apos;t lose any saved data.
      </p>
    </div>

    <p style="color:rgba(255,255,255,0.3);font-size:12px;text-align:center;margin-top:24px;">
      PrepSPSC &mdash; Sikkim PSC Exam Preparation<br>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/refund-policy" style="color:rgba(255,255,255,0.3);">Refund Policy</a>
    </p>
  </div>
</body>
</html>`;
}
