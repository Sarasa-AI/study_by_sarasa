# E2E Manual Testing Guide — Medical Simulator MVP
> **Version:** 2.0.0 · **Last updated:** 2026-08-06  
> **Stack:** Next.js 14 App Router · Prisma/PostgreSQL+pgvector · OpenRouter · NextAuth  
> **Primary locale:** Persian (RTL) — all UI strings are in Farsi unless noted

---

## 0. Conventions & Setup

### 0.1 Roles
| Alias | Role | Credentials (local seed) |
|---|---|---|
| **S** | Student | `student@test.com / Test1234` |
| **I** | Instructor | `instructor@test.com / Test1234` |

### 0.2 Environment
```
BASE_URL=http://localhost:3000
DB=postgresql://localhost:5432/medical_dev
```
Run `npx prisma db seed` before each full session to guarantee a clean baseline.

### 0.3 Notation
- `→` means "navigate to" or "click"
- `[text]` means a UI element with that exact label
- `{var}` means a value you fill in
- ✅ = pass condition · ❌ = fail / bug signal
- **Teardown** blocks must be executed even when a test fails.

### 0.4 Acceptable Performance Thresholds
| Operation | Max latency |
|---|---|
| AI case generation (RAG path) | 30 s |
| PDF embedding (< 10 pages) | 20 s |
| Cohort analytics page load (cold cache) | 5 s |
| Image compression + upload | 8 s |
| Exam answer persist | 2 s |

---

## Module 1 — RAG & Knowledge Base

> Routes: `/instructor/knowledge`  
> Components: `KnowledgeBaseManager`  
> Actions: `ingestKnowledgeAction` in `src/lib/knowledge-actions.ts`  
> DB table: `ClinicalDocument` (pgvector, 1536 dims)

---

### 1.1 Happy Path — PDF Ingestion

**Preconditions:** Logged in as **I**.

**Steps:**
1. → `/instructor/knowledge`
2. Fill `[عنوان سند]` with `"نلسون فصل ۱۴ — تب"`
3. Fill `[منبع / مرجع]` with `"Nelson Textbook 21e"`
4. Leave category blank (optional)
5. Click `[انتخاب فایل]`, select a valid PDF ≤ 20 MB (e.g. a 5-page text-based PDF)
6. Click `[ذخیره و ایمبد]`

**Expected:**
- Button label changes to `"در حال پردازش سند و تولید بردارهای RAG..."` within 200 ms
- `AiProcessingIndicator` cycles through three messages:
  1. `"در حال استخراج متن سند..."`
  2. `"در حال پردازش سند و تولید بردارهای RAG..."`
  3. `"در حال ذخیره در پایگاه دانش..."`
- After completion, a success toast appears: `"سند با موفقیت ذخیره وایمبد شد (N بخش)"` where N ≥ 1
- The document appears in the document list below the form
- DB: rows in `ClinicalDocument` with non-null `embedding` column

**Edge Cases:**
- PDF with only a single short paragraph → N = 1 chunk; success toast still shows
- PDF with mixed Persian + English text → chunks should contain both; test by triggering AI case generation on the same topic and verifying the source appears in citations
- Network drop mid-embedding (simulate by throttling to Offline after step 5) → error toast; no partial `ClinicalDocument` rows without embeddings should remain

**Teardown:** `DELETE FROM "ClinicalDocument" WHERE source = 'Nelson Textbook 21e';`

---

### 1.2 Happy Path — Plain Text Ingestion

**Steps:**
1. → `/instructor/knowledge`
2. Fill title + source fields
3. Leave file picker empty
4. Paste ≥ 200 characters into `[متن محتوا]` textarea
5. Click `[ذخیره و ایمبد]`

**Expected:** Same cycling indicator, success toast with chunk count.

**Edge Cases:**
- Exactly 1 character in textarea → client-side validation should block; the action returns `"متنی از فایل PDF استخراج نشد"` path is skipped; text chunker returns empty → toast `"متن واردشده قابل تقسیم به بخش‌های معتبر نیست"`
- Submit with both file AND text filled → file takes precedence (PDF path); text field is ignored

---

### 1.3 Invalid File Type

**Steps:**
1. → `/instructor/knowledge`
2. Select a `.docx`, `.txt`, or `.png` file
3. Click `[ذخیره و ایمبد]`

**Expected:** Toast `"فقط فایل PDF پذیرفته می‌شود"` immediately; no server round-trip.

**Edge Cases:**
- Rename `malicious.exe` → `malicious.pdf`, upload → server should reject if MIME type is not `application/pdf`; toast `"فقط فایل PDF پذیرفته می‌شود"` must still appear
- Upload a password-protected PDF → `pdf-parse` throws; toast `"استخراج متن از فایل PDF با خطا مواجه شد..."` expected

---

### 1.4 Oversized PDF (> 20 MB)

**Steps:**
1. Prepare a PDF > 20 MB (or use `dd if=/dev/urandom bs=1M count=21 | cat > big.pdf` then rename)
2. Attempt upload

**Expected:** Toast `"حجم فایل PDF نباید بیشتر از۲۰ مگابایت باشد"` — check this triggers server-side (not just `<input>` restriction).

