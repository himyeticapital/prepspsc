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

// GET - List user's custom exams
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's exams with upload counts
    const { data: exams, error } = await supabase
      .from("user_custom_exams")
      .select(`
        *,
        user_custom_exam_uploads(id, upload_type, file_name, year)
      `)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      // If table doesn't exist yet (migrations not applied), return empty array
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.log("user_custom_exams table not found - migrations may not be applied");
        return NextResponse.json({ exams: [] });
      }
      console.error("Failed to fetch user exams:", error);
      return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 });
    }

    return NextResponse.json({ exams: exams || [] });
  } catch (error) {
    console.error("Get user exams error:", error);
    return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 });
  }
}

// POST - Create new custom exam
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, category } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Exam name is required" }, { status: 400 });
    }

    // Generate slug
    const baseSlug = generateSlug(name);

    // Check if slug already exists for this user, append number if needed
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const { data: existing } = await supabase
        .from("user_custom_exams")
        .select("id")
        .eq("user_id", user.id)
        .eq("slug", slug)
        .single();

      if (!existing) break;

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create exam
    const { data: exam, error } = await supabase
      .from("user_custom_exams")
      .insert({
        user_id: user.id,
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        category: category || "other",
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

// PATCH - Update custom exam
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      name,
      description,
      category,
      syllabus_content,
      microthemes,
      pyq_years,
      is_active,
      exam_scheme,
      microthemes_source,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 });
    }

    // Verify ownership
    const { data: existingExam } = await supabase
      .from("user_custom_exams")
      .select("id, user_id")
      .eq("id", id)
      .single();

    if (!existingExam || existingExam.user_id !== user.id) {
      return NextResponse.json({ error: "Exam not found or access denied" }, { status: 404 });
    }

    // Build update object
    const updates: Record<string, unknown> = {};

    if (name !== undefined) {
      updates.name = name.trim();
      updates.slug = generateSlug(name);
    }
    if (description !== undefined) updates.description = description?.trim() || null;
    if (category !== undefined) updates.category = category;
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
      .from("user_custom_exams")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 });
    }

    // Verify ownership before deleting
    const { data: existingExam } = await supabase
      .from("user_custom_exams")
      .select("id, user_id")
      .eq("id", id)
      .single();

    if (!existingExam || existingExam.user_id !== user.id) {
      return NextResponse.json({ error: "Exam not found or access denied" }, { status: 404 });
    }

    // Soft delete (set is_active = false)
    const { error } = await supabase
      .from("user_custom_exams")
      .update({ is_active: false })
      .eq("id", id)
      .eq("user_id", user.id);

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
