# Feature Pipeline: Upcoming Exam & Study Material Recommendation

> Status: **Planned** | Priority: **High** | Target: Q1 2026

---

## Overview

A module to help students select exams they're preparing for, get AI-powered PYQ trend analysis, and receive personalized study material recommendations based on syllabus and exam patterns.

---

## Key Decisions

| Decision | Choice |
|----------|--------|
| Exam Scope | SPSC Only (initially) |
| PYQ Data Source | AI + Manual Combined |
| Monetization | Completely Free |
| Goal Integration | Extend existing Study AI Goals |

---

## User Flow

```
1. User visits /upcoming-exam
   ↓
2. Selects exam (SPSC CCE, SPSC JE, etc.) OR adds custom exam
   ↓
3. Sets target date for exam
   ↓
4. Views exam detail page with:
   - Syllabus breakdown (tree view)
   - PYQ trend analysis (charts)
   - Study material recommendations
   - Feature tips (how PrepSPSC helps)
   ↓
5. Creates study goals from syllabus topics
   ↓
6. Goals appear in Study AI section for tracking
```

---

## Core Features

### 1. Exam Selection
- Browse SPSC exams (CCE, JE, Forest Ranger, etc.)
- Add custom exam with name + target date
- Pin primary exam for dashboard widget
- Multiple exam selection supported

### 2. Syllabus Tracker
- Hierarchical syllabus view (tree structure)
- Mark topics: Not Started → In Progress → Completed
- Confidence rating (0-100%) per topic
- Notes per topic
- Progress visualization (ring/bar)

### 3. PYQ Trend Analysis
- Year-over-year topic frequency charts
- Topic trend direction (rising/stable/declining)
- AI-powered predictions for upcoming exam
- Recommended study priority based on patterns

### 4. Study Material Recommendations
- Curated books, videos, notes, websites
- Linked to specific syllabus topics
- AI-generated suggestions based on weak areas
- Priority ranking (most important first)

### 5. Goal Integration
- Create goals directly from syllabus topics
- Goals appear in Study AI section
- Progress syncs with syllabus tracker
- XP rewards for completing exam goals

### 6. Dashboard Widget
- Countdown to target exam date
- Quick stats (topics covered, confidence)
- One-click access to exam detail

---

## Database Schema

### Tables

```sql
-- Master exam list
upcoming_exams (
  id, name, slug, exam_body, exam_type,
  icon, color, typical_date, official_website,
  is_active, sort_order
)

-- User's selected exams
user_exam_selections (
  id, user_id, exam_id, custom_exam_name,
  target_date, is_primary
)

-- Exam syllabus (hierarchical)
exam_syllabus (
  id, exam_id, parent_id, title, description,
  weightage, estimated_hours, sort_order
)

-- User progress on topics
user_syllabus_progress (
  id, user_id, syllabus_id, status,
  confidence, notes, completed_at
)

-- PYQ trend data
pyq_trends (
  id, exam_id, year, topic_name,
  question_count, marks_allocated,
  trend_direction, ai_generated
)

-- Study materials
exam_study_materials (
  id, exam_id, syllabus_id, title,
  description, material_type, url,
  author, priority
)
```

### Study AI Goals Extension

```sql
-- Add to existing study_ai_goals table
ALTER TABLE study_ai_goals ADD COLUMN exam_selection_id INTEGER;
ALTER TABLE study_ai_goals ADD COLUMN syllabus_id INTEGER;
```

---

## File Structure

