# Study with AI Module - Complete Documentation

## Overview

**Study with AI** is a standalone module that helps users create AI-powered study materials and revise them using spaced repetition.

**Important**: "Study Goals" is a feature that **ONLY exists within this module** - it is completely separate from "Add Task" and "Session Naming" features elsewhere in the app.

---

## User Flow Summary

### Flow 1: Creating a New Study Goal

```
Step 1: Navigate to Study with AI
         ↓
Step 2: Type study goal (e.g., "Learn Sikkim History Chapter 1")
         ↓
Step 3: Upload content
         - PDFs
         - Images
         - YouTube URLs
         - Anki decks (Pro only)
         ↓
Step 4: Generate study materials
         - Mind Map
         - Summary
         - Flashcards
         - Quiz (MCQs)
         - Infographic
         ↓
Step 5: Save/bookmark any materials you want to keep
         ↓
Step 6: System schedules first revision (1 day later)
         ↓
Step 7: Goal appears in "My Goals" list
```

### Flow 2: Returning for Revision

```
Step 1: Receive notification: "Time to revise: Sikkim History Chapter 1!"
         ↓
Step 2: Click notification → Opens Study Goal Detail Page
         ↓
Step 3: See ALL materials created for that goal:
         - All uploaded content (PDFs, images, YouTube)
         - All generated materials (mindmaps, summaries, flashcards, quizzes, infographics)
         ↓
Step 4: Review materials / Practice flashcards / Take quiz
         ↓
Step 5: Optional: Start Blurting (active recall)
         - Digital: Type what you remember
         - Paper (Pro): Upload handwritten notes
         - See AI gap analysis with score
         ↓
Step 6: Mark as revised
         ↓
Step 7: System schedules next revision (based on Leitner: 1→3→7→14→30 days)
```

---

## Features

### 1. Study Goals
- Type a study goal as text input
- Goal persists permanently
- All uploads and generations linked to the goal
- Tracks revision schedule using Leitner SRS

### 2. Content Upload
| Type | Free | Pro |
|------|------|-----|
| PDF | Yes | Yes |
| Images | Yes | Yes |
| YouTube URLs | Yes | Yes |
| Anki Decks (.apkg) | No | Yes |

### 3. AI Generation (5 Types)
| Type | Description |
|------|-------------|
| Mind Map | Visual hierarchy (Markmap) |
| Summary | Bullet points + key dates |
| Flashcards | Term/definition cards |
| Quiz | 10 MCQs with explanations |
| Infographic | Charts & visualizations |

### 4. Save/Bookmark
- Save any generated material
- View all saved items
- Filter by type

### 5. Revision System

**Daily Vault (Spaced Repetition)**
- Leitner box system: 1 day → 3 days → 7 days → 14 days → 30 days
- Ratings: Easy (+1 box), Hard (same), Again (reset)

**Blurting Pad (Active Recall)**
| Mode | Free | Pro |
|------|------|-----|
| Digital (type) | Yes | Yes |
| Paper (OCR) | No | Yes |

### 6. Notifications
- In-app notifications when revision is due
- Message: "Time to revise: [Goal Text]!"
- Click → Opens goal with all materials

### 7. Dashboard Stats
- Total Study Goals
- Materials Generated
- Items Saved
- Revision Streak
- Due for Review

---

## Free vs Pro Features (Study with AI)

| Feature | Free | Pro |
|---------|------|-----|
| **Create Study Goals** | Unlimited | Unlimited |
| **Upload PDF** | Yes | Yes |
| **Upload Images** | Yes | Yes |
| **YouTube URLs** | Yes | Yes |
| **Upload Anki Decks** | No | Yes |
| **AI Generations** | 1/day | Unlimited |
| **Save/Bookmark** | Unlimited | Unlimited |
| **Daily Vault (SRS)** | Yes | Yes |
| **Notifications** | Yes | Yes |
| **Digital Blurting** | Yes | Yes |
| **Paper Blurt (OCR)** | No | Yes |
| **Dashboard Stats** | Yes | Yes |

### Summary
- **Free**: Full flow with 1 generation/day limit
- **Pro adds**: Unlimited generations + Anki Import + Paper Blurt

---

## XP Rewards

| Action | XP |
|--------|-----|
| Generate Mind Map | +10 |
| Generate Summary | +5 |
| Generate Flashcards | +8 |
| Generate Quiz | +10 |
| Generate Infographic | +8 |
| Review Daily Vault item | +2 |
| Complete all daily reviews | +50 |
| Complete blurt session | +15 |
| Blurt score 90%+ | +25 |