---

### 1.5 Scanned / Image-Only PDF

**Steps:**
1. Convert a PNG to PDF without OCR (e.g. via `img2pdf`)
2. Upload it

**Expected:** Toast `"متنی از فایل PDF استخراج نشد؛ممکن است فایل اسکن‌شده (تصویری) باشد"`. No DB rows created.

---

### 1.6 RAG Retrieval Quality Smoke Test

**Steps:**
1. Ingest a document with specific content, e.g. "تب مالت (Brucellosis) در کودکان..."
2. → `/instructor/cases/ai-generate`
3. Enter topic `"تب مالت"`, select matching category, set questions to 1
4. Click `[تولید پیش‌نویس کیس با AI]`

**Expected:**
- Generated case contains a `[استناد]` / citation block referencing the ingested source
- No amber "fallback" banner visible (fallback only appears when RAG returns 0 results)

**Edge Cases:**
- Topic completely unrelated to any ingested doc → amber fallback banner `"کیس به‌صورت پیش‌نویس ذخیره شد (بدون رفرنس اختصاصی — دانش عمومی مدل)"` should appear after generation

---

## Module 2 — AI Case Generation & Review

> Routes: `/instructor/cases/ai-generate`, `/instructor`, `/instructor/cases/[id]/edit`  
> Components: `AICaseGenerateClient`, `AIGenerateCasePanel`, `CaseForm`, `CaseStatusBadge`, `CaseManagementActions`  
> Actions: `generateAICaseAction`, `setCaseStatusAction`, `createCaseAction`, `updateCaseAction`  
> Statuses: `DRAFT → IN_REVIEW → PUBLISHED | REJECTED`

---

### 2.1 Happy Path — RAG-Grounded Generation

**Preconditions:** Logged in as **I**. At least one `ClinicalDocument` ingested (see 1.1).

**Steps:**
1. → `/instructor/cases/ai-generate`
2. Fill `[موضوع یا سناریوی بالینی]` with a topic matching ingested content
3. Select a category from the dropdown
4. Set `[تعداد سوالات]` to `2`
5. Select difficulty `MEDIUM`
6. Click `[تولید پیش‌نویس کیس با AI]`

**Expected:**
- Button immediately shows `"در حال سنتز کیس بالینی..."` and is disabled
- `AiProcessingIndicator` cycles:
  1. `"در حال بازیابی منابع بالینی مرتبط..."`
  2. `"در حال سنتز کیس بالینی با هوش مصنوعی..."`
  3. `"در حال تدوین سوالات و پاسخ‌ها..."`
- After ≤ 30 s, `CaseForm` pre-fills with the generated case data
- The form shows exactly 2 question blocks
- A citation block appears referencing the ingested source
- No amber fallback banner visible

**Edge Cases:**
- Change question count to `3` then immediately to `1` before clicking → only the final selected count is sent
- Close the browser tab mid-generation → on return, the form is empty; no orphaned DB row should exist (generation does not persist automatically)

**Teardown:** Close or clear the pre-filled form without saving. No DB cleanup needed (generation is not persisted until `CaseForm` submit).

---

### 2.2 Fallback — No RAG Match

**Steps:**
1. → `/instructor/cases/ai-generate`
2. Enter a highly specific topic with no ingested documents (e.g. `"بیماری کاوازاکی عود کننده"`)
3. Generate

**Expected:**
- Amber notice banner appears below the generated form: `"کیس به‌صورت پیش‌نویس ذخیره شد (بدون رفرنس اختصاصی — دانش عمومی مدل)"`
- Citation field in the form shows the fallback reference note
- Case form is still fully pre-filled and editable

---

### 2.3 Status Cycle: DRAFT → PUBLISHED

**Preconditions:** Logged in as **I**. A case exists in `DRAFT` status.

**Steps:**
1. → `/instructor`
2. Locate the DRAFT case in the case list — badge shows `DRAFT` (grey/slate)
3. Click the case row → `/instructor/cases/[id]/edit`
4. Scroll to the `CaseManagementActions` section
5. Click `[انتشار کیس]` or the publish status button

**Expected:**
- Toast: `"کیس با موفقیت منتشر شد"`
- `CaseStatusBadge` updates to `PUBLISHED` (teal/green)
- Case is now visible to students in `/library`
- `cohort-analytics` cache tag is invalidated (verify by checking `/instructor/cohort` refreshes)

**Edge Cases:**
- Double-click publish button quickly → idempotent; second call should not error; badge remains PUBLISHED
- Publish a case that has 0 questions → check if validation blocks this or if it publishes with empty questions

---

### 2.4 Status Cycle: PUBLISHED → REJECTED

**Steps:**
1. Find a PUBLISHED case in `/instructor`
2. → edit page
3. Click `[رد و بایگانی]` in `CaseManagementActions`

**Expected:**
- Toast: `"کیس با موفقیت رد و بایگانی شد"`
- Badge changes to `REJECTED` (rose/red)
- Case is no longer returned in student-facing `/library` or `/home` recommendations
- Cache tag `cohort-analytics` is revalidated

