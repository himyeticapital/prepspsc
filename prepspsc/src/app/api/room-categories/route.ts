import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { applyRateLimit } from "@/lib/rate-limit";
import { validateBody, createRoomCategorySchema } from "@/lib/validations";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("room_categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Failed to fetch room categories:", error);
      return NextResponse.json(
        { error: "Failed to fetch categories" },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Error in room-categories API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Check if user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "teacher"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limiting
    const rateLimitResponse = await applyRateLimit(request, "admin", user.id);
    if (rateLimitResponse) return rateLimitResponse;

    let rawBody;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validation = validateBody(createRoomCategorySchema, rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const { slug, label, icon, color, sort_order } = validation.data;

    const { data, error } = await supabase
      .from("room_categories")
      .insert({
        slug: slug.toLowerCase().replace(/\s+/g, "-"),
        label,
        icon: icon || "Users",
        color: color || "teal",
        sort_order: sort_order || 0,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Category with this slug already exists" },
          { status: 400 }
        );
      }
      console.error("Failed to create category:", error);
      return NextResponse.json(
        { error: "Failed to create category" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in room-categories POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();

    // Check if user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "teacher"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 }
      );
    }

    // Check if any rooms use this category
    const { data: roomsWithCategory } = await supabase
      .from("rooms")
      .select("id")
      .eq("category_id", parseInt(id))
      .limit(1);

    if (roomsWithCategory && roomsWithCategory.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete: category is in use by study halls" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("room_categories")
      .delete()
      .eq("id", parseInt(id));

    if (error) {
      console.error("Failed to delete category:", error);
      return NextResponse.json(
        { error: "Failed to delete category" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in room-categories DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
