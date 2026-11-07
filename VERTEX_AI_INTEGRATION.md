# Vertex AI Integration Plan

## Overview

Migrate from Google AI Studio (`@google/generative-ai`) to Vertex AI (`@google-cloud/vertexai`) to access better models and improve output quality.

## Model Strategy

| Task Type | Current Model | New Model | Reason |
|-----------|---------------|-----------|--------|
| **Quality-Critical** | gemini-2.0-flash | **gemini-1.5-pro** | Better reasoning, accuracy |
| **Fast Tasks** | gemini-2.0-flash | **gemini-2.0-flash** | Speed, low latency |

### Quality-Critical Tasks (gemini-1.5-pro)
- Study AI Generation (mindmap, summary, flashcards, quiz, infographic)
- Conventional answer grading
- Complex analysis

### Fast Tasks (gemini-2.0-flash)
- OCR / text extraction from images
- PDF text extraction
- Blurt session analysis
- MCQ explanations
- Simple content parsing

---

## Prerequisites

### 1. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (or create one)
3. Enable the Vertex AI API:
   ```
   gcloud services enable aiplatform.googleapis.com
   ```

### 2. Create Service Account

1. Go to IAM & Admin → Service Accounts
2. Click "Create Service Account"
3. Name: `prepspsc-vertex-ai`
4. Grant role: `Vertex AI User`
5. Click "Create Key" → JSON
6. Download the JSON key file

### 3. Store Credentials Securely

Option A: Environment variable (recommended for Vercel)
```bash
# Base64 encode the JSON file
base64 -i service-account.json

# Add to .env.local
GOOGLE_APPLICATION_CREDENTIALS_JSON="<base64-encoded-json>"
```

Option B: File path (local development)
```bash
GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
```

---

## Environment Variables

Add to `.env.local`:

```bash
# Vertex AI Configuration
GOOGLE_CLOUD_PROJECT="your-project-id"
GOOGLE_CLOUD_LOCATION="us-central1"

# Option A: Base64 encoded service account JSON (for Vercel)
GOOGLE_APPLICATION_CREDENTIALS_JSON="eyJ0eXBlIjoi..."

# Option B: File path (local dev)
# GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

# Keep existing key as fallback (optional)
GOOGLE_GEMINI_API_KEY="your-existing-api-key"
```

---

## Implementation Steps

### Step 1: Install Vertex AI SDK

```bash
cd prepspsc
npm install @google-cloud/vertexai
```

### Step 2: Create Vertex AI Client Library

Create `src/lib/vertex-ai.ts`:

```typescript
import { VertexAI, GenerativeModel } from "@google-cloud/vertexai";

// Initialize Vertex AI client
function getVertexAI(): VertexAI {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

  if (!project) {
    throw new Error("GOOGLE_CLOUD_PROJECT not configured");
  }

  // Handle base64 encoded credentials (for Vercel deployment)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const credentials = JSON.parse(
      Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, "base64").toString()
    );
    return new VertexAI({
      project,
      location,
      googleAuthOptions: { credentials },
    });
  }

  // Fall back to GOOGLE_APPLICATION_CREDENTIALS file path
  return new VertexAI({ project, location });
}

// Quality model for complex tasks
export function getQualityModel(): GenerativeModel {
  const vertexAI = getVertexAI();
  return vertexAI.getGenerativeModel({
    model: "gemini-1.5-pro",
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
      topP: 0.8,
      topK: 40,
    },
  });
}

// Fast model for simple tasks
export function getFastModel(): GenerativeModel {
  const vertexAI = getVertexAI();
  return vertexAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
    },
  });
}

// Check if Vertex AI is configured
export function isVertexAIConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLOUD_PROJECT &&
    (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
     process.env.GOOGLE_APPLICATION_CREDENTIALS)
  );
}
```

### Step 3: Update API Routes

#### 3.1 Study AI Generate Route (`/api/study-ai/generate/route.ts`)

```typescript
// Replace:
import { GoogleGenerativeAI } from "@google/generative-ai";

// With:
import { getQualityModel, isVertexAIConfigured } from "@/lib/vertex-ai";

// Update getGeminiModel function:
function getGeminiModel() {
  if (isVertexAIConfigured()) {
    return getQualityModel(); // gemini-1.5-pro
  }

  // Fallback to Google AI Studio
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("AI_NOT_CONFIGURED");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
}
```

#### 3.2 OCR Route (`/api/study-ai/ocr/route.ts`)

```typescript
import { getFastModel, isVertexAIConfigured } from "@/lib/vertex-ai";

function getGeminiModel() {
  if (isVertexAIConfigured()) {
    return getFastModel(); // gemini-2.0-flash
  }
  // Fallback...
}
```

#### 3.3 Parse Content Route (`/api/study-ai/parse-content/route.ts`)

```typescript
import { getFastModel, isVertexAIConfigured } from "@/lib/vertex-ai";

function getGeminiModel() {
  if (isVertexAIConfigured()) {
    return getFastModel(); // gemini-2.0-flash for PDF/image extraction
  }
  // Fallback...
}
```

#### 3.4 Blurt Analyze Route (`/api/study-ai/blurt-analyze/route.ts`)

