import { hasProAccess } from "@/lib/access";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import JSZip from "jszip";
import initSqlJs from "sql.js";
import path from "path";
import fs from "fs";

// Initialize SQL.js (SQLite in Node)
let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

async function getSQL() {
  if (!SQL) {
    // Load WASM binary from node_modules
    const wasmPath = path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm");
    const wasmBuffer = fs.readFileSync(wasmPath);
    const wasmBinary = wasmBuffer.buffer.slice(
      wasmBuffer.byteOffset,
      wasmBuffer.byteOffset + wasmBuffer.byteLength
    ) as ArrayBuffer;

    SQL = await initSqlJs({
      wasmBinary,
    });
  }
  return SQL;
}

interface AnkiCard {
  front: string;
  back: string;
}

// Parse Anki .apkg file and extract flashcards
async function parseAnkiFile(buffer: ArrayBuffer): Promise<AnkiCard[]> {
  const zip = await JSZip.loadAsync(buffer);
  const files = Object.keys(zip.files);

  // Find the SQLite database file
  // Anki 2.0: collection.anki2
  // Anki 2.1: collection.anki21
  // Anki 2.1.50+: collection.anki21b (protobuf, not supported yet)
  let dbFile =
    zip.file("collection.anki2") ||
    zip.file("collection.anki21") ||
    zip.file("col"); // Some older exports use "col"

  if (!dbFile) {
    // Try to find any SQLite database file
    const ankiFile = files.find(
      (f) => f.endsWith(".anki2") || f.endsWith(".anki21") || f === "col"
    );
    if (ankiFile) {
      dbFile = zip.file(ankiFile);
    }
  }

  if (!dbFile) {
    // Check if it's a newer protobuf-based format
    if (files.some((f) => f.endsWith(".anki21b"))) {
      throw new Error(
        "This Anki file uses the newer protobuf format (Anki 2.1.50+). Please export using the older format or try a different deck."
      );
    }
    throw new Error(
      `Invalid Anki file: No collection database found. Files in archive: ${files.slice(0, 10).join(", ")}`
    );
  }

  const dbBuffer = await dbFile.async("arraybuffer");
  const SQL = await getSQL();
  const db = new SQL.Database(new Uint8Array(dbBuffer));

  const cards: AnkiCard[] = [];

  try {
    // Query notes table for card content
    // Anki stores fields separated by \x1f (unit separator)
    const result = db.exec(`
      SELECT n.flds, n.mid
      FROM notes n
      LIMIT 500
    `);

    if (result.length > 0 && result[0].values) {
      for (const row of result[0].values) {
        const fields = (row[0] as string).split("\x1f");

        if (fields.length >= 2) {
          // First field is typically the front, second is the back
          const front = stripHtml(fields[0]);
          const back = stripHtml(fields[1]);

          if (front && back) {
            cards.push({ front, back });
          }
        }
      }
    }
  } finally {
    db.close();
  }

  return cards;
}

// Strip HTML tags from Anki card content
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/&nbsp;/g, " ") // Replace nbsp
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is Pro (bypass in development)
    const isDev = process.env.NODE_ENV === "development";
    if (!isDev) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_pro_member")
        .eq("id", user.id)
        .single();

      if (!hasProAccess(profile)) {
        return NextResponse.json(
          {
            error: "Pro feature",
            code: "PRO_REQUIRED",
            message: "Anki import is a Pro-only feature",
          },
          { status: 403 }
        );
      }
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const goalId = formData.get("goalId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!goalId) {
      return NextResponse.json(
        { error: "No goal ID provided" },
        { status: 400 }
      );
    }

    // Verify file type
    if (!file.name.endsWith(".apkg")) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload an .apkg file" },
        { status: 400 }
      );
    }

    // Verify user owns the goal
    const { data: goal, error: goalError } = await supabase
      .from("study_ai_goals")
      .select("id, user_id")
      .eq("id", parseInt(goalId))
      .single();

    if (goalError || !goal || goal.user_id !== user.id) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    // Parse the Anki file
    const buffer = await file.arrayBuffer();
    let cards: AnkiCard[];

    try {
      cards = await parseAnkiFile(buffer);
    } catch (parseError: any) {
      console.error("Anki parse error:", parseError);
      const message = parseError?.message || "Failed to parse Anki file.";
      return NextResponse.json(
        { error: message.includes("Anki") ? message : `Failed to parse Anki file: ${message}` },
        { status: 400 }
      );
    }

    if (cards.length === 0) {
      return NextResponse.json(
        { error: "No flashcards found in the Anki file" },
        { status: 400 }
      );
    }

    // Create flashcards output data
    const flashcardsOutput = {
      title: `Imported from ${file.name}`,
      cards: cards.map((card, index) => ({
        id: (index + 1).toString(),
        front: card.front,
        back: card.back,
      })),
    };

    // Save as an AI generation (flashcards type)
    const { data: generation, error: insertError } = await supabase
      .from("ai_generations")
      .insert({
        user_id: user.id,
        goal_id: parseInt(goalId),
        generation_type: "flashcards",
        output_data: flashcardsOutput,
        title: flashcardsOutput.title,
        is_saved: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to save Anki import:", insertError);
      return NextResponse.json(
        { error: "Failed to save imported flashcards" },
        { status: 500 }
      );
    }

    // Also save a record of the upload
    await supabase.from("study_uploads").insert({
      user_id: user.id,
      goal_id: parseInt(goalId),
      upload_type: "anki",
      file_name: file.name,
      extracted_text: cards
        .map((card) => `Q: ${card.front}\nA: ${card.back}`)
        .join("\n\n")
        .slice(0, 50000),
      metadata: {
        cardCount: cards.length,
        generationId: generation.id,
      },
    });

    // Award XP for importing
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("xp_points")
      .eq("id", user.id)
      .single();

    const xpAmount = 15; // Pro bonus XP for import
    await supabase.from("xp_transactions").insert({
      user_id: user.id,
      amount: xpAmount,
      reason: "anki_import",
      multiplier: 1.5,
      reference_id: generation.id.toString(),
    });

    if (currentProfile) {
      await supabase
        .from("profiles")
        .update({ xp_points: (currentProfile.xp_points || 0) + xpAmount })
        .eq("id", user.id);
    }

    return NextResponse.json({
      success: true,
      generation,
      cardCount: cards.length,
      xpEarned: xpAmount,
    });
  } catch (error) {
    console.error("Anki import error:", error);
    return NextResponse.json(
      { error: "Failed to import Anki file" },
      { status: 500 }
    );
  }
}
