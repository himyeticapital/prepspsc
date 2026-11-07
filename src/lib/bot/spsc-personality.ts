/**
 * SPSC Form Personality Templates
 * Message templates for the recruitment form automation flow
 */

import type { BotResponse } from "./types";

/**
 * Welcome message when user starts /fillspscform
 */
export function spscFormWelcome(): BotResponse {
  return {
    text: `📋 <b>SPSC Recruitment Form Assistant</b>\n\nI'll help you fill your SPSC recruitment form without touching the website. Here's how it works:\n\n1️⃣ I'll collect your details through chat\n2️⃣ You send your documents (photos, certificates)\n3️⃣ I auto-fill the portal for you\n4️⃣ You just solve one CAPTCHA\n\nIf the portal is down on deadline day, I'll keep retrying automatically!\n\nLet's start — choose a recruitment to apply for:`,
    parseMode: "HTML",
  };
}

/**
 * No active recruitments found
 */
export function noRecruitments(): BotResponse {
  return {
    text: `📭 <b>No active recruitments found</b>\n\nThere are no SPSC recruitments open for applications right now.\n\nI'll notify you when new recruitments are posted! Make sure your alerts are on.`,
    parseMode: "HTML",
    buttons: [
      { text: "🔔 Enable Alerts", callbackData: "spsc_enable_alerts" },
    ],
  };
}

/**
 * Portal credentials prompt
 */
export function askPortalCreds(): BotResponse {
  return {
    text: `🔐 <b>Portal Account</b>\n\nDo you have an account on the SPSC recruitment portal?\n\n<i>(spscrecruitment.sikkim.gov.in)</i>`,
    parseMode: "HTML",
    buttons: [
      { text: "✅ Yes, I have one", callbackData: "spsc_portal_yes" },
      { text: "🆕 No, register me", callbackData: "spsc_portal_no" },
    ],
  };
}

/**
 * Ask for portal email
 */
export function askPortalEmail(): BotResponse {
  return {
    text: `📧 Please enter your SPSC portal <b>email address</b>:`,
    parseMode: "HTML",
  };
}

/**
 * Ask for portal password
 */
export function askPortalPassword(): BotResponse {
  return {
    text: `🔒 Please enter your SPSC portal <b>password</b>:\n\n<i>⚠️ Your message will be immediately deleted for security.</i>`,
    parseMode: "HTML",
  };
}

/**
 * Password received and deleted
 */
export function passwordReceived(): BotResponse {
  return {
    text: `✅ Password saved securely (message deleted).\n\nNow let's collect your personal details.`,
    parseMode: "HTML",
  };
}

/**
 * Generic field prompt
 */
export function askField(fieldName: string, hint?: string): BotResponse {
  const hintText = hint ? `\n\n<i>${hint}</i>` : "";
  return {
    text: `📝 Please enter your <b>${fieldName}</b>:${hintText}`,
    parseMode: "HTML",
  };
}

/**
 * Document upload instructions
 */
export function askDocument(docType: string, requirements: string): BotResponse {
  return {
    text: `📎 Please send your <b>${docType}</b>\n\n<i>${requirements}</i>\n\nJust send the photo or PDF directly in this chat.`,
    parseMode: "HTML",
  };
}

/**
 * Document received confirmation
 */
export function documentReceived(docType: string): BotResponse {
  return {
    text: `✅ ${docType} received and saved.`,
    parseMode: "HTML",
  };
}

/**
 * Education qualification saved
 */
export function qualificationSaved(index: number, total: number): BotResponse {
  return {
    text: `✅ Qualification ${index}/${total} saved.${index < total ? `\n\nNow let's add qualification ${index + 1}:` : ""}`,
    parseMode: "HTML",
  };
}

/**
 * CAPTCHA prompt
 */
export function captchaPrompt(isRetry: boolean = false): BotResponse {
  const retryText = isRetry ? "The previous code was incorrect. " : "";
  return {
    text: `🔢 ${retryText}Please type the <b>CAPTCHA code</b> shown in the image above:`,
    parseMode: "HTML",
  };
}

