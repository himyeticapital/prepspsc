/**
 * Session Manager
 * Manages Puppeteer browser sessions with automatic cleanup
 */

import puppeteer, { Browser, Page } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { v4 as uuidv4 } from "uuid";
import type { SessionInfo } from "./types";

const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // Check every minute

interface BrowserSession {
  info: SessionInfo;
  browser: Browser;
  page: Page;
}

class SessionManager {
  private sessions: Map<string, BrowserSession> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  /**
   * Create a new browser session
   */
  async createSession(userId: string, applicationId: string): Promise<{ sessionId: string; page: Page }> {
    const sessionId = uuidv4();

    // @sparticuz/chromium for low-memory environments (~130MB vs ~500MB full Chromium)
    const browser = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH || await chromium.executablePath(),
      headless: true,
      args: [
        ...chromium.args,
        "--single-process",
        "--no-zygote",
        "--disable-extensions",
        "--disable-background-networking",
        "--js-flags=--max-old-space-size=128",
      ],
      defaultViewport: { width: 1280, height: 720 },
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(30000);

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    const session: BrowserSession = {
      info: {
        id: sessionId,
        userId,
        status: "active",
        currentStep: "initialized",
        createdAt: new Date(),
        lastActivityAt: new Date(),
      },
      browser,
      page,
    };

    this.sessions.set(sessionId, session);
    console.log(`Session created: ${sessionId} for user ${userId}`);

    return { sessionId, page };
  }

  /**
   * Get an active session
   */
  getSession(sessionId: string): BrowserSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Update last activity
    session.info.lastActivityAt = new Date();
    return session;
  }

  /**
   * Get session page for navigation
   */
  getPage(sessionId: string): Page | null {
    const session = this.getSession(sessionId);
    return session?.page || null;
  }

  /**
   * Update session status
   */
  updateStatus(sessionId: string, status: SessionInfo["status"], step?: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.info.status = status;
      if (step) session.info.currentStep = step;
      session.info.lastActivityAt = new Date();
    }
  }

  /**
   * Get session info
   */
  getSessionInfo(sessionId: string): SessionInfo | null {
    const session = this.sessions.get(sessionId);
    return session?.info || null;
  }

  /**
   * Close a specific session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.page.close();
        await session.browser.close();
      } catch (error) {
        console.error(`Error closing session ${sessionId}:`, error);
      }
      this.sessions.delete(sessionId);
      console.log(`Session closed: ${sessionId}`);
    }
  }

  /**
   * Start periodic cleanup of expired sessions
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(async () => {
      const now = Date.now();
      for (const [id, session] of this.sessions.entries()) {
        const age = now - session.info.lastActivityAt.getTime();
        if (age > SESSION_TTL_MS) {
          console.log(`Session ${id} expired (${Math.round(age / 1000)}s idle)`);
          await this.closeSession(id);
        }
      }
    }, CLEANUP_INTERVAL_MS);
  }

  /**
   * Get count of active sessions
   */
  getActiveCount(): number {
    return this.sessions.size;
  }

  /**
   * Shutdown all sessions
   */
  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    for (const id of this.sessions.keys()) {
      await this.closeSession(id);
    }
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
