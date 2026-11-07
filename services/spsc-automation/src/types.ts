/**
 * Types for SPSC Automation Service
 */

export interface SessionInfo {
  id: string;
  userId: string;
  status: "active" | "awaiting_captcha" | "filling" | "submitted" | "error" | "closed";
  currentStep: string;
  createdAt: Date;
  lastActivityAt: Date;
}

export interface StartSessionRequest {
  userId: string;
  applicationId: string;
}

export interface StartSessionResponse {
  sessionId: string;
  captchaBase64: string;
  status: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  captchaCode: string;
}

export interface LoginResponse {
  success: boolean;
  error?: string;
  newCaptchaBase64?: string; // If CAPTCHA was wrong, new one is returned
  currentPage?: string;
}

export interface FillFormRequest {
  personalDetails: {
    fullName: string;
    fatherName: string;
    motherName: string;
    dateOfBirth: string; // DD/MM/YYYY
    gender: string;
    maritalStatus: string;
    category: string;
    subCategory?: string;
    nationality: string;
    religion?: string;
    isPwd: boolean;
    pwdType?: string;
  };
  contactDetails: {
    permanentAddress: {
      line1: string;
      line2?: string;
      city: string;
      district: string;
      state: string;
      pin: string;
    };
    correspondenceAddress?: {
      line1: string;
      line2?: string;
      city: string;
      district: string;
      state: string;
      pin: string;
    };
    phone: string;
    altPhone?: string;
    email: string;
  };
  qualifications: Array<{
    degree: string;
    institution: string;
    boardUniversity: string;
    year: number;
    percentage: number;
    subjects?: string;
  }>;
  workExperience?: Array<{
    organization: string;
    designation: string;
    fromDate: string;
    toDate: string;
    duties?: string;
  }>;
}

export interface FillFormResponse {
  success: boolean;
  screenshotBase64: string;
  error?: string;
  currentStep?: string;
}

export interface UploadDocumentRequest {
  fieldName: string; // e.g., "passport_photo", "signature", "id_proof", "certificate"
  documentBase64: string;
  fileName: string;
  mimeType: string;
}

export interface UploadDocumentResponse {
  success: boolean;
  error?: string;
}

export interface SubmitResponse {
  success: boolean;
  confirmationNumber?: string;
  screenshotBase64: string;
  error?: string;
}