**Edge Cases:**
- Re-opening a REJECTED case → verify the edit form loads correctly; status badge is REJECTED
- Attempting to publish a REJECTED case directly (bypassing DRAFT) → should be allowed per the schema; verify toast shows `"کیس با موفقیت منتشر شد"`

---

### 2.5 `AiProcessingIndicator` Cycling Validation

**Steps:**
1. Open DevTools → Network tab, set throttle to "Slow 3G"
2. Trigger AI generation (step 2.1)
3. Watch the indicator messages over ~15 s

**Expected:**
- Each of the 3 messages displays for at least one full rotation
- Messages cycle smoothly without flickering or jumping to an error state prematurely
- If the request eventually times out (> 30 s), a descriptive error toast appears — NOT an unhandled `[object Object]` in the UI

---

### 2.6 AI Rate Limit Handling

**Steps:**
1. Trigger 5–6 rapid generation requests in quick succession (open multiple tabs as instructor)
2. Observe toast messages

**Expected:**
- On rate-limited request: toast `"محدودیت درخواست هوش مصنوعی؛ لطفاً کمی بعد تلاش کنید"`
- The indicator spinner stops; the button returns to idle state `[تولید پیش‌نویس کیس با AI]`
- No unhandled promise rejection in the console

**Teardown (2.3–2.6):** `DELETE FROM "Case" WHERE title LIKE '%تست%' AND "createdAt" > now() - interval '1 hour';`

---

## Module 3 — Clinical Media Uploads

> Component: `ClinicalImageField` in `CaseForm`  
> Action: `uploadClinicalImage` in `src/lib/clinical-media-actions.ts`  
> Storage: `public/uploads/cases/`  
> Processing: `sharp` (resize 1600×1600 fit:inside, JPEG q80 / PNG level 9)

---

### 3.1 Happy Path — JPEG Upload

**Preconditions:** Logged in as **I**, on any case create/edit page.

**Steps:**
1. → `/instructor/cases/new` or edit an existing case
2. In the `ClinicalImageField`, click `[انتخاب تصویر]`
3. Select a valid JPEG (e.g. 3 MB, 2000×1500 px)
4. Wait for upload

**Expected:**
- Upload progress indicator visible during processing
- Toast: `"تصویر بالینی با موفقیت بارگذاری شد"`
- Preview thumbnail appears in the field
- Output file: JPEG ≤ original size, max dimension 1600 px — verify by right-clicking the preview and inspecting the URL (`/uploads/cases/{timestamp}-{uuid}.jpg`)
- Checking the file on disk: dimensions ≤ 1600×1600, size should be noticeably smaller than original due to q80 mozjpeg

**Edge Cases:**
- Image with EXIF rotation (portrait photo taken on phone) → `sharp` auto-rotate should correct orientation; preview should appear upright
- Very small image (50×50 px) → no upscaling; output is same size, not enlarged to 1600

---

### 3.2 PNG Upload

**Steps:**
1. Select a valid PNG (e.g. a clinical diagram, 800 KB, RGBA)
2. Upload

**Expected:**
- Toast success
- Output file is a PNG (not converted to JPEG)
- File size reduced by PNG compression level 9
- Transparency preserved (alpha channel) — check by viewing the image on a dark background

---

### 3.3 Invalid Format (SVG, GIF, WebP, HEIC)

**Steps (repeat for each):**
1. Attempt to upload a `.svg` file
2. Attempt to upload a `.gif` file
3. Attempt to upload a `.webp` file
4. Attempt to upload a `.heic` file

**Expected for all:** Toast `"فقط فایل‌های JPEG و PNG مجاز هستند"`. No file written to `public/uploads/cases/`.

**Edge Case (critical — security):**
- Rename `xss.svg` (containing `<script>alert(1)</script>`) to `xss.jpg` → server must reject based on MIME sniffing, not just extension; toast must still appear
- If the server does accept a renamed SVG, treat this as a **HIGH severity bug** (stored XSS vector)

---

### 3.4 Oversized File (> 5 MB)

**Steps:**
1. Select a JPEG > 5 MB

**Expected:** Toast `"حجم تصویر نباید بیشتر از ۵ مگابایت باشد"`. No DB write, no file on disk.

---

### 3.5 Compression Output Verification

**Steps:**
1. Upload a JPEG of exactly 4.9 MB at 4000×3000 px
2. Note the original filename and size
3. After upload, download the stored file from the preview URL

**Expected:**
- Width or height is exactly 1600 px (the constraining dimension)
- File size is substantially smaller (typically < 500 KB at q80)
- Image is not visibly degraded for clinical use (no blocking artifacts on diagnostic areas)

---

### 3.6 Image Replacement

**Steps:**
1. Upload image A → preview appears
2. Without saving the case, click `[انتخاب تصویر]` again and upload image B
3. Save the case

**Expected:**
- Preview updates to image B
- `Case.mediaUrl` points to image B's path
- Image A's file should not remain on disk (check `public/uploads/cases/` for orphaned files — if cleanup is not implemented, log as a maintenance issue)

**Teardown:** Remove test files: `rm public/uploads/cases/*test* 2>/dev/null || true`

---

## Module 4 — Student Exam Flow