```typescript
import { getFastModel, isVertexAIConfigured } from "@/lib/vertex-ai";

function getGeminiModel() {
  if (isVertexAIConfigured()) {
    return getFastModel(); // gemini-2.0-flash
  }
  // Fallback...
}
```

#### 3.5 Test Evaluation Route (`/api/evaluate-test/route.ts`)

```typescript
import { getQualityModel, getFastModel, isVertexAIConfigured } from "@/lib/vertex-ai";

// For conventional answers (quality matters):
function getGradingModel() {
  if (isVertexAIConfigured()) {
    return getQualityModel(); // gemini-1.5-pro
  }
  // Fallback...
}

// For MCQ explanations (speed matters):
function getMCQModel() {
  if (isVertexAIConfigured()) {
    return getFastModel(); // gemini-2.0-flash
  }
  // Fallback...
}
```

---

## API Differences

### Content Generation

Google AI Studio:
```typescript
const result = await model.generateContent(prompt);
const text = result.response.text();
```

Vertex AI:
```typescript
const result = await model.generateContent(prompt);
const response = await result.response;
const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
```

### Multimodal (Images/PDFs)

Google AI Studio:
```typescript
const result = await model.generateContent([
  prompt,
  { inlineData: { mimeType: "image/png", data: base64 } }
]);
```

Vertex AI:
```typescript
const result = await model.generateContent({
  contents: [{
    role: "user",
    parts: [
      { text: prompt },
      { inlineData: { mimeType: "image/png", data: base64 } }
    ]
  }]
});
```

---

## Pricing Comparison

### Current (Google AI Studio - Free Tier)
- gemini-2.0-flash: $0.10/1M input, $0.40/1M output
- Free tier: 15 RPM, 1M TPM

### Vertex AI Pricing
| Model | Input | Output |
|-------|-------|--------|
| gemini-1.5-pro | $1.25/1M tokens | $5.00/1M tokens |
| gemini-2.0-flash | $0.10/1M tokens | $0.40/1M tokens |

### Estimated Monthly Cost (1000 users, moderate usage)

| Feature | Requests/mo | Model | Est. Cost |
|---------|-------------|-------|-----------|
| Study AI Generation | 5,000 | 1.5-pro | ~$35 |
| Conventional Grading | 2,000 | 1.5-pro | ~$15 |
| OCR/Parsing | 8,000 | 2.0-flash | ~$3 |
| Blurt Analysis | 3,000 | 2.0-flash | ~$1 |
| MCQ Explanations | 10,000 | 2.0-flash | ~$2 |
| **Total** | | | **~$56/mo** |

---

## Rollout Strategy

### Phase 1: Setup & Testing
1. Create service account and configure credentials
2. Install SDK and create `vertex-ai.ts` library
3. Test locally with one route (e.g., Study AI generate)

### Phase 2: Gradual Migration
1. Update Study AI generate route (quality-critical)
2. Update conventional grading route (quality-critical)
3. Test thoroughly

### Phase 3: Fast Tasks
1. Update OCR, parse-content, blurt routes
2. Keep using 2.0-flash for these

### Phase 4: Production
1. Add environment variables to Vercel
2. Deploy and monitor
3. Keep Google AI Studio key as fallback

---

## Monitoring & Fallback

```typescript
// In vertex-ai.ts, add error handling with fallback
export async function generateWithFallback(
  prompt: string,
  useQualityModel: boolean = true
): Promise<string> {
  try {
    const model = useQualityModel ? getQualityModel() : getFastModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    console.error("Vertex AI error, falling back to Google AI Studio:", error);

    // Fallback to Google AI Studio
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) throw error;

    const genAI = new GoogleGenerativeAI(apiKey);
    const fallbackModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await fallbackModel.generateContent(prompt);
    return result.response.text();
  }
}
```

---

## Files to Modify

| File | Change | Model |
|------|--------|-------|
| `src/lib/vertex-ai.ts` | **New file** | - |
| `src/app/api/study-ai/generate/route.ts` | Use quality model | gemini-1.5-pro |
| `src/app/api/study-ai/parse-content/route.ts` | Use fast model | gemini-2.0-flash |
| `src/app/api/study-ai/ocr/route.ts` | Use fast model | gemini-2.0-flash |
| `src/app/api/study-ai/blurt-analyze/route.ts` | Use fast model | gemini-2.0-flash |
| `src/app/api/evaluate-test/route.ts` | Quality for grading, fast for MCQ | Both |
| `src/app/admin/analytics/page.tsx` | Update cost estimates | - |

---

## Checklist

- [ ] Create Google Cloud project (if needed)
- [ ] Enable Vertex AI API
- [ ] Create service account with Vertex AI User role
- [ ] Download JSON key
- [ ] Add environment variables to `.env.local`
- [ ] Install `@google-cloud/vertexai` package
- [ ] Create `src/lib/vertex-ai.ts`
- [ ] Update Study AI generate route
- [ ] Update evaluate-test route
- [ ] Update OCR route
- [ ] Update parse-content route
- [ ] Update blurt-analyze route
- [ ] Test all features locally
- [ ] Add env vars to Vercel
- [ ] Deploy and monitor
- [ ] Update admin analytics cost estimates
