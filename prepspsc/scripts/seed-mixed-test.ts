/**
 * Seed script to create a mixed MCQ + Essay test
 * Run with: npx tsx scripts/seed-mixed-test.ts
 *
 * Make sure to set your Supabase credentials in .env.local first
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load env
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes("your-project")) {
  console.error("Please set your Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedMixedTest() {
  console.log("Creating mixed MCQ + Essay test...\n");

  // 1. Create a category if it doesn't exist
  const { data: existingCategory } = await supabase
    .from("exam_categories")
    .select("*")
    .eq("name", "General Studies")
    .single();

  let categoryId = existingCategory?.id;

  if (!categoryId) {
    const { data: newCategory, error: catError } = await supabase
      .from("exam_categories")
      .insert({
        name: "General Studies",
        description: "GS papers covering history, polity, geography, and more",
        sort_order: 1,
      })
      .select()
      .single();

    if (catError) {
      console.error("Error creating category:", catError);
      return;
    }
    categoryId = newCategory.id;
    console.log("✓ Created category: General Studies");
  } else {
    console.log("✓ Using existing category: General Studies");
  }

  // 2. Create the test
  const { data: test, error: testError } = await supabase
    .from("tests")
    .insert({
      title: "Sikkim GK Mixed Test - Demo",
      description: "A demo test with both MCQ and essay questions about Sikkim history and culture. This test demonstrates the AI evaluation feature.",
      category_id: categoryId,
      is_premium: false,
      duration_minutes: 30,
      total_marks: 50,
      passing_marks: 25,
      test_type: "mixed",
    })
    .select()
    .single();

  if (testError) {
    console.error("Error creating test:", testError);
    return;
  }

  console.log(`✓ Created test: ${test.title} (ID: ${test.id})`);

  // 3. Create sections
  const sections = [
    { name: "History", sort_order: 1 },
    { name: "Geography", sort_order: 2 },
    { name: "Culture", sort_order: 3 },
  ];

  const sectionIds: Record<string, number> = {};

  for (const section of sections) {
    const { data: newSection, error: secError } = await supabase
      .from("test_sections")
      .insert({
        test_id: test.id,
        name: section.name,
        sort_order: section.sort_order,
      })
      .select()
      .single();

    if (secError) {
      console.error(`Error creating section ${section.name}:`, secError);
      continue;
    }
    sectionIds[section.name] = newSection.id;
    console.log(`✓ Created section: ${section.name}`);
  }

  // 4. Create MCQ questions
  const mcqQuestions = [
    {
      content: "In which year did Sikkim become the 22nd state of India?",
      options: [
        { id: "a", text: "1971" },
        { id: "b", text: "1973" },
        { id: "c", text: "1975" },
        { id: "d", text: "1977" },
      ],
      correct_answer: "c",
      marks: 2,
      negative_marks: 0.5,
      section: "History",
      explanation: "Sikkim became the 22nd state of India on May 16, 1975 after a referendum in which 97.5% of voters supported abolition of the monarchy.",
    },
    {
      content: "Which river is the main tributary of the Teesta River in Sikkim?",
      options: [
        { id: "a", text: "Rangeet" },
        { id: "b", text: "Lachung" },
        { id: "c", text: "Dikchu" },
        { id: "d", text: "Rongni" },
      ],
      correct_answer: "a",
      marks: 2,
      negative_marks: 0.5,
      section: "Geography",
      explanation: "The Rangeet River is the main tributary of the Teesta River. It originates from the Rathong Glacier and meets the Teesta near Melli.",
    },
    {
      content: "What is the highest peak in Sikkim?",
      options: [
        { id: "a", text: "Mount Everest" },
        { id: "b", text: "Kanchenjunga" },
        { id: "c", text: "Pandim" },
        { id: "d", text: "Kabru" },
      ],
      correct_answer: "b",
      marks: 2,
      negative_marks: 0.5,
      section: "Geography",
      explanation: "Kanchenjunga (8,586m) is the highest peak in Sikkim and the third highest mountain in the world. It is considered sacred by the people of Sikkim.",
    },
    {
      content: "Which dynasty ruled Sikkim before it became part of India?",
      options: [
        { id: "a", text: "Chogyal Dynasty" },
        { id: "b", text: "Namgyal Dynasty" },
        { id: "c", text: "Bhutia Dynasty" },
        { id: "d", text: "Lepcha Dynasty" },
      ],
      correct_answer: "b",
      marks: 2,
      negative_marks: 0.5,
      section: "History",
      explanation: "The Namgyal Dynasty ruled Sikkim from 1642 until 1975. The rulers were known as Chogyal (meaning 'Righteous King').",
    },
    {
      content: "What is the traditional dance form of the Lepcha community?",
      options: [
        { id: "a", text: "Cham" },
        { id: "b", text: "Zho-ma-lu-shao" },
        { id: "c", text: "Singhi Chaam" },
        { id: "d", text: "Maruni" },
      ],
      correct_answer: "b",
      marks: 2,
      negative_marks: 0.5,
      section: "Culture",
      explanation: "Zho-ma-lu-shao is a traditional harvest dance of the Lepcha community performed during Tendong Lho Rum Faat festival.",
    },
    {
      content: "Which monastery is the oldest in Sikkim?",
      options: [
        { id: "a", text: "Rumtek Monastery" },
        { id: "b", text: "Pemayangtse Monastery" },
        { id: "c", text: "Enchey Monastery" },
        { id: "d", text: "Dubdi Monastery" },
      ],
      correct_answer: "d",
      marks: 2,
      negative_marks: 0.5,
      section: "Culture",
      explanation: "Dubdi Monastery, also known as 'The Hermit's Cell', was built in 1701 and is the oldest monastery in Sikkim.",
    },
  ];

  // 5. Create Essay questions
  const essayQuestions = [
    {
      content: "Discuss the significance of Kanchenjunga in the culture and traditions of Sikkim. How has the mountain influenced the religious beliefs and daily life of the local communities?",
      marks: 15,
      word_limit: 250,
      section: "Culture",
      model_answer: "Kanchenjunga holds immense cultural and religious significance for the people of Sikkim. Key points to cover:\n\n1. Religious Significance:\n- Considered sacred by both Buddhist and indigenous communities\n- Worshipped as a protective deity (Dzonga)\n- The annual Pang Lhabsol festival celebrates Kanchenjunga as the guardian deity\n\n2. Cultural Impact:\n- Features prominently in local folklore and legends\n- Influences art, music, and traditional dances\n- The mountain is never climbed by locals out of respect\n\n3. Daily Life:\n- Guides agricultural practices through weather patterns\n- Tourism and trekking economy centered around the mountain\n- Environmental conservation efforts tied to religious reverence\n\n4. Identity:\n- Symbol of Sikkimese identity and pride\n- State emblem features the mountain\n- Unifying element across different ethnic communities",
    },
    {
      content: "Analyze the factors that led to the merger of Sikkim with India in 1975. What were the political, social, and economic conditions that influenced this historic decision?",
      marks: 15,
      word_limit: 300,
      section: "History",
      model_answer: "The merger of Sikkim with India in 1975 was influenced by multiple factors:\n\n1. Political Factors:\n- Growing pro-democracy movement against the Chogyal's monarchy\n- India's concerns about Chinese influence in the region\n- Strategic importance of Sikkim for national security\n- The 1973 anti-Chogyal agitation and subsequent elections\n\n2. Social Factors:\n- Ethnic tensions between Nepali majority and Bhutia-Lepcha minority\n- Demands for democratic representation\n- Influence of democratic movements in neighboring regions\n- Education and exposure leading to political awareness\n\n3. Economic Factors:\n- Economic dependence on India for trade and supplies\n- Limited resources and development under the monarchy\n- Desire for economic integration with India\n\n4. The Referendum:\n- April 1975 referendum with 97.5% support for merger\n- Constitutional amendment making Sikkim the 22nd state\n- Role of Kazi Lhendup Dorji and the Sikkim Congress\n\n5. International Context:\n- Cold War dynamics\n- China's claims and border disputes\n- Treaty relationships with India since 1950",
    },
  ];

  // Insert MCQ questions
  let sortOrder = 1;
  for (const q of mcqQuestions) {
    const { error: qError } = await supabase.from("questions").insert({
      test_id: test.id,
      content: q.content,
      type: "mcq",
      options: q.options,
      correct_answer: q.correct_answer,
      marks: q.marks,
      negative_marks: q.negative_marks,
      explanation: q.explanation,
      section_id: sectionIds[q.section] || null,
      sort_order: sortOrder++,
    });

    if (qError) {
      console.error(`Error creating MCQ question:`, qError);
    } else {
      console.log(`✓ Created MCQ: ${q.content.substring(0, 50)}...`);
    }
  }

  // Insert Essay questions
  for (const q of essayQuestions) {
    const { error: qError } = await supabase.from("questions").insert({
      test_id: test.id,
      content: q.content,
      type: "conventional",
      marks: q.marks,
      word_limit: q.word_limit,
      model_answer: q.model_answer,
      section_id: sectionIds[q.section] || null,
      sort_order: sortOrder++,
      negative_marks: 0,
    });

    if (qError) {
      console.error(`Error creating essay question:`, qError);
    } else {
      console.log(`✓ Created Essay: ${q.content.substring(0, 50)}...`);
    }
  }

  console.log("\n========================================");
  console.log(`✅ Test created successfully!`);
  console.log(`   Test ID: ${test.id}`);
  console.log(`   Total MCQ Questions: ${mcqQuestions.length}`);
  console.log(`   Total Essay Questions: ${essayQuestions.length}`);
  console.log(`   Total Marks: ${test.total_marks}`);
  console.log(`   Duration: ${test.duration_minutes} minutes`);
  console.log("\n   Visit: http://localhost:3000/test/${test.id}");
  console.log("========================================\n");
}

seedMixedTest().catch(console.error);
