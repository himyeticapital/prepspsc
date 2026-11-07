import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const authClient = await createAuthClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin role verification
    const { data: profile } = await authClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Only admins can access user emails" }, { status: 403 });
    }

    // Use service role to access auth.users
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all users from auth (paginate through all pages)
    const allAuthUsers: any[] = [];
    let page = 1;
    while (true) {
      const { data: authData, error } = await supabase.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error) {
        console.error("[Admin] Failed to fetch users:", error);
        return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
      }
      if (!authData.users.length) break;
      allAuthUsers.push(...authData.users);
      if (authData.users.length < 1000) break;
      page++;
    }

    // Create maps of user_id -> email and user_id -> phone
    const emailMap: Record<string, string> = {};
    const phoneMap: Record<string, string> = {};
    for (const authUser of allAuthUsers) {
      if (authUser.email) {
        emailMap[authUser.id] = authUser.email;
      }
      // Get phone from user metadata (set during signup)
      const phone = authUser.user_metadata?.phone_number || authUser.phone;
      if (phone) {
        phoneMap[authUser.id] = phone;
      }
    }

    return NextResponse.json({ emails: emailMap, phones: phoneMap });
  } catch (error) {
    console.error("[Admin] User emails error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
