import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // Allow up to 60s for PDF processing

// Initialize Gemini for PDF text extraction
function getGeminiModel() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_NOT_CONFIGURED");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
}

// Retry helper for rate limits
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 3000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || "";

      const isRateLimit =
        error?.status === 429 ||
        errorMessage.includes("429") ||
        errorMessage.includes("Resource exhausted");

      if (!isRateLimit || attempt === maxRetries) {
        throw error;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), 30000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const examId = formData.get("examId") as string;
    const uploadType = formData.get("uploadType") as "syllabus" | "pyq";
    const year = formData.get("year") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!examId) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 });
    }

    if (!uploadType || !["syllabus", "pyq"].includes(uploadType)) {
      return NextResponse.json({ error: "Invalid upload type" }, { status: 400 });
    }

    // Validate file type (PDF only)
    if (!file.type.includes("pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 }
      );
    }

    // Verify exam exists
    const { data: exam, error: examError } = await supabase
      .from("admin_exams")
      .select("id")
      .eq("id", examId)
      .single();

    if (examError || !exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    // Convert file to buffer for both storage and AI processing
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `exams/${examId}/${uploadType}/${timestamp}_${sanitizedFileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("exam-uploads")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      // If bucket doesn't exist, try to create it or use a different one
      if (uploadError.message?.includes("Bucket not found")) {
        return NextResponse.json(
          { error: "Storage not configured. Please contact admin." },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("exam-uploads")
      .getPublicUrl(filePath);

    const fileUrl = urlData.publicUrl;

    // Extract text from PDF using Gemini
    let parsedContent = "";
    try {
      const model = getGeminiModel();

      const extractionPrompt = `You are extracting text from a ${uploadType === "syllabus" ? "syllabus/scheme" : "previous year question paper (PYQ)"} document.

IMPORTANT: Extract ALL text content for educational analysis.

For ${uploadType === "syllabus" ? "SYLLABUS documents" : "PYQ documents"}:
${uploadType === "syllabus" ? `
- Extract all subject names and topic lists
- Include unit/chapter breakdowns
- Capture any weightage or marks distribution
- Note important topics marked as priority
- Include exam pattern information if present` : `
- Extract all questions with their numbers
- Include marks allocation for each question
- Note the subject/topic each question belongs to
- Capture section divisions (Section A, B, etc.)
- Include any instructions or time limits`}

Return ONLY the extracted text content in a clean, organized format.
If you cannot read the document, respond with: "EXTRACTION_FAILED"`;

      const result = await withRetry(async () => {
        return await model.generateContent([
          extractionPrompt,
          {
            inlineData: {
              mimeType: "application/pdf",
              data: base64,
            },
          },
        ]);
      });

      parsedContent = result.response.text().trim();

      if (parsedContent === "EXTRACTION_FAILED" || parsedContent.length < 50) {
        console.log("PDF extraction returned insufficient content");
        parsedContent = ""; // Will store empty, user can retry
      }
    } catch (aiError: any) {
      console.error("AI extraction error:", aiError);
      // Continue without parsed content - user can trigger extraction later
    }

    // Save upload record to database
    const { data: upload, error: insertError } = await supabase
      .from("admin_exam_uploads")
      .insert({
        exam_id: examId,
        upload_type: uploadType,
        file_name: file.name,
        file_url: fileUrl,
        parsed_content: parsedContent || null,
        year: uploadType === "pyq" ? year : null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to save upload record:", insertError);
      // Try to delete the uploaded file
      await supabase.storage.from("exam-uploads").remove([filePath]);
      return NextResponse.json(
        { error: "Failed to save upload record" },
        { status: 500 }
      );
    }

    // If syllabus, also update the exam's syllabus_content
    if (uploadType === "syllabus" && parsedContent) {
      await supabase
        .from("admin_exams")
        .update({ syllabus_content: parsedContent })
        .eq("id", examId);
    }

    // If PYQ, update the exam's pyq_years array
    if (uploadType === "pyq" && year) {
      const { data: currentExam } = await supabase
        .from("admin_exams")
        .select("pyq_years")
        .eq("id", examId)
        .single();

      const currentYears = currentExam?.pyq_years || [];
      if (!currentYears.includes(year)) {
        await supabase
          .from("admin_exams")
          .update({ pyq_years: [...currentYears, year].sort() })
          .eq("id", examId);
      }
    }

    return NextResponse.json({
      success: true,
      upload,
      hasContent: !!parsedContent,
      contentLength: parsedContent?.length || 0,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    );
  }
}

// DELETE - Remove an upload
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
    const uploadId = searchParams.get("id");

    if (!uploadId) {
      return NextResponse.json({ error: "Upload ID is required" }, { status: 400 });
    }

    // Get upload details first
    const { data: upload, error: fetchError } = await supabase
      .from("admin_exam_uploads")
      .select("file_url, exam_id, upload_type, year")
      .eq("id", uploadId)
      .single();

    if (fetchError || !upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // Extract file path from URL
    const url = new URL(upload.file_url);
    const filePath = url.pathname.split("/exam-uploads/")[1];

    // Delete from storage
    if (filePath) {
      await supabase.storage.from("exam-uploads").remove([filePath]);
    }

    // Delete record
    const { error: deleteError } = await supabase
      .from("admin_exam_uploads")
      .delete()
      .eq("id", uploadId);

    if (deleteError) {
      console.error("Failed to delete upload record:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete upload" },
        { status: 500 }
      );
    }

    // If PYQ, update exam's pyq_years to remove this year
    if (upload.upload_type === "pyq" && upload.year) {
      // Check if there are other PYQs with the same year
      const { data: otherPyqs } = await supabase
        .from("admin_exam_uploads")
        .select("id")
        .eq("exam_id", upload.exam_id)
        .eq("upload_type", "pyq")
        .eq("year", upload.year);

      if (!otherPyqs || otherPyqs.length === 0) {
        // Remove year from exam's pyq_years
        const { data: exam } = await supabase
          .from("admin_exams")
          .select("pyq_years")
          .eq("id", upload.exam_id)
          .single();

        if (exam?.pyq_years) {
          const updatedYears = exam.pyq_years.filter((y: string) => y !== upload.year);
          await supabase
            .from("admin_exams")
            .update({ pyq_years: updatedYears })
            .eq("id", upload.exam_id);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete upload error:", error);
    return NextResponse.json(
      { error: "Failed to delete upload" },
      { status: 500 }
    );
  }
}
