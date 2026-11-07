import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

// Use service role to access auth.users
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Verify the user is an admin
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userIds } = await request.json();

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ emails: {} });
    }

    // Fetch user emails from auth.users using admin API
    const emails: Record<string, string> = {};

    // Batch fetch users (Supabase admin API supports fetching one at a time)
    for (const userId of userIds.slice(0, 100)) {
      // Limit to 100 to prevent abuse
      try {
        const {
          data: { user: authUser },
          error,
        } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (!error && authUser?.email) {
          emails[userId] = authUser.email;
        }
      } catch {
        // Skip if user not found
        continue;
      }
    }

    return NextResponse.json({ emails });
  } catch (error) {
    console.error("Error fetching user emails:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