> Routes: `/exams`, `/exams/[sessionId]`, `/exams/[sessionId]/results`  
> Components: `ExamRunner`, `StartExamButton`, `ClinicalImageViewer`  
> Actions: `startExam`, `submitAnswer`, `finishExam`

---

### 4.1 Happy Path — Full Exam Completion

**Preconditions:** Logged in as **S**. At least one published exam with ≥ 3 questions exists.

**Steps:**
1. → `/exams`
2. Locate an exam card showing duration, question count, and passing score
3. Click `[شروع آزمون]`
4. Answer all questions — for each, select a radio option
5. Click `[ثبت نهایی آزمون]`
6. In the confirm modal: verify it shows answered/total count (e.g. `"۳ از ۳ سوال پاسخ داده شده"`)
7. Click `[ثبت نهایی]`

**Expected:**
- Redirect to `/exams/{sessionId}/results`
- Score displayed as a percentage
- Pass/fail badge: teal `CheckCircle2` if score ≥ passing threshold; rose `XCircle` otherwise
- Per-question review shows correct answer (teal highlight), student's wrong pick (rose highlight), `clinicalReasoning` block, and individual `distractorRationales`
- `[بازگشت به فهرست آزمون‌ها]` button returns to `/exams`

**Edge Cases:**
- Answer all questions correctly → score = 100%; pass badge must show
- Answer all questions incorrectly → score = 0%; fail badge; all answers shown in rose

---

### 4.2 `ClinicalImageViewer` — Zoom & Pan

**Preconditions:** The exam (or a case quiz) contains a question with a `mediaUrl` (clinical image).

**Steps:**
1. Start an exam that includes a clinical image question
2. Navigate to that question in `ExamRunner`
3. Locate the `ClinicalImageViewer` component
4. **Zoom in:** scroll up (mouse wheel) or pinch-out on a touch device → image should enlarge
5. **Pan:** click and drag the zoomed image → image should pan within the viewer boundaries
6. **Zoom out:** scroll down or pinch-in → image returns toward original size
7. **Reset:** double-click or locate a reset button → image returns to original scale/position

**Expected:**
- Zoom works in both desktop (mouse wheel) and mobile (pinch gesture) modes
- Panning only activates when the image is zoomed in (scale > 1)
- The viewer never overflows the exam layout — scrollbars on the page should not appear during zoom
- Zooming/panning does not accidentally trigger answer radio selection

**Edge Cases:**
- Rapid scroll / multi-finger gestures → no crash; zoom clamps at min (1×) and a reasonable max (e.g. 4×)
- Keyboard-only: Tab to the image viewer → check whether zoom level is exposed via `aria-label` (see Module 7)

---

### 4.3 Timer Auto-Submit

**Steps:**
1. Start an exam
2. In DevTools console, run: `localStorage.setItem('__override_exam_end', Date.now() + 5000)` (if the component supports a debug override) — OR use a short-duration test exam (1 min)
3. Wait for the countdown to reach 00:00 without clicking `[ثبت نهایی آزمون]`

**Expected:**
- Timer turns red when ≤ 5 min remaining
- At 00:00, `finishExam` is called automatically
- Redirect to results page occurs without user interaction
- Results page shows correct score based on answers submitted before auto-submit

**Edge Cases:**
- Network is offline when timer expires → retry logic should be visible; no silent data loss
- Student has answered 0 questions when timer expires → auto-submit succeeds; results show score = 0%

---

### 4.4 Tab-Switch Detection

**Steps:**
1. Start an exam
2. Switch to a different browser tab (or minimize window)
3. Return to the exam tab

**Expected:**
- Warning banner appears: `"هشدار تغییر تب"` / `"ترک صفحه در حین آزمون ثبت شد"`
- The exam continues normally (tab-switch is recorded, not a hard fail)
- Multiple tab switches are each recorded (verify in DB: `ExamSession` may have a `tabSwitchCount` field or similar log)

---

### 4.5 Partial Submission (Some Questions Unanswered)

**Steps:**
1. Start an exam with 5 questions
2. Answer only 2 questions
3. Click `[ثبت نهایی آزمون]`

**Expected:**
- Confirm modal shows: e.g. `"۲ از ۵ سوال پاسخ داده شده"` with a warning about unanswered questions
- User can still confirm and submit
- Results page shows unanswered questions as incorrect (score = 2/5 at most)

**Edge Cases:**
- Answer 0 questions, submit → modal shows `"۰ از N سوال پاسخ داده شده"`; submission still succeeds; score = 0%

---

### 4.6 Revisiting a Completed Session

**Steps:**
1. Complete an exam normally → land on results page
2. Copy the URL `/exams/{sessionId}/results`
3. Open it in a new tab

**Expected:** Results page loads correctly (idempotent — `finishExam` guards against re-processing a `COMPLETED` session).

**Steps (attempt to re-enter exam):**
1. Navigate directly to `/exams/{sessionId}` of a completed session

**Expected:** `ExamRunner` either redirects to the results page or shows a "this exam is already completed" message — NOT an active exam UI with a running timer.

---

### 4.7 Exam With No Questions

