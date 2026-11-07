import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Helper to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// GET - List all exams (admin only)
export async function GET() {
  try {
    const supabase = await createClient();

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

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Fetch all exams with upload counts
    const { data: exams, error } = await supabase
      .from("admin_exams")
      .select(`
        *,
        admin_exam_uploads(id, upload_type, file_name, year)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch exams:", error);
      return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 });
    }

    return NextResponse.json({ exams: exams || [] });
  } catch (error) {
    console.error("Get exams error:", error);
    return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 });
  }
}

// POST - Create new exam
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

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

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Exam name is required" }, { status: 400 });
    }

    // Generate slug
    const slug = generateSlug(name);

    // Check if slug already exists
    const { data: existing } = await supabase
      .from("admin_exams")
      .select("id")
      .eq("slug", slug)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "An exam with a similar name already exists" },
        { status: 409 }
      );
    }

    // Create exam
    const { data: exam, error } = await supabase
      .from("admin_exams")
      .insert({
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create exam:", error);
      return NextResponse.json({ error: "Failed to create exam" }, { status: 500 });
    }

    return NextResponse.json({ exam, success: true });
  } catch (error) {
    console.error("Create exam error:", error);
    return NextResponse.json({ error: "Failed to create exam" }, { status: 500 });
  }
}

// PATCH - Update exam
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

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

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, description, syllabus_content, microthemes, pyq_years, is_active, exam_scheme, microthemes_source } = body;

    if (!id) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 });
    }

    // Build update object
    const updates: Record<string, any> = {};

    if (name !== undefined) {
      updates.name = name.trim();
      updates.slug = generateSlug(name);
    }
    if (description !== undefined) updates.description = description?.trim() || null;
    if (syllabus_content !== undefined) updates.syllabus_content = syllabus_content;
    if (microthemes !== undefined) updates.microthemes = microthemes;
    if (pyq_years !== undefined) updates.pyq_years = pyq_years;
    if (is_active !== undefined) updates.is_active = is_active;
    if (exam_scheme !== undefined) updates.exam_scheme = exam_scheme;
    if (microthemes_source !== undefined) updates.microthemes_source = microthemes_source;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    // Update exam
    const { data: exam, error } = await supabase
      .from("admin_exams")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update exam:", error);
      return NextResponse.json({ error: "Failed to update exam" }, { status: 500 });
    }

    return NextResponse.json({ exam, success: true });
  } catch (error) {
    console.error("Update exam error:", error);
    return NextResponse.json({ error: "Failed to update exam" }, { status: 500 });
  }
}

// DELETE - Soft delete exam (set is_active = false)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

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

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 });
    }

    // Soft delete (set is_active = false)
    const { error } = await supabase
      .from("admin_exams")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      console.error("Failed to delete exam:", error);
      return NextResponse.json({ error: "Failed to delete exam" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete exam error:", error);
    return NextResponse.json({ error: "Failed to delete exam" }, { status: 500 });
  }
}