```
src/
├── app/(main)/upcoming-exam/
│   ├── page.tsx                    # Exam selection
│   ├── upcoming-exam-client.tsx
│   └── [examId]/
│       ├── page.tsx                # Exam detail
│       ├── exam-detail-client.tsx
│       └── syllabus/page.tsx
│
├── components/upcoming-exam/
│   ├── exam-selector.tsx
│   ├── exam-card.tsx
│   ├── custom-exam-dialog.tsx
│   ├── syllabus-tree.tsx
│   ├── syllabus-progress-card.tsx
│   ├── pyq-trend-chart.tsx
│   ├── study-material-card.tsx
│   ├── feature-tips.tsx
│   └── exam-countdown-widget.tsx
│
├── stores/exam-store.ts
│
├── types/exam.types.ts
│
└── app/api/upcoming-exam/
    ├── route.ts
    ├── [examId]/route.ts
    ├── pyq-analyze/route.ts
    └── progress/route.ts
```

---

## AI Integration

### PYQ Analysis Prompt

```
Analyze Previous Year Questions for {examName}:
{pyqData}

Identify:
1. Most frequently tested topics (% of questions)
2. Topics trending UP (more questions each year)
3. Topics trending DOWN
4. Predicted important topics for next exam
5. Recommended study priority

Return JSON: topic_frequency, trends, predictions, recommendations
```

### Material Recommendation Prompt

```
Based on syllabus topic: {topicTitle}
For exam: {examName}

Suggest:
1. Best books (with author, edition)
2. Free online resources
3. YouTube channels/playlists
4. Practice question sources

Prioritize free resources. Include NCERT/standard texts.
```

---

## Feature Tips (PrepSPSC Integration)

| Feature | How It Helps |
|---------|--------------|
| AI Study Tools | Generate mindmaps for each syllabus topic |
| Mock Tests | Practice with SPSC-pattern questions |
| Study Rooms | Join SPSC aspirants study hall |
| Pomodoro Timer | Track study hours per topic |
| Streaks | Build daily consistency for exam prep |
| Flashcards | Quick revision of key facts |
| Current Affairs | Stay updated on Sikkim news |

---

## Seed Data (SPSC)

### Exams

| Name | Slug | Type | Typical Date |
|------|------|------|--------------|
| SPSC Combined Competitive Exam | spsc-cce | combined | Dec-Jan |
| SPSC Junior Engineer | spsc-je | combined | Mar-Apr |
| SPSC Forest Ranger | spsc-fr | combined | Jun-Jul |

### Sample Syllabus (SPSC CCE)

```
General Studies (50%)
├── Indian History (10%)
│   ├── Ancient India
│   ├── Medieval India
│   └── Modern India
├── Indian Polity (15%)
├── Geography (10%)
└── Current Affairs (15%)

Sikkim GK (25%)
├── Sikkim History
├── Sikkim Geography
├── Sikkim Polity
└── Sikkim Current Affairs

English (25%)
├── Comprehension
├── Grammar
└── Essay Writing
```

---

## Implementation Phases

| Phase | Tasks | Duration |
|-------|-------|----------|
| 1 | Database + Types | 2 days |
| 2 | Core UI (selection, cards) | 3 days |
| 3 | Exam Detail + Syllabus | 3 days |
| 4 | PYQ Analysis (AI) | 2 days |
| 5 | Study AI Goals Integration | 2 days |
| 6 | Materials + Tips | 2 days |
| 7 | Dashboard Widget + Nav | 1 day |
| 8 | Testing + Polish | 2 days |

**Total: ~17 days**

---

## Success Metrics

- [ ] Users can browse and select SPSC exams
- [ ] Syllabus displays with progress tracking
- [ ] PYQ trends chart renders correctly
- [ ] AI generates useful topic predictions
- [ ] Goals created from syllabus appear in Study AI
- [ ] Dashboard shows exam countdown
- [ ] Navigation works on mobile + desktop

---

## Future Enhancements

1. **More Exams**: UPSC, SSC, Banking, Railways
2. **Community PYQ**: Users contribute PYQ data
3. **Study Groups**: Exam-specific study rooms
4. **Mock Test Mapping**: Link tests to syllabus topics
5. **Progress Sharing**: Share syllabus completion on social
6. **Mentor Connect**: Connect with exam toppers

---

*Created: January 2026*