**Preconditions:** Instructor creates an exam but adds 0 questions.

**Steps:**
1. As **S**, attempt to start the empty exam

**Expected:** Toast `"این آزمون هنوز سؤالی ندارد"`. No `ExamSession` row created in DB.

**Teardown:** `UPDATE "ExamSession" SET status = 'ABANDONED' WHERE "userId" = {testStudentId} AND "createdAt" > now() - interval '1 hour';`

---

## Module 5 — Cohort Analytics

> Route: `/instructor/cohort`  
> Component: `InstructorCohortPage`  
> Action: `getClassAnalytics` in `src/lib/cohort-actions.ts`  
> Cache: `unstable_cache` (60 s TTL, tag `"cohort-analytics"`)  
> Invalidated by: `finishExam`, `createCaseAction`, `updateCaseAction`, `setCaseStatusAction`, `deleteCaseAction`

---

### 5.1 Happy Path — Populated Analytics

**Preconditions:** Logged in as **I**. At least 2 students have completed ≥ 1 exam each, covering ≥ 2 different categories.

**Steps:**
1. → `/instructor/cohort`
2. Observe the top summary cards
3. Observe the category performance list
4. Observe the student roster

**Expected:**
- Header: `"تحلیل کلاس"`
- Card `"تعداد دانشجویان فعال"` shows the correct integer count
- Card `"میانگین دقت کلاس"` shows a percentage (0–100%) matching `(sum of correct answers) / (sum of total answers) × 100`
- Category performance list shows bars with labels; bars are sorted alphabetically (Persian locale `fa`)
- Student roster sorted by `averageAccuracy` descending (highest scorer at top)
- Desktop: table with columns `"نام دانشجو"`, `"تعداد آزمون تکمیل‌شده"`, `"میانگین دقت"`
- Mobile (< 768 px viewport): stacked cards layout instead of table

**Edge Cases:**
- A student with `completedExams = 0` (enrolled but never submitted) → still appears in roster with `"—"` or `0%` accuracy; must not cause a division-by-zero crash
- Category with only 1 answer total → bar still renders at correct width; no layout overflow

---

### 5.2 Cache Invalidation After Exam Completion

**Goal:** Verify the 60 s `unstable_cache` is properly busted when a student finishes an exam.

**Steps:**
1. As **I**, → `/instructor/cohort` — note current `"میانگین دقت کلاس"` value (e.g. `72%`)
2. Open a second browser window/profile as **S**
3. As **S**, start and complete an exam with a score significantly different from the current average (e.g. 0% or 100%)
4. As **I**, hard-refresh `/instructor/cohort` (`Cmd+Shift+R` / `Ctrl+Shift+R`)

**Expected:**
- `"میانگین دقت کلاس"` value updates to reflect the newly completed exam
- This update should occur **immediately** after the hard-refresh (not delayed by the 60 s TTL) because `finishExam` calls `revalidateTag("cohort-analytics")`
- Student appears in the roster (or their `averageAccuracy` / `completedExams` count updates)

**Edge Cases:**
- Navigate away from `/instructor/cohort` and back via client-side routing (`<Link>`) — does the cached data remain stale until the next revalidation? Verify Next.js router cache vs fetch cache behavior
- Rapidly complete 3 exams in < 60 s → each `revalidateTag` call is idempotent; analytics should be consistent with all 3 completions on next page load

---

### 5.3 Cache Invalidation After Case Status Change

**Steps:**
1. As **I**, note current `"تعداد دانشجویان فعال"` on `/instructor/cohort`
2. Publish a new case (which calls `createCaseAction` → `revalidateTag`)
3. Hard-refresh `/instructor/cohort`

**Expected:** Page re-renders; data is fresh (no 60 s wait required). Student count remains correct (no student is added by publishing a case, but verifying no stale artifact).

---

### 5.4 Empty State — No Students

**Preconditions:** Use a fresh test DB with only one instructor account and no student accounts.

**Steps:**
1. → `/instructor/cohort`

**Expected:**
- Card `"تعداد دانشجویان فعال"` shows `0`
- Category performance section shows: `"هنوز عملکردی بر اساس دسته‌بندی ثبت نشده است"`
- Student roster shows: `"دانشجویی یافت نشد"`
- No JavaScript errors in console; page renders without crashing

---

### 5.5 Empty State — Students Exist But No Exams Taken

**Preconditions:** At least 1 student account exists; no `ExamSession` with status `COMPLETED` exists.

**Steps:**
1. → `/instructor/cohort`

**Expected:**
- Card `"تعداد دانشجویان فعال"` shows the student count (they are "active" users even without exams)
- Card `"میانگین دقت کلاس"` shows `"—"` or `0%` — must NOT show `NaN` or `Infinity`
- Student roster shows: `"هنوز دانشجویی آزمون نداده است"` OR the roster renders with each student showing `0` exams / `0%` accuracy
- Category breakdown shows: `"هنوز عملکردی بر اساس دسته‌بندی ثبت نشده است"`

---

### 5.6 Accuracy Color Thresholds (Rose / Amber / Teal)

