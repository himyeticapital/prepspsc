import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ExamOption {
  value: string;
  label: string;
  description?: string;
  microthemes: unknown[];
  isUserExam?: boolean;
  isSeparator?: boolean;
  disabled?: boolean;
}

// GET - List active exams for Study Planner dropdown
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch active admin exams with microthemes
    const { data: adminExams, error: adminError } = await supabase
      .from("admin_exams")
      .select("id, name, slug, description, microthemes")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (adminError) {
      console.error("Failed to fetch admin exams:", adminError);
      return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 });
    }

    // Fetch user's custom exams with microthemes
    const { data: userExams, error: userError } = await supabase
      .from("user_custom_exams")
      .select("id, name, slug, description, microthemes")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (userError) {
      console.error("Failed to fetch user exams:", userError);
      // Continue without user exams - not a critical error
    }

    const examOptions: ExamOption[] = [];

    // Add admin exams first (if any)
    if (adminExams && adminExams.length > 0) {
      examOptions.push({
        value: "separator-admin",
        label: "── Upcoming Exams ──",
        microthemes: [],
        isSeparator: true,
        disabled: true,
      });

      adminExams.forEach((exam) => {
        examOptions.push({
          value: exam.slug,
          label: exam.name,
          description: exam.description || undefined,
          microthemes: exam.microthemes || [],
        });
      });
    }

    // Add user's custom exams (if any)
    if (userExams && userExams.length > 0) {
      examOptions.push({
        value: "separator-user",
        label: "── My Custom Exams ──",
        microthemes: [],
        isSeparator: true,
        disabled: true,
      });

      userExams.forEach((exam) => {
        examOptions.push({
          value: `user:${exam.id}`,
          label: exam.name,
          description: exam.description || undefined,
          microthemes: exam.microthemes || [],
          isUserExam: true,
        });
      });
    }

    // Always include "custom" option at the end for one-time use
    examOptions.push({
      value: "separator-other",
      label: "────────────────",
      microthemes: [],
      isSeparator: true,
      disabled: true,
    });

    examOptions.push({
      value: "custom",
      label: "Custom Syllabus (one-time)",
      description: "Enter your own syllabus topics without saving",
      microthemes: [],
    });

    return NextResponse.json({ exams: examOptions });
  } catch (error) {
    console.error("Get exams error:", error);
    return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 });
  }
}
