/**
 * SPSC Form Handler
 * Multi-step conversational flow for collecting SPSC recruitment form data
 * Pattern follows registration.ts exactly
 *
 * Flow:
 * start → select_recruitment → portal_creds → portal_email → portal_password →
 * full_name → father_name → mother_name → dob → gender → category →
 * marital_status → address_permanent → address_correspondence → phone → email →
 * education_count → education_details → experience_ask → [experience_details] →
 * photo_upload → signature_upload → id_upload → cert_upload → review → confirm
 */

import { createClient } from "@supabase/supabase-js";
import type { BotConnection, BotMessage, BotResponse, BotButton } from "@/lib/bot/types";
import { downloadFile, deleteMessage } from "@/lib/bot/adapters/telegram";
import { encrypt } from "@/lib/bot/encryption";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Collection steps
type CollectionStep =
  | "start"
  | "select_recruitment"
  | "portal_creds"
  | "portal_email"
  | "portal_password"
  | "full_name"
  | "father_name"
  | "mother_name"
  | "dob"
  | "gender"
  | "category"
  | "marital_status"
  | "address_permanent"
  | "address_correspondence"
  | "phone"
  | "email"
  | "education_count"
  | "education_details"
  | "experience_ask"
  | "experience_details"
  | "photo_upload"
  | "signature_upload"
  | "id_upload"
  | "cert_upload"
  | "review"
  | "confirm";

interface FormCollection {
  id: string;
  platform: string;
  platform_user_id: string;
  user_id: string | null;
  collection_step: CollectionStep;
  collected_data: Record<string, unknown>;
  sub_step: string | null;
  sub_step_index: number;
  target_recruitment_id: string | null;
}

// Degree options for inline keyboard
const DEGREE_OPTIONS = [
  { id: "10th", label: "10th" },
  { id: "12th", label: "12th" },
  { id: "graduate", label: "Graduate" },
  { id: "post_graduate", label: "Post Graduate" },
  { id: "diploma", label: "Diploma" },
  { id: "other", label: "Other" },
];

// ─── State helpers ────────────────────────────────────────────────────────────

async function getCollection(
  platform: string,
  platformUserId: string
): Promise<FormCollection | null> {
  const { data } = await supabase
    .from("spsc_form_collection")
    .select("*")
    .eq("platform", platform)
    .eq("platform_user_id", platformUserId)
    .single();

  return data as FormCollection | null;
}

async function startCollection(
  platform: string,
  platformUserId: string,
  userId: string | null
): Promise<void> {
  await supabase
    .from("spsc_form_collection")
    .upsert(
      {
        platform,
        platform_user_id: platformUserId,
        user_id: userId,
        collection_step: "select_recruitment",
        collected_data: {},
        sub_step: null,
        sub_step_index: 0,
        target_recruitment_id: null,
      },
      { onConflict: "platform,platform_user_id" }
    );
}

async function updateCollection(
  id: string,
  step: CollectionStep,
  dataUpdates: Record<string, unknown>,
  subStep?: string | null,
  subStepIndex?: number
): Promise<void> {
  const { data: current } = await supabase
    .from("spsc_form_collection")
    .select("collected_data")
    .eq("id", id)
    .single();

  const update: Record<string, unknown> = {
    collection_step: step,
    collected_data: { ...current?.collected_data, ...dataUpdates },
  };

  if (subStep !== undefined) update.sub_step = subStep;
  if (subStepIndex !== undefined) update.sub_step_index = subStepIndex;

  await supabase
    .from("spsc_form_collection")
    .update(update)
    .eq("id", id);
}

async function deleteCollection(id: string): Promise<void> {
  await supabase.from("spsc_form_collection").delete().eq("id", id);
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function isValidDate(dateStr: string): boolean {
  // Accept DD/MM/YYYY or DD-MM-YYYY
  const match = dateStr.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (!match) return false;
  const [, dd, mm, yyyy] = match;
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (year < 1950 || year > 2010) return false;
  return true;
}

function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-+]/g, "");
  return /^\d{10,12}$/.test(cleaned);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidYear(year: string): boolean {
  const y = parseInt(year.trim(), 10);
  return /^\d{4}$/.test(year.trim()) && y >= 1970 && y <= 2030;
}

