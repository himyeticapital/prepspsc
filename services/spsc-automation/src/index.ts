/**
 * SPSC Automation Service
 * Express server with Puppeteer browser automation for SPSC portal
 */

import express from "express";
import { sessionManager } from "./session-manager";
import * as navigator from "./portal-navigator";
import { extractCaptcha, reloadCaptcha } from "./captcha-handler";
import type {
  StartSessionRequest,
  LoginRequest,
  FillFormRequest,
  UploadDocumentRequest,
} from "./types";

const app = express();
app.use(express.json({ limit: "50mb" })); // Large limit for document uploads

const PORT = parseInt(process.env.PORT || "3001");
const API_KEY = process.env.AUTOMATION_API_KEY;

// --- Auth Middleware ---
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (!API_KEY) {
    console.warn("AUTOMATION_API_KEY not set — running without auth");
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${API_KEY}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

app.use("/session", authMiddleware);

// --- Health Check ---
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    activeSessions: sessionManager.getActiveCount(),
    timestamp: new Date().toISOString(),
  });
});

// --- Session Management ---

// Start a new browser session
app.post("/session/start", async (req, res) => {
  try {
    const { userId, applicationId } = req.body as StartSessionRequest;

    if (!userId || !applicationId) {
      res.status(400).json({ error: "userId and applicationId are required" });
      return;
    }

    const { sessionId, page } = await sessionManager.createSession(userId, applicationId);

    // Navigate to login page and get CAPTCHA
    const captchaBase64 = await navigator.navigateToLogin(page);
    sessionManager.updateStatus(sessionId, "awaiting_captcha", "login");

    res.json({
      sessionId,
      captchaBase64,
      status: "awaiting_captcha",
    });
  } catch (error) {
    console.error("Start session error:", error);
    res.status(500).json({ error: `Failed to start session: ${error}` });
  }
});

// Login with credentials + CAPTCHA
app.post("/session/:id/login", async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, captchaCode } = req.body as LoginRequest;

    const page = sessionManager.getPage(id);
    if (!page) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }

    const result = await navigator.login(page, email, password, captchaCode);

    if (result.success) {
      sessionManager.updateStatus(id, "active", "logged_in");
      res.json({ success: true, currentPage: page.url() });
    } else {
      // Get new CAPTCHA if login failed
      let newCaptchaBase64: string | undefined;
      try {
        newCaptchaBase64 = await extractCaptcha(page);
      } catch {
        // CAPTCHA extraction might fail if page structure changed
      }
      res.json({
        success: false,
        error: result.error,
        newCaptchaBase64,
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: `Login failed: ${error}` });
  }
});

// Register new account + CAPTCHA
app.post("/session/:id/register", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, mobile, password, captchaCode } = req.body;

    const page = sessionManager.getPage(id);
    if (!page) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }

    // Navigate to register page first
    await navigator.navigateToRegister(page);

    const result = await navigator.registerAccount(page, name, email, mobile, password, captchaCode);

    if (result.success) {
      sessionManager.updateStatus(id, "active", "registered");
    }

    res.json(result);
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: `Registration failed: ${error}` });
  }
});

// Fill form with collected data
app.post("/session/:id/fill-form", async (req, res) => {
  try {
    const { id } = req.params;
    const formData = req.body as FillFormRequest;

    const page = sessionManager.getPage(id);
    if (!page) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }

    sessionManager.updateStatus(id, "filling", "form_fill");
    const result = await navigator.fillApplicationForm(page, formData);

    if (result.success) {
      sessionManager.updateStatus(id, "active", "form_filled");
    } else {
      sessionManager.updateStatus(id, "error", "form_fill_error");
    }

    res.json(result);
  } catch (error) {
    console.error("Fill form error:", error);
    res.status(500).json({ error: `Form fill failed: ${error}` });
  }
});

// Upload document
app.post("/session/:id/upload-doc", async (req, res) => {
  try {
    const { id } = req.params;
    const docData = req.body as UploadDocumentRequest;

    const page = sessionManager.getPage(id);
    if (!page) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }

    const result = await navigator.uploadDocument(page, docData);
    res.json(result);
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: `Upload failed: ${error}` });
  }
});

// Get screenshot
app.get("/session/:id/screenshot", async (req, res) => {
  try {
    const { id } = req.params;

    const page = sessionManager.getPage(id);
    if (!page) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }

    const screenshotBase64 = await navigator.takeScreenshot(page);
    res.json({ screenshotBase64 });
  } catch (error) {
    console.error("Screenshot error:", error);
    res.status(500).json({ error: `Screenshot failed: ${error}` });
  }
});

// Get current CAPTCHA
app.get("/session/:id/captcha", async (req, res) => {
  try {
    const { id } = req.params;

    const page = sessionManager.getPage(id);
    if (!page) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }

    const captchaBase64 = await extractCaptcha(page);
    res.json({ captchaBase64 });
  } catch (error) {
    console.error("CAPTCHA error:", error);
    res.status(500).json({ error: `CAPTCHA extraction failed: ${error}` });
  }
});

// Submit form
app.post("/session/:id/submit", async (req, res) => {
  try {
    const { id } = req.params;
    const { captchaCode } = req.body;

    const page = sessionManager.getPage(id);
    if (!page) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }

    sessionManager.updateStatus(id, "filling", "submitting");
    const result = await navigator.submitForm(page, captchaCode);

    if (result.success) {
      sessionManager.updateStatus(id, "submitted", "complete");
    } else {
      sessionManager.updateStatus(id, "error", "submit_error");
    }

    res.json(result);
  } catch (error) {
    console.error("Submit error:", error);
    res.status(500).json({ error: `Submit failed: ${error}` });
  }
});

// Get session status
app.get("/session/:id/status", (req, res) => {
  const { id } = req.params;
  const info = sessionManager.getSessionInfo(id);
  if (!info) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(info);
});

// Close session
app.delete("/session/:id", async (req, res) => {
  const { id } = req.params;
  await sessionManager.closeSession(id);
  res.json({ success: true });
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`SPSC Automation Service running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down...");
  await sessionManager.shutdown();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  await sessionManager.shutdown();
  process.exit(0);
});