**Preconditions:** Arrange test data so that at least one category falls into each threshold band:
- **Rose:** accuracy < 40%
- **Amber:** accuracy 40–59%
- **Teal/Primary:** accuracy ≥ 60%

**Steps:**
1. → `/instructor/cohort`
2. Inspect the category performance bars visually and in DevTools (check CSS classes)

**Expected:**
- Category with < 40% accuracy → progress bar has a **rose** color class (e.g. `bg-rose-500`)
- Category with 40–59% accuracy → progress bar has an **amber** color class (e.g. `bg-amber-500`)
- Category with ≥ 60% accuracy → progress bar has the **primary teal** color class (e.g. `bg-teal-600` or `bg-primary`)
- Boundary values: exactly 40% → amber (not rose); exactly 60% → teal (not amber)

**Edge Cases:**
- Category with exactly 0% accuracy → rose; no negative-width bar or layout break
- Category with exactly 100% accuracy → teal; bar fills container without overflow

---

### 5.7 Student Roster Sort Stability

**Steps:**
1. Create 3 students, all with identical `averageAccuracy` (e.g. 75%)
2. → `/instructor/cohort`

**Expected:**
- Students with identical accuracy appear in a consistent, stable order (not randomly shuffled on each page reload)
- Recommended secondary sort: alphabetical by name or chronological by `createdAt`

**Teardown (Module 5):**
```sql
-- Remove test exam sessions created during these tests
DELETE FROM "ExamSession"
WHERE "createdAt" > now() - interval '2 hours'
  AND status = 'COMPLETED';
```

---

## Module 6 — Security & Authorization Tests

> ⚠️ These tests require careful teardown. Run in an isolated test environment only.

---

### 6.1 IDOR — Exam Session Access

**Goal:** Verify a student cannot view another student's exam results by guessing a session ID.

**Setup:**
1. As **S1** (student 1), complete an exam → note the `sessionId` from the URL: `/exams/{sessionId}/results`
2. Log out. Log in as **S2** (a different student account)

