/**
 * SPSC Automation Client
 * HTTP client for the SPSC browser automation service
 */

const AUTOMATION_URL = process.env.SPSC_AUTOMATION_URL || "http://localhost:3001";
const AUTOMATION_API_KEY = process.env.AUTOMATION_API_KEY || "";

interface AutomationResponse<T> {
  data?: T;
  error?: string;
}

async function automationRequest<T>(
  path: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: unknown
): Promise<AutomationResponse<T>> {
  try {
    const response = await fetch(`${AUTOMATION_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AUTOMATION_API_KEY}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      return { error: errorData.error || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { data: data as T };
  } catch (error) {
    return { error: `Automation service unavailable: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Start a new browser session on the automation service
 */
export async function startSession(
  userId: string,
  applicationId: string
): Promise<{ sessionId: string; captchaBase64: string } | { error: string }> {
  const result = await automationRequest<{ sessionId: string; captchaBase64: string }>(
    "/session/start",
    "POST",
    { userId, applicationId }
  );
  return result.data || { error: result.error || "Failed to start session" };
}

/**
 * Submit CAPTCHA code and login to the portal
 */
export async function submitCaptchaAndLogin(
  sessionId: string,
  email: string,
  password: string,
  captchaCode: string
): Promise<{ success: boolean; error?: string; newCaptchaBase64?: string }> {
  const result = await automationRequest<{ success: boolean; error?: string; newCaptchaBase64?: string }>(
    `/session/${sessionId}/login`,
    "POST",
    { email, password, captchaCode }
  );
  return result.data || { success: false, error: result.error };
}

/**
 * Register a new account on the portal
 */
export async function registerOnPortal(
  sessionId: string,
  name: string,
  email: string,
  mobile: string,
  password: string,
  captchaCode: string
): Promise<{ success: boolean; error?: string }> {
  const result = await automationRequest<{ success: boolean; error?: string }>(
    `/session/${sessionId}/register`,
    "POST",
    { name, email, mobile, password, captchaCode }
  );
  return result.data || { success: false, error: result.error };
}

/**
 * Fill the recruitment form with collected data
 */
export async function fillForm(
  sessionId: string,
  formData: {
    personalDetails: Record<string, unknown>;
    contactDetails: Record<string, unknown>;
    qualifications: unknown[];
    workExperience?: unknown[];
  }
): Promise<{ success: boolean; screenshots: string[]; error?: string }> {
  const result = await automationRequest<{ success: boolean; screenshots: string[]; error?: string }>(
    `/session/${sessionId}/fill-form`,
    "POST",
    formData
  );
  return result.data || { success: false, screenshots: [], error: result.error };
}

/**
 * Upload a document to the portal
 */
export async function uploadDocument(
  sessionId: string,
  fieldName: string,
  documentBase64: string,
  fileName: string,
  mimeType: string
): Promise<{ success: boolean; error?: string }> {
  const result = await automationRequest<{ success: boolean; error?: string }>(
    `/session/${sessionId}/upload-doc`,
    "POST",
    { fieldName, documentBase64, fileName, mimeType }
  );
  return result.data || { success: false, error: result.error };
}

/**
 * Get screenshot of current page
 */
export async function getScreenshot(
  sessionId: string
): Promise<{ screenshotBase64: string } | { error: string }> {
  const result = await automationRequest<{ screenshotBase64: string }>(
    `/session/${sessionId}/screenshot`
  );
  return result.data || { error: result.error || "Failed to get screenshot" };
}

/**
 * Get CAPTCHA image from current page
 */
export async function getCaptcha(
  sessionId: string
): Promise<{ captchaBase64: string } | { error: string }> {
  const result = await automationRequest<{ captchaBase64: string }>(
    `/session/${sessionId}/captcha`
  );
  return result.data || { error: result.error || "Failed to get CAPTCHA" };
}

/**
 * Submit the completed form
 */
export async function submitForm(
  sessionId: string,
  captchaCode?: string
): Promise<{ success: boolean; confirmationNumber?: string; screenshotBase64: string; error?: string }> {
  const result = await automationRequest<{
    success: boolean;
    confirmationNumber?: string;
    screenshotBase64: string;
    error?: string;
  }>(
    `/session/${sessionId}/submit`,
    "POST",
    { captchaCode }
  );
  return result.data || { success: false, screenshotBase64: "", error: result.error };
}

/**
 * Get session status
 */
export async function getSessionStatus(
  sessionId: string
): Promise<{ id: string; status: string; currentStep: string } | { error: string }> {
  const result = await automationRequest<{ id: string; status: string; currentStep: string }>(
    `/session/${sessionId}/status`
  );
  return result.data || { error: result.error || "Session not found" };
}

/**
 * Close a browser session
 */
export async function closeSession(sessionId: string): Promise<void> {
  await automationRequest(`/session/${sessionId}`, "DELETE");
}

/**
 * Check if the automation service is healthy
 */
export async function checkHealth(): Promise<boolean> {
  const result = await automationRequest<{ status: string }>("/health");
  return result.data?.status === "ok";
}