/**
 * Automation progress update
 */
export function automationProgress(step: string, completed: boolean = false): BotResponse {
  const icon = completed ? "✅" : "⏳";
  return {
    text: `${icon} ${step}`,
    parseMode: "HTML",
  };
}

/**
 * Form submitted successfully
 */
export function formSubmitted(confirmationNumber?: string, postName?: string): BotResponse {
  const confirmText = confirmationNumber
    ? `\nConfirmation: <b>${confirmationNumber}</b>`
    : "";
  const postText = postName ? `\nPost: ${postName}` : "";
  return {
    text: `🎉 <b>Form Submitted Successfully!</b>${postText}${confirmText}\n\nYour application has been submitted to the SPSC portal. You can check your status at spscrecruitment.sikkim.gov.in`,
    parseMode: "HTML",
    buttons: [
      { text: "🔗 Check on Portal", url: "https://spscrecruitment.sikkim.gov.in/rpaonline/login" },
    ],
  };
}

/**
 * Portal is down, entering retry queue
 */
export function portalDown(retryCount: number): BotResponse {
  return {
    text: `⚠️ <b>Portal is slow/down</b> (common on deadline days)\n\nYour application is in the retry queue. I'll keep trying automatically.\n\nAttempt: ${retryCount}/10\nStatus: Retrying...\n\nYou'll be notified the moment your form is submitted!`,
    parseMode: "HTML",
    buttons: [
      { text: "❌ Cancel Retry", callbackData: "spsc_cancel_retry" },
    ],
  };
}

/**
 * Retry succeeded
 */
export function retrySucceeded(attempt: number, confirmationNumber?: string): BotResponse {
  const confirmText = confirmationNumber
    ? `\nConfirmation: <b>${confirmationNumber}</b>`
    : "";
  return {
    text: `✅ <b>Got through on attempt ${attempt}!</b>${confirmText}\n\nYour form has been submitted successfully despite the portal issues.`,
    parseMode: "HTML",
  };
}

/**
 * Form fill error
 */
export function formError(error: string, canRetry: boolean): BotResponse {
  return {
    text: `❌ <b>Error</b>\n\n${error}`,
    parseMode: "HTML",
    buttons: canRetry
      ? [
          { text: "🔄 Try Again", callbackData: "spsc_retry" },
          { text: "❌ Cancel", callbackData: "spsc_cancel" },
        ]
      : [
          { text: "🔗 Fill Manually", url: "https://spscrecruitment.sikkim.gov.in/rpaonline/login" },
        ],
  };
}

/**
 * New recruitment alert
 */
export function recruitmentAlert(title: string, postName?: string, department?: string, deadline?: string): BotResponse {
  return {
    text: `📢 <b>New SPSC Recruitment!</b>\n\n${title}${postName ? `\nPost: ${postName}` : ""}${department ? `\nDepartment: ${department}` : ""}${deadline ? `\nDeadline: <b>${deadline}</b>` : ""}\n\nUse /fillspscform to apply through the bot!`,
    parseMode: "HTML",
    buttons: [
      { text: "📋 Apply Now", callbackData: "spsc_start" },
    ],
  };
}

/**
 * Validation error for a field
 */
export function validationError(fieldName: string, requirement: string): BotResponse {
  return {
    text: `⚠️ Invalid ${fieldName}. ${requirement}\n\nPlease try again:`,
    parseMode: "HTML",
  };
}

/**
 * Application cancelled
 */
export function applicationCancelled(): BotResponse {
  return {
    text: `❌ Application cancelled. Your data has been cleared.\n\nYou can start again anytime with /fillspscform`,
    parseMode: "HTML",
  };
}

/**
 * Session expired
 */
export function sessionExpired(): BotResponse {
  return {
    text: `⏰ Your form session has expired (24 hours).\n\nPlease start again with /fillspscform — your previously uploaded documents are still saved.`,
    parseMode: "HTML",
  };
}
