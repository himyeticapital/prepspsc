import Papa from "papaparse";
import ExcelJS from "exceljs";

// Question row from CSV/Excel
export interface QuestionRow {
  type: "mcq" | "conventional";
  content: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_answer?: string; // a, b, c, or d for MCQ
  marks: number;
  negative_marks?: number;
  section?: string;
}

// Parsed question ready for database insert
export interface ParsedQuestion {
  type: "mcq" | "conventional";
  content: string;
  options: { id: string; text: string }[] | null;
  correct_answer: string | null;
  marks: number;
  negative_marks: number;
  section: string | null;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  row: number;
}

// Parse result
export interface ParseResult {
  questions: ParsedQuestion[];
  errors: { row: number; message: string }[];
  totalRows: number;
  successCount: number;
}

// Validate a single row
function validateRow(row: Record<string, unknown>, rowIndex: number): ValidationResult {
  const errors: string[] = [];

  // Check type
  const type = String(row.type || "").toLowerCase().trim();
  if (!type) {
    errors.push("Missing question type");
  } else if (type !== "mcq" && type !== "conventional") {
    errors.push(`Invalid type "${type}". Must be "mcq" or "conventional"`);
  }

  // Check content
  const content = String(row.content || "").trim();
  if (!content) {
    errors.push("Missing question content");
  }

  // Check marks
  const marks = parseFloat(String(row.marks || "0"));
  if (isNaN(marks) || marks <= 0) {
    errors.push("Marks must be a positive number");
  }

  // MCQ-specific validation
  if (type === "mcq") {
    const optionA = String(row.option_a || "").trim();
    const optionB = String(row.option_b || "").trim();
    const optionC = String(row.option_c || "").trim();
    const optionD = String(row.option_d || "").trim();

    if (!optionA || !optionB) {
      errors.push("MCQ requires at least options A and B");
    }

    const correctAnswer = String(row.correct_answer || "").toLowerCase().trim();
    if (!correctAnswer) {
      errors.push("MCQ requires a correct answer (a, b, c, or d)");
    } else if (!["a", "b", "c", "d"].includes(correctAnswer)) {
      errors.push(`Invalid correct answer "${correctAnswer}". Must be a, b, c, or d`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    row: rowIndex,
  };
}

// Convert row to ParsedQuestion
function rowToQuestion(row: Record<string, unknown>): ParsedQuestion {
  const type = String(row.type || "").toLowerCase().trim() as "mcq" | "conventional";
  const content = String(row.content || "").trim();
  const marks = parseFloat(String(row.marks || "0"));
  const negativeMarks = parseFloat(String(row.negative_marks || "0"));
  const section = String(row.section || "").trim() || null;

  if (type === "mcq") {
    const correctAnswer = String(row.correct_answer || "").toLowerCase().trim();
    // Create options with id and text format expected by the database/UI
    const optionsList = [
      { id: "a", text: String(row.option_a || "").trim() },
      { id: "b", text: String(row.option_b || "").trim() },
      { id: "c", text: String(row.option_c || "").trim() },
      { id: "d", text: String(row.option_d || "").trim() },
    ].filter((opt) => opt.text); // Remove empty options

    return {
      type: "mcq",
      content,
      options: optionsList,
      correct_answer: correctAnswer,
      marks,
      negative_marks: negativeMarks,
      section,
    };
  }

  // Conventional question
  return {
    type: "conventional",
    content,
    options: null,
    correct_answer: null,
    marks,
    negative_marks: negativeMarks,
    section,
  };
}

// Parse CSV file
export async function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const questions: ParsedQuestion[] = [];
        const errors: { row: number; message: string }[] = [];

        results.data.forEach((row, index) => {
          const rowNum = index + 2; // +2 because of header and 0-index
          const validation = validateRow(row as Record<string, unknown>, rowNum);

          if (validation.valid) {
            questions.push(rowToQuestion(row as Record<string, unknown>));
          } else {
            errors.push({
              row: rowNum,
              message: validation.errors.join("; "),
            });
          }
        });

        resolve({
          questions,
          errors,
          totalRows: results.data.length,
          successCount: questions.length,
        });
      },
      error: (error) => {
        resolve({
          questions: [],
          errors: [{ row: 0, message: `CSV parse error: ${error.message}` }],
          totalRows: 0,
          successCount: 0,
        });
      },
    });
  });
}