**Steps:**
1. As **S2**, navigate directly to `/exams/{sessionId}/results` (using S1's session ID)

**Expected:**
- ❌ Access denied: HTTP 403/404 or redirect to `/dashboard`
- S2 must NOT see S1's answers, score, or any result data

**Regression check:** Also test `/exams/{sessionId}` (the live exam route) — S2 must not be able to resume S1's exam.

---

### 6.2 Role Enforcement — Student Accessing Instructor Routes

**Steps (as S):**
1. Navigate to `/instructor` → expected redirect to `/dashboard`
2. Navigate to `/instructor/knowledge` → expected redirect to `/dashboard`
3. Navigate to `/instructor/cohort` → expected redirect to `/dashboard`
4. POST directly to `generateAICaseAction` via `curl` with a student session cookie

**Expected for all:** Redirect to `/dashboard` for page routes (enforced at middleware level). Server action returns error `"فقط استادان می‌توانند کیس تولید کنند"`.

**Edge Cases:**
- JWT is valid but `role` field is absent → should be treated as `STUDENT`; instructor routes blocked
- Expired JWT with instructor role → NextAuth should reject; redirect to `/login`

---

### 6.3 Malicious File Upload — SVG with Embedded Script

**Goal:** Ensure the image upload endpoint rejects SVG files even when disguised.

**Setup:** Create `xss.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <script>alert('XSS')</script>
</svg>
```

**Steps:**
1. As **I**, on the case edit page, attempt to upload `xss.svg` via `ClinicalImageField`
2. Rename to `xss.jpg` and try again

**Expected:**
- Upload of `xss.svg` → toast `"فقط فایل‌های JPEG و PNG مجاز هستند"` (client or server)
- Upload of `xss.jpg` (SVG renamed) → server-side MIME detection must **reject** it; same toast
- Under no circumstances should an SVG file be written to `public/uploads/cases/`

---

### 6.4 Zip Bomb / Oversized Archive Disguised as PDF

**Setup:** Create a small file that expands massively when parsed (a "zip bomb" or a deeply nested object PDF). Alternatively, create a PDF with tens of thousands of pages.

**Steps:**
1. As **I**, upload the crafted file to the knowledge base

**Expected:**
- File size check (20 MB limit) blocks typical zip bombs before parsing
- If parsing begins: a timeout or memory limit causes an error toast rather than a server crash
- The server process remains healthy after the attempt (verify with `/api/health`)

---

### 6.5 AI Endpoint Rate Limiting — Behavior Under Load

**Goal:** Verify the server does not expose unhandled errors or 500 responses when OpenRouter rate-limits the app.

**Steps:**
1. As **I**, open 6 browser tabs simultaneously, all on `/instructor/cases/ai-generate`
2. In rapid succession (< 2 s apart), click `[تولید پیش‌نویس کیس با AI]` in each tab

**Expected:**
- Rate-limited requests return toast `"محدودیت درخواست هوش مصنوعی؛ لطفاً کمی بعد تلاش کنید"`
- No tab shows a raw stack trace or `500 Internal Server Error` in the UI
- Non-rate-limited requests (whichever arrive first) complete successfully
- Server logs (`/api/log` or console) show structured `action.error` entries, not unhandled exceptions

---

### 6.6 Unauthenticated API Access

**Steps:**
1. Log out completely (clear cookies)
2. Directly call: `GET /api/cases`, `GET /api/dashboard`, `POST /api/quiz/submit`

**Expected:**
- All endpoints return HTTP 401 or redirect to `/login`
- No case content, student data, or quiz answers are returned to unauthenticated requests

---

## Module 7 — Accessibility & RTL Tests

> The app is RTL-first (Persian). All tests below must be performed with the browser language set to `fa-IR` and layout direction `rtl`.

---

### 7.1 Screen Reader — Main Navigation

**Tool:** macOS VoiceOver (`Cmd+F5`) or NVDA (Windows).

**Steps:**
1. → `/dashboard` as **S**
2. Activate VoiceOver; Tab through `SidebarNav`
3. Navigate each link group: Learning, Insights, Personal

**Expected:**
- Every `<a>` and `<button>` has a meaningful accessible name (not just an icon)
- Link groups have `role="group"` or `<nav>` with `aria-label`
- Sidebar footer badges (XP `Zap`, streak `Flame`, freeze `Snowflake`) are announced with their numeric values, not just as decorative icons
- Active/current route link is announced as `aria-current="page"`

**Edge Cases:**
- Collapsed sidebar on mobile → hamburger button must be announced as `"منوی ناوبری"` or equivalent; drawer open state changes must be announced

---

### 7.2 Keyboard Navigation — ExamRunner

**Steps:**
1. Start an exam as **S**
2. Plug in keyboard only (disable mouse/touchpad)
3. Tab through all interactive elements

**Expected order of focus:**
1. Current question's radio options (Tab cycles A → B → C → D)
2. `[قبلی]` / `[بعدی]` navigation buttons
3. Question grid numbers
4. `[ثبت نهایی آزمون]` button

**Expected:**
- Focus ring is clearly visible (contrast ≥ 3:1 against background) on every focusable element
- Pressing Space/Enter on a radio option selects it (same as click)
- Pressing Enter on `[ثبت نهایی آزمون]` opens the confirm modal
- Inside the modal: focus is trapped (Tab cycles only between `[انصراف]` and `[ثبت نهایی]`)
- Escape key dismisses the modal and returns focus to `[ثبت نهایی آزمون]`
- Pressing Enter on `[ثبت نهایی]` in the modal submits the exam

**Edge Cases:**
- If a `ClinicalImageViewer` is present: Tab to it → verify `aria-label` describes zoom level, e.g. `"تصویر بالینی، بزرگ‌نمایی ۱×"`
- After auto-submit (timer expiry): focus should move to the results page heading, not stay on an invisible exam element

---

### 7.3 RTL Layout Integrity

**Steps:**
1. Open each main page in Chrome DevTools with "Emulate RTL" or verify natively
2. Check: `/dashboard`, `/library`, `/exams`, `/instructor`, `/instructor/cohort`

**Expected for all:**
- Text reads right-to-left; no Hebrew or LTR alphabet content forced into LTR order
- `[قبلی]` (Previous) button uses `ChevronRight` icon (visually on the right side)
- `[بعدی]` (Next) button uses `ChevronLeft` icon (visually on the left side)
- Progress bars fill from **right to left**
- Sidebar is anchored to the **right** side of the screen (not left)
- Toast notifications appear at the correct RTL corner (top-right or bottom-right per Sonner/Toaster config)
- Table columns: first column (`"نام دانشجو"`) is right-aligned; last column (`"میانگین دقت"`) is left-aligned

**Edge Cases:**
- Numbers (XP values, percentages, question counts) must render LTR within RTL context — `42%` not `%42`
- Mixed Persian + numeric strings (e.g. `"۳ سوال"`) should display coherently

---

### 7.4 Color Contrast — Status Badges

**Tool:** Chrome DevTools → Accessibility panel, or [Colour Contrast Analyser](https://www.tpgi.com/color-contrast-checker/).

**Target elements:** `CaseStatusBadge` variants: `DRAFT`, `IN_REVIEW`, `PUBLISHED`, `REJECTED`

**Steps:**
1. → `/instructor` where multiple case status badges are visible
2. Use DevTools to inspect computed color and background-color for each badge
3. Calculate contrast ratio

**Expected (WCAG AA):**
| Badge | Minimum contrast ratio |
|---|---|
| DRAFT (slate) | ≥ 4.5:1 (small text) |
| IN_REVIEW (amber) | ≥ 4.5:1 |
| PUBLISHED (teal) | ≥ 4.5:1 |
| REJECTED (rose) | ≥ 4.5:1 |

**Also check:** Accuracy threshold bar colors (rose < 40%, amber 40–59%, teal ≥ 60%) on `/instructor/cohort` — bar labels must be readable against their bar background.

---

### 7.5 Focus Management — Modals and Drawers

**Scenarios to check:**

| Trigger | Modal/Drawer | Focus-in | Focus-out |
|---|---|---|---|
| `[ثبت نهایی آزمون]` | Confirm modal | First button (`[انصراف]`) | Returns to trigger button |
| Mobile sidebar hamburger | `AppShell` drawer | First nav link | Returns to hamburger |
| `[حذف کیس]` delete button | Confirm delete dialog | Confirm button | Returns to delete button |
| `QuestionFeedbackModal` feedback icon | Feedback form | First form input | Returns to feedback icon |

**Expected for all:**
- Focus moves **into** the modal immediately on open (no tabbing required)
- Focus is **trapped** inside the modal while it is open
- Focus returns to the **triggering element** on close (Escape or Cancel)
- Overlay/backdrop is not keyboard-focusable

---

## Appendix A — Performance Benchmarks

Run these benchmarks on a production-equivalent environment (not `next dev`). Use `next build && next start`.

| Scenario | How to Measure | Pass Threshold |
|---|---|---|
| AI case generation — RAG path | DevTools Network: time from click to form pre-fill | ≤ 30 s |
| AI case generation — fallback path | Same | ≤ 15 s |
| PDF ingestion (5-page, text-based) | Network: time from click to success toast | ≤ 20 s |
| Image upload + sharp compression | Network: time from file select to preview appearance | ≤ 8 s |
| Cohort analytics — cold cache | DevTools: time to interactive on `/instructor/cohort` | ≤ 5 s |
| Cohort analytics — warm cache (60 s) | Same, second load within 60 s | ≤ 1 s |
| Exam answer submission (`submitAnswer`) | Network: single POST round-trip | ≤ 2 s |
| Vector similarity search (`similaritySearch`) | Server log: `action.success` with `durationMs` | ≤ 3 s |

**Monitoring:** All server actions emit structured `action.success` logs with `durationMs`. Run a session, then filter logs: `grep action.success app.log | jq '.durationMs'` to validate against thresholds.

---

## Appendix B — Test Data Setup

### B.1 Seed Script (Development)
```bash
# Full reset + seed
npx prisma migrate reset --force
npx prisma db seed

# RAG-specific seed
npx ts-node prisma/seed-rag.ts
```

### B.2 Minimal SQL for Targeted Testing

```sql
-- Create a test student
INSERT INTO "User" (id, email, "studentCode", name, role, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'teststu@test.com', 'S999', 'دانشجو تست', 'STUDENT', now(), now());

-- Create a test instructor
INSERT INTO "User" (id, email, "studentCode", name, role, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'testins@test.com', 'I001', 'استاد تست', 'INSTRUCTOR', now(), now());

-- Create a DRAFT case for status toggle tests
INSERT INTO "Case" (id, "chiefComplaint", status, "instructorId", "categoryId", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'کیس تست وضعیت', 'DRAFT', {instructorId}, {categoryId}, now(), now());
```

### B.3 Teardown Queries

```sql
-- After Module 1 (RAG)
DELETE FROM "ClinicalDocument" WHERE source LIKE '%تست%' OR "createdAt" > now() - interval '2 hours';

-- After Module 2 (AI Generation)
DELETE FROM "Case" WHERE "chiefComplaint" LIKE '%تست%' AND "createdAt" > now() - interval '2 hours';

-- After Module 3 (Media Uploads)
-- Also run: find public/uploads/cases -newer /tmp/.test_marker -delete

-- After Module 4 (Exam)
UPDATE "ExamSession" SET status = 'ABANDONED'
WHERE status = 'IN_PROGRESS' AND "createdAt" > now() - interval '2 hours';

-- After Module 5 (Cohort Analytics)
DELETE FROM "ExamSession"
WHERE status = 'COMPLETED' AND "createdAt" > now() - interval '2 hours';

-- Full test user cleanup
DELETE FROM "User" WHERE email IN ('teststu@test.com', 'testins@test.com');
```

---

## Appendix C — Recommended Playwright Automation Targets

The following happy paths have the highest regression risk and should be the first candidates for automation:

| Priority | Scenario | Module |
|---|---|---|
| P0 | Student completes exam → results page shows correct score | 4.1 |
| P0 | Instructor generates AI case → saves as PUBLISHED | 2.1 + 2.3 |
| P0 | PDF ingested → RAG case generation references it | 1.1 + 1.6 |
| P1 | Status toggle: DRAFT → PUBLISHED → REJECTED | 2.3 + 2.4 |
| P1 | IDOR check: student cannot access another's session | 6.1 |
| P1 | Unauthenticated API returns 401 | 6.6 |
| P2 | Image upload: valid JPEG compressed + previewed | 3.1 |
| P2 | Tab-switch warning banner appears | 4.4 |
| P2 | Empty state cohort page renders without crash | 5.4 |

**Suggested Playwright project structure:**
```
e2e/
  auth.setup.ts        # Login and save storage state for S + I
  module1-rag.spec.ts
  module2-ai-gen.spec.ts
  module3-media.spec.ts
  module4-exam.spec.ts
  module5-cohort.spec.ts
  module6-security.spec.ts
  fixtures/
    test.pdf           # Valid 5-page text PDF
    test.jpg           # 3 MB JPEG at 2000x1500
    xss.svg            # Malicious SVG for rejection test
    oversized.pdf      # > 20 MB file
```

---

*End of E2E_MANUAL_TESTING.md — Medical Simulator MVP v2.0.0*