function isValidPercentage(pct: string): boolean {
  const n = parseFloat(pct.trim());
  return !isNaN(n) && n >= 0 && n <= 100;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check if user is currently in the SPSC form collection flow
 */
export async function isInSpscFormFlow(
  platform: string,
  platformUserId: string
): Promise<boolean> {
  const collection = await getCollection(platform, platformUserId);
  return !!collection;
}

export async function cancelSpscFormFlow(
  platform: string,
  platformUserId: string
): Promise<void> {
  const collection = await getCollection(platform, platformUserId);
  if (collection) {
    await deleteCollection(collection.id);
  }
}

/**
 * Main handler — route to the correct step handler
 */
export async function handleSpscForm(
  connection: BotConnection,
  message: BotMessage,
  callbackData?: string
): Promise<BotResponse> {
  let collection = await getCollection(connection.platform, connection.platform_user_id);

  // Start new collection if none exists
  if (!collection) {
    // Check if user has a previous application with saved data
    if (connection.user_id) {
      const { data: prevApp } = await supabase
        .from("spsc_form_applications")
        .select("full_name, father_name, mother_name, date_of_birth, gender, category, marital_status, permanent_address, correspondence_address, phone, email, qualifications, work_experience, portal_email_encrypted")
        .eq("user_id", connection.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (prevApp?.full_name) {
        await startCollection(connection.platform, connection.platform_user_id, connection.user_id);
        collection = await getCollection(connection.platform, connection.platform_user_id);
        if (collection) {
          // Store previous data reference so we can offer to reuse
          await updateCollection(collection.id, "select_recruitment", {
            has_previous_application: true,
            previous_name: prevApp.full_name,
          });

          // Check for active recruitments
          const buttons = await getRecruitmentButtons();
          const recruitmentText = buttons.length > 0
            ? "\n\nSelect the recruitment you want to apply for:"
            : "\n\nThere are no active recruitments right now, but you can pre-fill your details.";

          const actionButtons = buttons.length > 0
            ? [...buttons, { text: "Use previous details", callbackData: "spsc_reuse_prev" }]
            : [
                { text: "Use previous details", callbackData: "spsc_reuse_prev" },
                { text: "Start fresh", callbackData: "spsc_reuse_no" },
                { text: "Notify me later", callbackData: "spsc_prefill_no" },
              ];

          return {
            text: `<b>SPSC Form Assistant</b>\n\nWelcome back, <b>${prevApp.full_name}</b>! I have your details from a previous application. You can reuse them or start fresh.${recruitmentText}`,
            parseMode: "HTML",
            buttons: actionButtons,
          };
        }
      }
    }

    await startCollection(connection.platform, connection.platform_user_id, connection.user_id);
    collection = await getCollection(connection.platform, connection.platform_user_id);
  }

  if (!collection) {
    return { text: "Something went wrong. Please try again with /fillspscform" };
  }

  const step = collection.collection_step;

  switch (step) {
    case "select_recruitment":
      return handleSelectRecruitment(collection, message, callbackData);
    case "portal_creds":
      return handlePortalCreds(collection, message, callbackData);
    case "portal_email":
      return handlePortalEmail(collection, message);
    case "portal_password":
      return handlePortalPassword(collection, message);
    case "full_name":
      return handleFullName(collection, message);
    case "father_name":
      return handleFatherName(collection, message);
    case "mother_name":
      return handleMotherName(collection, message);
    case "dob":
      return handleDob(collection, message);
    case "gender":
      return handleGender(collection, message, callbackData);
    case "category":
      return handleCategory(collection, message, callbackData);
    case "marital_status":
      return handleMaritalStatus(collection, message, callbackData);
    case "address_permanent":
      return handleAddressPermanent(collection, message);
    case "address_correspondence":
      return handleAddressCorrespondence(collection, message, callbackData);
    case "phone":
      return handlePhone(collection, message);
    case "email":
      return handleEmail(collection, message);
    case "education_count":
      return handleEducationCount(collection, message, callbackData);
    case "education_details":
      return handleEducationDetails(collection, message, callbackData);
    case "experience_ask":
      return handleExperienceAsk(collection, message, callbackData);
    case "experience_details":
      return handleExperienceDetails(collection, message, callbackData);
    case "photo_upload":
      return handlePhotoUpload(collection, message);
    case "signature_upload":
      return handleSignatureUpload(collection, message);
    case "id_upload":
      return handleIdUpload(collection, message);
    case "cert_upload":
      return handleCertUpload(collection, message, callbackData);
    case "review":
      return handleReview(collection, message, callbackData);
    case "confirm":
      return handleConfirm(collection, message, callbackData);
    default:
      return { text: "Something went wrong. Please try again with /fillspscform" };
  }
}

// ─── Step handlers ────────────────────────────────────────────────────────────

async function handleSelectRecruitment(
  collection: FormCollection,
  message: BotMessage,
  callbackData?: string
): Promise<BotResponse> {
  // Handle "reuse previous details"
  if (callbackData === "spsc_reuse_prev" && collection.user_id) {
    const { data: prevApp } = await supabase
      .from("spsc_form_applications")
      .select("full_name, father_name, mother_name, date_of_birth, gender, category, marital_status, permanent_address, correspondence_address, phone, email, qualifications, work_experience, portal_email_encrypted")
      .eq("user_id", collection.user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (prevApp) {
      // Pre-populate collected_data with previous application data
      const reusedData: Record<string, unknown> = {
        reused_from_previous: true,
        full_name: prevApp.full_name,
        father_name: prevApp.father_name,
        mother_name: prevApp.mother_name,
        dob: prevApp.date_of_birth,
        gender: prevApp.gender,
        category: prevApp.category,
        marital_status: prevApp.marital_status,
        address_permanent: prevApp.permanent_address,
        address_correspondence: prevApp.correspondence_address,
        phone: prevApp.phone,
        email: prevApp.email,
        qualifications: prevApp.qualifications,
        work_experience: prevApp.work_experience,
      };

      // Skip to review step with all data pre-filled
      await updateCollection(collection.id, "review", reusedData);

      const summary = [
        `<b>Name:</b> ${prevApp.full_name}`,
        `<b>Father:</b> ${prevApp.father_name || "—"}`,
        `<b>Mother:</b> ${prevApp.mother_name || "—"}`,
        `<b>DOB:</b> ${prevApp.date_of_birth || "—"}`,
        `<b>Gender:</b> ${prevApp.gender || "—"}`,
        `<b>Category:</b> ${prevApp.category || "—"}`,
        `<b>Phone:</b> ${prevApp.phone || "—"}`,
        `<b>Email:</b> ${prevApp.email || "—"}`,
      ].join("\n");

      return {
        text: `<b>Previous Details Loaded</b>\n\n${summary}\n\nDoes everything look correct?`,
        parseMode: "HTML",
        buttons: [
          { text: "Looks good", callbackData: "spsc_review_confirm" },
          { text: "Start fresh instead", callbackData: "spsc_reuse_no" },
        ],
      };
    }
  }

  // Handle "start fresh" — reset collection and continue normally
  if (callbackData === "spsc_reuse_no") {
    await updateCollection(collection.id, "select_recruitment", {});
    // Fall through to show recruitments or pre-fill flow below
  }

  // If callback data provided, user selected a recruitment
  if (callbackData?.startsWith("spsc_recruit_")) {
    const recruitId = callbackData.replace("spsc_recruit_", "");

    // Fetch recruitment details
    const { data: recruitment } = await supabase
      .from("spsc_recruitments")
      .select("id, title, closing_date")
      .eq("id", recruitId)
      .single();

    if (!recruitment) {
      return {
        text: "That recruitment was not found. Please select from the list below.",
        parseMode: "HTML",
        buttons: await getRecruitmentButtons(),
      };
    }

    await supabase
      .from("spsc_form_collection")
      .update({ target_recruitment_id: recruitId })
      .eq("id", collection.id);

    await updateCollection(collection.id, "portal_creds", {
      recruitment_id: recruitId,
      recruitment_title: recruitment.title,
    });

    return {
      text: `You selected: <b>${recruitment.title}</b>\n\nDo you already have an SPSC portal account?`,
      parseMode: "HTML",
      buttons: [
        { text: "Yes, I have one", callbackData: "spsc_portal_yes" },
        { text: "No, register me", callbackData: "spsc_portal_no" },
      ],
    };
  }

  // Show available recruitments
  const buttons = await getRecruitmentButtons();

  if (buttons.length === 0) {
    // Don't delete collection yet — user might want to pre-fill
    await updateCollection(collection.id, "portal_creds", {});
    return {
      text: `<b>SPSC Form Assistant</b>

There are no active recruitments right now, but you can <b>pre-fill your details</b> so your application is ready the moment a new one opens.

Here's a quick guide for when you apply on the <a href="https://spsc.sikkim.gov.in">SPSC portal</a>:

1. Complete <b>One Time Registration (OTR)</b> — you'll need a valid email and mobile number
2. Keep scanned copies of your <b>COI</b>, <b>Category Certificate</b>, and <b>marksheets</b> (Class X onwards) ready
3. Log in, select the advertisement, and fill in your details
4. Pay the application fee online and download the <b>Application Receipt</b>

<b>Pro-tip:</b> Double-check your name and DOB against your Class X certificate to avoid mismatches.`,
      parseMode: "HTML",
      buttons: [
        { text: "Yes, I have a portal account", callbackData: "spsc_prefill_has_account" },
        { text: "No, I need to register", callbackData: "spsc_prefill_no_account" },
        { text: "Notify me later", callbackData: "spsc_prefill_no" },
      ],
    };
  }

  return {
    text: "<b>SPSC Form Assistant</b>\n\nSelect the recruitment you want to apply for:",
    parseMode: "HTML",
    buttons,
  };
}

async function getRecruitmentButtons(): Promise<BotButton[]> {
  const { data: recruitments } = await supabase
    .from("spsc_recruitments")
    .select("id, title")
    .eq("is_active", true)
    .order("closing_date", { ascending: true })
    .limit(10);

  if (!recruitments || recruitments.length === 0) return [];

  return recruitments.map((r) => ({
    text: r.title,
    callbackData: `spsc_recruit_${r.id}`,
  }));
}

async function handlePortalCreds(
  collection: FormCollection,
  message: BotMessage,
  callbackData?: string
): Promise<BotResponse> {
  // Handle pre-fill flow — user HAS a portal account
  if (callbackData === "spsc_prefill_has_account") {
    await updateCollection(collection.id, "portal_email", { prefill_mode: true, has_portal_account: true });
    return {
      text: `Great! You already have an account on the <a href="https://spscrecruitment.sikkim.gov.in/rpaonline/login">SPSC portal</a>.\n\nLet's save your portal credentials so I can fill forms for you automatically.\n\nPlease enter your portal <b>email address</b>:`,
      parseMode: "HTML",
    };
  }

  // Handle pre-fill flow — user needs to register
  if (callbackData === "spsc_prefill_no_account") {
    await updateCollection(collection.id, "portal_email", { prefill_mode: true, has_portal_account: false });
    return {
      text: `No problem! You'll need to register on the <a href="https://spscrecruitment.sikkim.gov.in/rpaonline/login">SPSC portal</a> first.\n\nI'll save your details now so when a recruitment opens, I can help you register and apply quickly.\n\nPlease enter the <b>email address</b> you'd like to use for registration:`,
      parseMode: "HTML",
    };
  }

  if (callbackData === "spsc_prefill_no") {
    await deleteCollection(collection.id);
    // Save notification preference
    if (collection.user_id) {
      await supabase.from("spsc_user_preferences").upsert(
        { user_id: collection.user_id, notify_new_recruitments: true },
        { onConflict: "user_id" }
      );
    }
    return {
      text: "No problem! I'll send you a notification as soon as a new SPSC recruitment is published.",
      parseMode: "HTML",
    };
  }

  if (callbackData === "spsc_portal_yes") {
    await updateCollection(collection.id, "portal_email", { has_portal_account: true });
    return {
      text: "Please enter your SPSC portal <b>email address</b>:",
      parseMode: "HTML",
    };
  }

  if (callbackData === "spsc_portal_no") {
    await updateCollection(collection.id, "portal_email", { has_portal_account: false });
    return {
      text: "No problem, I'll register you on the portal.\n\nPlease enter the <b>email address</b> you'd like to use:",
      parseMode: "HTML",
    };
  }

  // Prompt again if no valid callback
  return {
    text: "Do you already have an SPSC portal account?",
    parseMode: "HTML",
    buttons: [
      { text: "Yes, I have one", callbackData: "spsc_portal_yes" },
      { text: "No, register me", callbackData: "spsc_portal_no" },
    ],
  };
}

async function handlePortalEmail(
  collection: FormCollection,
  message: BotMessage
): Promise<BotResponse> {
  const email = (message.text || "").trim();

  if (!isValidEmail(email)) {
    return {
      text: "That doesn't look like a valid email. Please enter a valid email address:",
      parseMode: "HTML",
    };
  }

  await updateCollection(collection.id, "portal_password", { portal_email: email });

  return {
    text: "Now enter your portal <b>password</b>.\n\n<i>Don't worry — I'll delete your message immediately after reading it for security.</i>",
    parseMode: "HTML",
  };
}

async function handlePortalPassword(
  collection: FormCollection,
  message: BotMessage
): Promise<BotResponse> {
  const password = (message.text || "").trim();

  // Delete the password message immediately for security
  if (message.chatId && message.metadata?.messageId) {
    await deleteMessage(message.chatId, message.metadata.messageId as number);
  }

  if (password.length < 4) {
    return {
      text: "Password seems too short. Please enter your portal password (minimum 4 characters):",
      parseMode: "HTML",
    };
  }

  // Encrypt the password before storing
  const encryptedPassword = encrypt(password);

  await updateCollection(collection.id, "full_name", {
    portal_password_encrypted: encryptedPassword,
  });

  return {
    text: "Password saved securely.\n\nNow let's collect your personal details.\n\nWhat is your <b>full name</b> (as per official documents)?",
    parseMode: "HTML",
  };
}

async function handleFullName(
  collection: FormCollection,
  message: BotMessage
): Promise<BotResponse> {
  const name = (message.text || "").trim();

  if (name.length < 2 || name.length > 100) {
    return {
      text: "Please enter a valid full name (2-100 characters):",
      parseMode: "HTML",
    };
  }

  await updateCollection(collection.id, "father_name", { full_name: name });

  return {
    text: `Got it, <b>${name}</b>.\n\nWhat is your <b>father's name</b>?`,
    parseMode: "HTML",
  };
}

async function handleFatherName(
  collection: FormCollection,
  message: BotMessage
): Promise<BotResponse> {
  const name = (message.text || "").trim();

  if (name.length < 2 || name.length > 100) {
    return {
      text: "Please enter a valid name (2-100 characters):",
      parseMode: "HTML",
    };
  }

  await updateCollection(collection.id, "mother_name", { father_name: name });

  return {
    text: "What is your <b>mother's name</b>?",
    parseMode: "HTML",
  };
}

async function handleMotherName(
  collection: FormCollection,
  message: BotMessage
): Promise<BotResponse> {
  const name = (message.text || "").trim();

  if (name.length < 2 || name.length > 100) {
    return {
      text: "Please enter a valid name (2-100 characters):",
      parseMode: "HTML",
    };
  }

  await updateCollection(collection.id, "dob", { mother_name: name });

  return {
    text: "What is your <b>date of birth</b>?\n\n<i>Format: DD/MM/YYYY (e.g., 15/08/1995)</i>",
    parseMode: "HTML",
  };
}

async function handleDob(
  collection: FormCollection,
  message: BotMessage
): Promise<BotResponse> {
  const dob = (message.text || "").trim();

  if (!isValidDate(dob)) {
    return {
      text: "Invalid date format. Please use <b>DD/MM/YYYY</b> (e.g., 15/08/1995):",
      parseMode: "HTML",
    };
  }

  await updateCollection(collection.id, "gender", { dob });

  return {
    text: "Select your <b>gender</b>:",
    parseMode: "HTML",
    buttons: [
      { text: "Male", callbackData: "spsc_gender_male" },
      { text: "Female", callbackData: "spsc_gender_female" },
      { text: "Other", callbackData: "spsc_gender_other" },
    ],
  };
}

async function handleGender(
  collection: FormCollection,
  message: BotMessage,
  callbackData?: string
): Promise<BotResponse> {
  let gender: string | null = null;

  if (callbackData?.startsWith("spsc_gender_")) {
    gender = callbackData.replace("spsc_gender_", "");
  } else {
    const text = (message.text || "").toLowerCase().trim();
    if (text === "male" || text === "m") gender = "male";
    else if (text === "female" || text === "f") gender = "female";
    else if (text === "other") gender = "other";
  }

  if (!gender) {
    return {
      text: "Please select your gender:",
      parseMode: "HTML",
      buttons: [
        { text: "Male", callbackData: "spsc_gender_male" },
        { text: "Female", callbackData: "spsc_gender_female" },
        { text: "Other", callbackData: "spsc_gender_other" },
      ],
    };
  }

  await updateCollection(collection.id, "category", { gender });

  return {
    text: "Select your <b>category</b>:",
    parseMode: "HTML",
    buttons: [
      { text: "General", callbackData: "spsc_cat_general" },
      { text: "SC", callbackData: "spsc_cat_sc" },
      { text: "ST", callbackData: "spsc_cat_st" },
      { text: "OBC", callbackData: "spsc_cat_obc" },
      { text: "EWS", callbackData: "spsc_cat_ews" },
    ],
  };
}

async function handleCategory(
  collection: FormCollection,
  message: BotMessage,
  callbackData?: string
): Promise<BotResponse> {
  let category: string | null = null;

  if (callbackData?.startsWith("spsc_cat_")) {
    category = callbackData.replace("spsc_cat_", "");
  } else {
    const text = (message.text || "").toLowerCase().trim();
    const options = ["general", "sc", "st", "obc", "ews"];
    if (options.includes(text)) category = text;
  }

  if (!category) {
    return {
      text: "Please select your category:",
      parseMode: "HTML",
      buttons: [
        { text: "General", callbackData: "spsc_cat_general" },
        { text: "SC", callbackData: "spsc_cat_sc" },
        { text: "ST", callbackData: "spsc_cat_st" },
        { text: "OBC", callbackData: "spsc_cat_obc" },
        { text: "EWS", callbackData: "spsc_cat_ews" },
      ],
    };
  }

  await updateCollection(collection.id, "marital_status", { category: category.toUpperCase() });

  return {
    text: "Select your <b>marital status</b>:",
    parseMode: "HTML",
    buttons: [
      { text: "Single", callbackData: "spsc_marital_single" },
      { text: "Married", callbackData: "spsc_marital_married" },
      { text: "Divorced", callbackData: "spsc_marital_divorced" },
      { text: "Widowed", callbackData: "spsc_marital_widowed" },
    ],
  };
}

async function handleMaritalStatus(
  collection: FormCollection,
  message: BotMessage,
  callbackData?: string
): Promise<BotResponse> {
  let status: string | null = null;

  if (callbackData?.startsWith("spsc_marital_")) {
    status = callbackData.replace("spsc_marital_", "");
  } else {
    const text = (message.text || "").toLowerCase().trim();
    const options = ["single", "married", "divorced", "widowed"];
    if (options.includes(text)) status = text;
  }

  if (!status) {
    return {
      text: "Please select your marital status:",
      parseMode: "HTML",
      buttons: [
        { text: "Single", callbackData: "spsc_marital_single" },
        { text: "Married", callbackData: "spsc_marital_married" },
        { text: "Divorced", callbackData: "spsc_marital_divorced" },
        { text: "Widowed", callbackData: "spsc_marital_widowed" },
      ],
    };
  }

  await updateCollection(collection.id, "address_permanent", {
    marital_status: status.charAt(0).toUpperCase() + status.slice(1),
  });

  return {
    text: "Enter your <b>permanent address</b>:\n\n<i>Include house/flat no, street, city, state, and PIN code.</i>",
    parseMode: "HTML",
  };
}

async function handleAddressPermanent(
  collection: FormCollection,
  message: BotMessage
): Promise<BotResponse> {
  const address = (message.text || "").trim();

  if (address.length < 10) {
    return {
      text: "Address seems too short. Please enter your full permanent address (include house no, street, city, state, PIN):",
      parseMode: "HTML",
    };
  }

  await updateCollection(collection.id, "address_correspondence", { address_permanent: address });

  return {
    text: "Is your <b>correspondence address</b> the same as your permanent address?",
    parseMode: "HTML",
    buttons: [
      { text: "Same as permanent", callbackData: "spsc_addr_same" },
      { text: "Different address", callbackData: "spsc_addr_diff" },
    ],
  };
}

async function handleAddressCorrespondence(
  collection: FormCollection,
  message: BotMessage,
  callbackData?: string
): Promise<BotResponse> {
  if (callbackData === "spsc_addr_same") {
    const permanentAddr = collection.collected_data.address_permanent as string;
    await updateCollection(collection.id, "phone", {
      address_correspondence: permanentAddr,
    });
    return {
      text: "Enter your <b>phone number</b>:",
      parseMode: "HTML",
    };
  }

  if (callbackData === "spsc_addr_diff") {
    // Stay on this step but now expect text input
    await updateCollection(collection.id, "address_correspondence", {
      _awaiting_correspondence: true,
    });
    return {
      text: "Enter your <b>correspondence address</b>:\n\n<i>Include house/flat no, street, city, state, and PIN code.</i>",
      parseMode: "HTML",
    };
  }

  // Text input for correspondence address (after selecting "Different address")
  const address = (message.text || "").trim();

  if (address.length < 10) {
    return {
      text: "Address seems too short. Please enter your full correspondence address:",
      parseMode: "HTML",
    };
  }

  await updateCollection(collection.id, "phone", {
    address_correspondence: address,
    _awaiting_correspondence: undefined,
  });

  return {
    text: "Enter your <b>phone number</b>:",
    parseMode: "HTML",
  };
}

async function handlePhone(
  collection: FormCollection,
  message: BotMessage
): Promise<BotResponse> {
  const phone = (message.text || "").trim();

  if (!isValidPhone(phone)) {
    return {
      text: "Please enter a valid 10-digit phone number:",
      parseMode: "HTML",
    };
  }

  await updateCollection(collection.id, "email", { phone });

  return {
    text: "Enter your <b>email address</b>:",
    parseMode: "HTML",
  };
}

async function handleEmail(
  collection: FormCollection,
  message: BotMessage
): Promise<BotResponse> {
  const email = (message.text || "").trim();

  if (!isValidEmail(email)) {
    return {
      text: "That doesn't look like a valid email. Please try again:",
      parseMode: "HTML",
    };
  }

  await updateCollection(collection.id, "education_count", { email });

  return {
    text: "How many <b>educational qualifications</b> do you want to add?\n\n<i>E.g., if you have 10th, 12th, and Graduation, type 3.</i>",
    parseMode: "HTML",
    buttons: [
      { text: "2", callbackData: "spsc_educount_2" },
      { text: "3", callbackData: "spsc_educount_3" },
      { text: "4", callbackData: "spsc_educount_4" },
      { text: "5", callbackData: "spsc_educount_5" },
    ],
  };
}

async function handleEducationCount(
  collection: FormCollection,
  message: BotMessage,
  callbackData?: string
): Promise<BotResponse> {
  let count: number | null = null;

  if (callbackData?.startsWith("spsc_educount_")) {
    count = parseInt(callbackData.replace("spsc_educount_", ""), 10);
  } else {
    const parsed = parseInt((message.text || "").trim(), 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) count = parsed;
  }

  if (!count) {
    return {
      text: "Please enter a number between 1 and 10:",
      parseMode: "HTML",
    };
  }

  await updateCollection(
    collection.id,
    "education_details",
    { education_count: count, education: [] },
    "degree",
    0
  );

  return {
    text: `<b>Qualification 1 of ${count}</b>\n\nSelect the <b>degree/level</b>:`,
    parseMode: "HTML",
    buttons: DEGREE_OPTIONS.map((d) => ({
      text: d.label,
      callbackData: `spsc_degree_${d.id}`,
    })),
  };
}

async function handleEducationDetails(
  collection: FormCollection,
  message: BotMessage,
  callbackData?: string
): Promise<BotResponse> {
  const subStep = collection.sub_step;
  const index = collection.sub_step_index;
  const education = (collection.collected_data.education || []) as Record<string, string>[];
  const totalCount = collection.collected_data.education_count as number;

  // Ensure current qualification entry exists
  if (!education[index]) {
    education[index] = {};
  }

  switch (subStep) {
    case "degree": {
      let degree: string | null = null;

      if (callbackData?.startsWith("spsc_degree_")) {
        degree = callbackData.replace("spsc_degree_", "");
      } else {
        const text = (message.text || "").trim();
        const match = DEGREE_OPTIONS.find(
          (d) => d.id === text.toLowerCase() || d.label.toLowerCase() === text.toLowerCase()
        );
        if (match) degree = match.id;
        else if (text.length > 0) degree = text; // Allow free-text for "Other"
      }

      if (!degree) {
        return {
          text: `<b>Qualification ${index + 1} of ${totalCount}</b>\n\nSelect the degree/level:`,
          parseMode: "HTML",
          buttons: DEGREE_OPTIONS.map((d) => ({
            text: d.label,
            callbackData: `spsc_degree_${d.id}`,
          })),
        };
      }

      education[index].degree = degree;
      await updateCollection(collection.id, "education_details", { education }, "institution");

      return {
        text: `<b>Qualification ${index + 1}: ${formatDegree(degree)}</b>\n\nEnter the <b>institution/school name</b>:`,
        parseMode: "HTML",
      };
    }

    case "institution": {
      const institution = (message.text || "").trim();

      if (institution.length < 2) {
        return {
          text: "Please enter a valid institution name:",
          parseMode: "HTML",
        };
      }

      education[index].institution = institution;
      await updateCollection(collection.id, "education_details", { education }, "board");

      return {
        text: `Enter the <b>board/university</b> name:`,
        parseMode: "HTML",
      };
    }

    case "board": {
      const board = (message.text || "").trim();

      if (board.length < 2) {
        return {
          text: "Please enter a valid board/university name:",
          parseMode: "HTML",
        };
      }

      education[index].board = board;
      await updateCollection(collection.id, "education_details", { education }, "year");

      return {
        text: "Enter the <b>year of passing</b> (e.g., 2020):",
        parseMode: "HTML",
      };
    }

    case "year": {
      const year = (message.text || "").trim();

      if (!isValidYear(year)) {
        return {
          text: "Please enter a valid 4-digit year (1970-2030):",
          parseMode: "HTML",
        };
      }

      education[index].year = year;
      await updateCollection(collection.id, "education_details", { education }, "percentage");

      return {
        text: "Enter the <b>percentage/CGPA</b> obtained:",
        parseMode: "HTML",
      };
    }

    case "percentage": {
      const pct = (message.text || "").trim();

      if (!isValidPercentage(pct)) {
        return {
          text: "Please enter a valid percentage (0-100):",
          parseMode: "HTML",
        };
      }

      education[index].percentage = pct;

      // Check if more qualifications to collect
      const nextIndex = index + 1;
      if (nextIndex < totalCount) {
        await updateCollection(
          collection.id,
          "education_details",
          { education },
          "degree",
          nextIndex
        );

        return {
          text: `Saved.\n\n<b>Qualification ${nextIndex + 1} of ${totalCount}</b>\n\nSelect the <b>degree/level</b>:`,
          parseMode: "HTML",
          buttons: DEGREE_OPTIONS.map((d) => ({
            text: d.label,
            callbackData: `spsc_degree_${d.id}`,
          })),
        };
      }

      // All education collected, move to experience
      await updateCollection(
        collection.id,
        "experience_ask",
        { education },
        null,
        0
      );

      return {
        text: "Education details saved.\n\nDo you have any <b>work experience</b> to add?",
        parseMode: "HTML",
        buttons: [
          { text: "Yes", callbackData: "spsc_exp_yes" },
          { text: "No", callbackData: "spsc_exp_no" },
        ],
      };
    }

    default: {
      // Reset sub-step to degree if something went wrong
      await updateCollection(collection.id, "education_details", {}, "degree", index);
      return {
        text: `<b>Qualification ${index + 1} of ${totalCount}</b>\n\nSelect the degree/level:`,
        parseMode: "HTML",
        buttons: DEGREE_OPTIONS.map((d) => ({
          text: d.label,
          callbackData: `spsc_degree_${d.id}`,
        })),
      };
    }
  }
}

async function handleExperienceAsk(
  collection: FormCollection,
  message: BotMessage,
  callbackData?: string
): Promise<BotResponse> {
  if (callbackData === "spsc_exp_yes") {
    await updateCollection(
      collection.id,
      "experience_details",
      { has_experience: true, experience: [] },
      "organization",
      0
    );

    return {
      text: "<b>Work Experience 1</b>\n\nEnter the <b>organization name</b>:",
      parseMode: "HTML",
    };
  }

  if (callbackData === "spsc_exp_no") {
    await updateCollection(collection.id, "photo_upload", { has_experience: false });

    return {
      text: "Now let's upload your documents.\n\nPlease send your <b>passport-size photo</b>.\n\n<i>Send it as a photo (not as a file).</i>",
      parseMode: "HTML",
    };
  }

  // Prompt again
  return {
    text: "Do you have any work experience to add?",
    parseMode: "HTML",
    buttons: [
      { text: "Yes", callbackData: "spsc_exp_yes" },
      { text: "No", callbackData: "spsc_exp_no" },
    ],
  };
}

async function handleExperienceDetails(
  collection: FormCollection,
  message: BotMessage,
  callbackData?: string
): Promise<BotResponse> {
  const subStep = collection.sub_step;
  const index = collection.sub_step_index;
  const experience = (collection.collected_data.experience || []) as Record<string, string>[];

  if (!experience[index]) {
    experience[index] = {};
  }

  switch (subStep) {
    case "organization": {
      const org = (message.text || "").trim();
      if (org.length < 2) {
        return { text: "Please enter a valid organization name:", parseMode: "HTML" };
      }
      experience[index].organization = org;
      await updateCollection(collection.id, "experience_details", { experience }, "designation");
      return {
        text: "Enter your <b>designation/role</b>:",
        parseMode: "HTML",
      };
    }

    case "designation": {
      const designation = (message.text || "").trim();
      if (designation.length < 2) {
        return { text: "Please enter a valid designation:", parseMode: "HTML" };
      }
      experience[index].designation = designation;
      await updateCollection(collection.id, "experience_details", { experience }, "from_date");
      return {
        text: "Enter the <b>start date</b> (DD/MM/YYYY):",
        parseMode: "HTML",
      };
    }

    case "from_date": {
      const fromDate = (message.text || "").trim();
      if (!isValidDate(fromDate)) {
        return {
          text: "Invalid date. Please use DD/MM/YYYY format:",
          parseMode: "HTML",
        };
      }
      experience[index].from_date = fromDate;
      await updateCollection(collection.id, "experience_details", { experience }, "to_date");
      return {
        text: "Enter the <b>end date</b> (DD/MM/YYYY), or type <b>present</b> if still working:",
        parseMode: "HTML",
      };
    }

    case "to_date": {
      const toDate = (message.text || "").trim();
      if (toDate.toLowerCase() !== "present" && !isValidDate(toDate)) {
        return {
          text: "Invalid date. Use DD/MM/YYYY or type 'present':",
          parseMode: "HTML",
        };
      }
      experience[index].to_date = toDate.toLowerCase() === "present" ? "Present" : toDate;
      await updateCollection(collection.id, "experience_details", { experience }, "description");
      return {
        text: "Briefly describe your <b>responsibilities/role</b> (1-2 lines):",
        parseMode: "HTML",
      };
    }

    case "description": {
      const description = (message.text || "").trim();
      if (description.length < 2) {
        return { text: "Please enter a brief description:", parseMode: "HTML" };
      }
      experience[index].description = description;

      // Ask if more experience entries
      await updateCollection(collection.id, "experience_details", { experience }, "more_check");

      return {
        text: "Experience saved. Do you want to add <b>more work experience</b>?",
        parseMode: "HTML",
        buttons: [
          { text: "Add more", callbackData: "spsc_expmore_yes" },
          { text: "Done", callbackData: "spsc_expmore_no" },
        ],
      };
    }

    case "more_check": {
      if (callbackData === "spsc_expmore_yes") {
        const nextIndex = index + 1;
        await updateCollection(
          collection.id,
          "experience_details",
          { experience },
          "organization",
          nextIndex
        );
        return {
          text: `<b>Work Experience ${nextIndex + 1}</b>\n\nEnter the <b>organization name</b>:`,
          parseMode: "HTML",
        };
      }

      if (callbackData === "spsc_expmore_no") {
        await updateCollection(collection.id, "photo_upload", { experience }, null, 0);
        return {
          text: "Now let's upload your documents.\n\nPlease send your <b>passport-size photo</b>.\n\n<i>Send it as a photo (not as a file).</i>",
          parseMode: "HTML",
        };
      }

      return {
        text: "Add more work experience?",
        parseMode: "HTML",
        buttons: [
          { text: "Add more", callbackData: "spsc_expmore_yes" },
          { text: "Done", callbackData: "spsc_expmore_no" },
        ],
      };
    }

    default: {
      await updateCollection(collection.id, "experience_details", {}, "organization", index);
      return {
        text: `<b>Work Experience ${index + 1}</b>\n\nEnter the organization name:`,
        parseMode: "HTML",
      };
    }
  }
}

async function handlePhotoUpload(
  collection: FormCollection,
  message: BotMessage
): Promise<BotResponse> {
  if (!message.photoUrl && !message.documentUrl) {
    return {
      text: "Please send your <b>passport-size photo</b> as an image.\n\n<i>Use the photo/camera button, not the file attachment.</i>",
      parseMode: "HTML",
    };
  }

  const fileId = message.photoUrl || message.documentUrl!;

  try {
    const buffer = await downloadFile(fileId);
    const ext = message.photoUrl ? "jpg" : (message.documentFileName?.split(".").pop() || "jpg");
    const path = `${collection.user_id || collection.platform_user_id}/${collection.id}/photo_${Date.now()}.${ext}`;

    await supabase.storage.from("spsc-documents").upload(path, buffer, {
      contentType: message.photoUrl ? "image/jpeg" : (message.documentMimeType || "image/jpeg"),
    });

    await updateCollection(collection.id, "signature_upload", { photo_path: path });

    return {
      text: "Photo uploaded.\n\nNow send your <b>signature</b> image.\n\n<i>A clear photo or scan of your signature on white paper.</i>",
      parseMode: "HTML",
    };
  } catch (error) {
    console.error("Photo upload error:", error);
    return {
      text: "Failed to upload photo. Please try sending it again.",
      parseMode: "HTML",
    };
  }
}

async function handleSignatureUpload(
  collection: FormCollection,
  message: BotMessage
): Promise<BotResponse> {
  if (!message.photoUrl && !message.documentUrl) {
    return {
      text: "Please send your <b>signature</b> image.\n\n<i>Photo or scan on white paper.</i>",
      parseMode: "HTML",
    };
  }

  const fileId = message.photoUrl || message.documentUrl!;

  try {
    const buffer = await downloadFile(fileId);
    const ext = message.photoUrl ? "jpg" : (message.documentFileName?.split(".").pop() || "jpg");
    const path = `${collection.user_id || collection.platform_user_id}/${collection.id}/signature_${Date.now()}.${ext}`;

    await supabase.storage.from("spsc-documents").upload(path, buffer, {
      contentType: message.photoUrl ? "image/jpeg" : (message.documentMimeType || "image/jpeg"),
    });

    await updateCollection(collection.id, "id_upload", { signature_path: path });

    return {
      text: "Signature uploaded.\n\nNow send your <b>ID proof</b> (Aadhaar, PAN, Voter ID, etc.).\n\n<i>You can send it as a photo or PDF document.</i>",
      parseMode: "HTML",
    };
  } catch (error) {
    console.error("Signature upload error:", error);
    return {
      text: "Failed to upload signature. Please try again.",
      parseMode: "HTML",
    };
  }
}

async function handleIdUpload(
  collection: FormCollection,
  message: BotMessage
): Promise<BotResponse> {
  if (!message.photoUrl && !message.documentUrl) {
    return {
      text: "Please send your <b>ID proof</b> as a photo or document.",
      parseMode: "HTML",
    };
  }

  const fileId = message.photoUrl || message.documentUrl!;

  try {
    const buffer = await downloadFile(fileId);
    const isPhoto = !!message.photoUrl;
    const ext = isPhoto ? "jpg" : (message.documentFileName?.split(".").pop() || "pdf");
    const path = `${collection.user_id || collection.platform_user_id}/${collection.id}/id_proof_${Date.now()}.${ext}`;

    await supabase.storage.from("spsc-documents").upload(path, buffer, {
      contentType: isPhoto ? "image/jpeg" : (message.documentMimeType || "application/pdf"),
    });

    await updateCollection(collection.id, "cert_upload", {
      id_proof_path: path,
      certificates: [],
    });

    return {
      text: "ID proof uploaded.\n\nNow send your <b>certificates</b> (marksheets, degree certificates, caste certificate, etc.).\n\n<i>Send them one by one. Tap 'Done' when finished.</i>",
      parseMode: "HTML",
      buttons: [
        { text: "Done (no certificates)", callbackData: "spsc_cert_done" },
      ],
    };
  } catch (error) {
    console.error("ID upload error:", error);
    return {
      text: "Failed to upload ID proof. Please try again.",
      parseMode: "HTML",
    };
  }
}

async function handleCertUpload(
  collection: FormCollection,
  message: BotMessage,
  callbackData?: string
): Promise<BotResponse> {
  if (callbackData === "spsc_cert_done") {
    const certs = (collection.collected_data.certificates || []) as string[];
    await updateCollection(collection.id, "review", { certificates: certs });
    return buildReviewResponse(collection);
  }

  if (!message.photoUrl && !message.documentUrl) {
    const certCount = ((collection.collected_data.certificates || []) as string[]).length;
    return {
      text: `${certCount} certificate(s) uploaded so far.\n\nSend another certificate, or tap <b>Done</b>.`,
      parseMode: "HTML",
      buttons: [
        { text: "Done", callbackData: "spsc_cert_done" },
      ],
    };
  }

  const fileId = message.photoUrl || message.documentUrl!;

  try {
    const buffer = await downloadFile(fileId);
    const isPhoto = !!message.photoUrl;
    const fileName = message.documentFileName || `cert_${Date.now()}.${isPhoto ? "jpg" : "pdf"}`;
    const path = `${collection.user_id || collection.platform_user_id}/${collection.id}/${fileName}`;

    await supabase.storage.from("spsc-documents").upload(path, buffer, {
      contentType: isPhoto ? "image/jpeg" : (message.documentMimeType || "application/pdf"),
    });

    const certificates = [...((collection.collected_data.certificates || []) as string[]), path];

    await updateCollection(collection.id, "cert_upload", { certificates });

    return {
      text: `Certificate uploaded (${certificates.length} total).\n\nSend more, or tap <b>Done</b>.`,
      parseMode: "HTML",
      buttons: [
        { text: "Send more", callbackData: "spsc_cert_more" },
        { text: "Done", callbackData: "spsc_cert_done" },
      ],
    };
  } catch (error) {
    console.error("Certificate upload error:", error);
    return {
      text: "Failed to upload certificate. Please try again.",
      parseMode: "HTML",
    };
  }
}

// ─── Review & Confirm ─────────────────────────────────────────────────────────

async function handleReview(
  collection: FormCollection,
  message: BotMessage,
  callbackData?: string
): Promise<BotResponse> {
  if (callbackData === "spsc_review_submit") {
    await updateCollection(collection.id, "confirm", {});
    return {
      text: "Are you sure you want to <b>submit this application</b>?\n\nThis action cannot be undone.",
      parseMode: "HTML",
      buttons: [
        { text: "Yes, submit", callbackData: "spsc_confirm_yes" },
        { text: "No, go back", callbackData: "spsc_confirm_no" },
      ],
    };
  }

  if (callbackData === "spsc_review_edit") {
    // Restart from full_name to let them re-enter details
    await updateCollection(collection.id, "full_name", {});
    return {
      text: "Let's re-enter your details.\n\nWhat is your <b>full name</b> (as per official documents)?",
      parseMode: "HTML",
    };
  }

  if (callbackData === "spsc_review_cancel") {
    await deleteCollection(collection.id);
    return {
      text: "Application cancelled. You can start again anytime with /fillspscform",
      parseMode: "HTML",
    };
  }

  // Default: show the review
  return buildReviewResponse(collection);
}

async function handleConfirm(
  collection: FormCollection,
  message: BotMessage,
  callbackData?: string
): Promise<BotResponse> {
  if (callbackData === "spsc_confirm_yes") {
    return await finalizeApplication(collection);
  }

  if (callbackData === "spsc_confirm_no") {
    await updateCollection(collection.id, "review", {});
    return buildReviewResponse(collection);
  }

  // Prompt again
  return {
    text: "Please confirm your submission:",
    parseMode: "HTML",
    buttons: [
      { text: "Yes, submit", callbackData: "spsc_confirm_yes" },
      { text: "No, go back", callbackData: "spsc_confirm_no" },
    ],
  };
}

// ─── Review formatter ─────────────────────────────────────────────────────────

async function buildReviewResponse(collection: FormCollection): Promise<BotResponse> {
  // Refresh to get latest collected_data
  const { data: fresh } = await supabase
    .from("spsc_form_collection")
    .select("*")
    .eq("id", collection.id)
    .single();

  const d = (fresh?.collected_data || collection.collected_data) as Record<string, unknown>;

  const education = (d.education || []) as Record<string, string>[];
  const experience = (d.experience || []) as Record<string, string>[];
  const certificates = (d.certificates || []) as string[];

  let educationLines = "";
  education.forEach((e, i) => {
    educationLines += `${i + 1}. ${formatDegree(e.degree)} - ${e.institution} (${e.year}, ${e.percentage}%)\n`;
  });

  let experienceLines = "";
  if (experience.length > 0) {
    experience.forEach((e, i) => {
      experienceLines += `${i + 1}. ${e.designation} at ${e.organization} (${e.from_date} - ${e.to_date})\n`;
    });
  } else {
    experienceLines = "None\n";
  }

  const text = `<b>Application Summary</b>

<b>Post:</b> ${d.recruitment_title || "N/A"}

<b>Personal Details:</b>
Name: ${d.full_name || "N/A"}
Father: ${d.father_name || "N/A"}
Mother: ${d.mother_name || "N/A"}
DOB: ${d.dob || "N/A"}
Gender: ${d.gender || "N/A"}
Category: ${d.category || "N/A"}
Marital Status: ${d.marital_status || "N/A"}

<b>Contact:</b>
Permanent Address: ${d.address_permanent || "N/A"}
Correspondence: ${d.address_correspondence || "N/A"}
Phone: ${d.phone || "N/A"}
Email: ${d.email || "N/A"}

<b>Education:</b>
${educationLines || "None\n"}
<b>Experience:</b>
${experienceLines}
<b>Documents:</b>
${d.photo_path ? "Passport Photo" : "Passport Photo (missing)"}
${d.signature_path ? "Signature" : "Signature (missing)"}
${d.id_proof_path ? "ID Proof" : "ID Proof (missing)"}
${certificates.length} Certificate(s)

Is everything correct?`;

  return {
    text,
    parseMode: "HTML",
    buttons: [
      { text: "Submit to Portal", callbackData: "spsc_review_submit" },
      { text: "Edit Details", callbackData: "spsc_review_edit" },
      { text: "Cancel", callbackData: "spsc_review_cancel" },
    ],
  };
}

// ─── Finalize ─────────────────────────────────────────────────────────────────

async function finalizeApplication(collection: FormCollection): Promise<BotResponse> {
  // Refresh to get latest data
  const { data: fresh } = await supabase
    .from("spsc_form_collection")
    .select("*")
    .eq("id", collection.id)
    .single();

  if (!fresh) {
    return { text: "Something went wrong. Please try again with /fillspscform" };
  }

  const d = fresh.collected_data as Record<string, unknown>;

  try {
    // Create the application record
    const { data: application, error } = await supabase
      .from("spsc_form_applications")
      .insert({
        user_id: fresh.user_id,
        platform: fresh.platform,
        platform_user_id: fresh.platform_user_id,
        recruitment_id: fresh.target_recruitment_id,
        status: "data_complete",
        full_name: d.full_name,
        father_name: d.father_name,
        mother_name: d.mother_name,
        dob: d.dob,
        gender: d.gender,
        category: d.category,
        marital_status: d.marital_status,
        address_permanent: d.address_permanent,
        address_correspondence: d.address_correspondence,
        phone: d.phone,
        email: d.email,
        portal_email: d.portal_email,
        portal_password_encrypted: d.portal_password_encrypted,
        has_portal_account: d.has_portal_account,
        education: d.education,
        experience: d.experience || [],
        photo_path: d.photo_path,
        signature_path: d.signature_path,
        id_proof_path: d.id_proof_path,
        certificates: d.certificates || [],
        collected_data: d,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating application:", error);
      return {
        text: "Failed to save your application. Please try again.",
        parseMode: "HTML",
      };
    }

    // Delete the collection record
    await deleteCollection(fresh.id);

    return {
      text: `<b>Application Submitted!</b>

Your data has been saved successfully.

<b>Application ID:</b> <code>${application.id}</code>

Next steps:
1. Our system will log into the SPSC portal using your credentials
2. It will fill and submit the form on your behalf
3. You'll receive a confirmation message with screenshots

You'll be notified once the portal submission is complete.`,
      parseMode: "HTML",
    };
  } catch (error) {
    console.error("Finalize application error:", error);
    return {
      text: "Something went wrong while saving. Please try again.",
      parseMode: "HTML",
    };
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDegree(degree: string): string {
  const map: Record<string, string> = {
    "10th": "10th",
    "12th": "12th",
    graduate: "Graduate",
    post_graduate: "Post Graduate",
    diploma: "Diploma",
    other: "Other",
  };
  return map[degree] || degree;
}