// Parse Excel file
export async function parseExcel(file: File): Promise<ParseResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    // Get first sheet
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return {
        questions: [],
        errors: [{ row: 0, message: "No worksheet found in Excel file" }],
        totalRows: 0,
        successCount: 0,
      };
    }

    // Get headers from first row
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber] = String(cell.value || "").toLowerCase().trim();
    });

    // Parse data rows
    const questions: ParsedQuestion[] = [];
    const errors: { row: number; message: string }[] = [];
    let totalRows = 0;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row
      totalRows++;

      const rowData: Record<string, unknown> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          rowData[header] = cell.value;
        }
      });

      const validation = validateRow(rowData, rowNumber);

      if (validation.valid) {
        questions.push(rowToQuestion(rowData));
      } else {
        errors.push({
          row: rowNumber,
          message: validation.errors.join("; "),
        });
      }
    });

    return {
      questions,
      errors,
      totalRows,
      successCount: questions.length,
    };
  } catch (error) {
    return {
      questions: [],
      errors: [{ row: 0, message: `Excel parse error: ${(error as Error).message}` }],
      totalRows: 0,
      successCount: 0,
    };
  }
}

// Export questions to CSV
export function exportToCSV(questions: ParsedQuestion[]): string {
  const rows = questions.map((q) => {
    if (q.type === "mcq" && q.options) {
      // Find options by id
      const optionA = q.options.find((o) => o.id === "a")?.text || "";
      const optionB = q.options.find((o) => o.id === "b")?.text || "";
      const optionC = q.options.find((o) => o.id === "c")?.text || "";
      const optionD = q.options.find((o) => o.id === "d")?.text || "";
      return {
        type: "mcq",
        content: q.content,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD,
        correct_answer: q.correct_answer || "",
        marks: q.marks,
        negative_marks: q.negative_marks,
        section: q.section || "",
      };
    }
    return {
      type: "conventional",
      content: q.content,
      option_a: "",
      option_b: "",
      option_c: "",
      option_d: "",
      correct_answer: "",
      marks: q.marks,
      negative_marks: q.negative_marks,
      section: q.section || "",
    };
  });

  return Papa.unparse(rows);
}

// Generate CSV template content
export function generateCSVTemplate(): string {
  const templateRows = [
    {
      type: "mcq",
      content: "What is the capital of Sikkim?",
      option_a: "Gangtok",
      option_b: "Namchi",
      option_c: "Mangan",
      option_d: "Gyalshing",
      correct_answer: "a",
      marks: 2,
      negative_marks: 0.5,
      section: "Sikkim GK",
    },
    {
      type: "mcq",
      content: "Which river flows through Sikkim?",
      option_a: "Teesta",
      option_b: "Ganga",
      option_c: "Yamuna",
      option_d: "Brahmaputra",
      correct_answer: "a",
      marks: 2,
      negative_marks: 0.5,
      section: "Geography",
    },
    {
      type: "conventional",
      content: "Explain the importance of organic farming in Sikkim.",
      option_a: "",
      option_b: "",
      option_c: "",
      option_d: "",
      correct_answer: "",
      marks: 10,
      negative_marks: 0,
      section: "Agriculture",
    },
  ];

  return Papa.unparse(templateRows);
}

// Generate Excel template as ArrayBuffer
export async function generateExcelTemplate(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Questions");

  // Set column widths and headers
  worksheet.columns = [
    { header: "type", key: "type", width: 12 },
    { header: "content", key: "content", width: 50 },
    { header: "option_a", key: "option_a", width: 20 },
    { header: "option_b", key: "option_b", width: 20 },
    { header: "option_c", key: "option_c", width: 20 },
    { header: "option_d", key: "option_d", width: 20 },
    { header: "correct_answer", key: "correct_answer", width: 15 },
    { header: "marks", key: "marks", width: 8 },
    { header: "negative_marks", key: "negative_marks", width: 15 },
    { header: "section", key: "section", width: 15 },
  ];

  // Add template rows
  worksheet.addRow({
    type: "mcq",
    content: "What is the capital of Sikkim?",
    option_a: "Gangtok",
    option_b: "Namchi",
    option_c: "Mangan",
    option_d: "Gyalshing",
    correct_answer: "a",
    marks: 2,
    negative_marks: 0.5,
    section: "Sikkim GK",
  });

  worksheet.addRow({
    type: "mcq",
    content: "Which river flows through Sikkim?",
    option_a: "Teesta",
    option_b: "Ganga",
    option_c: "Yamuna",
    option_d: "Brahmaputra",
    correct_answer: "a",
    marks: 2,
    negative_marks: 0.5,
    section: "Geography",
  });

  worksheet.addRow({
    type: "conventional",
    content: "Explain the importance of organic farming in Sikkim.",
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    correct_answer: "",
    marks: 10,
    negative_marks: 0,
    section: "Agriculture",
  });

  // Style header row
  worksheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

// Download helper
export function downloadFile(content: string | ArrayBuffer, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
