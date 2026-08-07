# Happy Path User Journey & Architecture Reference

This document outlines the end-to-end "Happy Path" user journey across the **Frontend**, **Backend**, and **Database** layers of the Lumen Academy Exam Prep application.

---

## 1. System Module Structure

```
frontend/                       # UI Layer
├── App.tsx                     # Main router & app container
├── main.tsx                    # Client entry point
├── index.css                   # Tailwind CSS theme
├── assets/                     # App logo & static images
├── contexts/                   # Language Context (en/ta)
└── components/
    ├── common/                 # Header, LumenLogo, SplashView
    └── views/                  # Landing, Dashboard, CourseArea, Courses,
                                 # StudyPlan, TestList, SystemCheck, Lobby,
                                 # TestTaking, Evaluating

backend/                        # API & Server Layer
├── server.ts                   # Express server (Port 3000)
├── routes/                     # API Routes (/api/*)
└── controllers/                # Question, Analytics & Attempt Controllers

database/                       # Data Persistence Layer
├── index.ts                    # Unified database export
├── questions.ts                # Subject Question Banks
├── initialAttempts.ts          # Historical Performance Data
└── syllabusData.ts             # 24 Unit Syllabus & Notes
```

---

## 2. Happy Path Flow

### Step 1: Candidate Landing & Portal Entry
* **Frontend Component**: `frontend/components/views/LandingView.tsx`
* **Backend Endpoint**: `GET /api/health`
* **Flow**: Candidate opens the portal, sees `"JOURNEY TO SUCCESS START HERE"`, selects target stream ("Course Aspirant" / "Course Foundation"), and signs in.

### Step 2: Analytics Dashboard
* **Frontend Component**: `frontend/components/views/DashboardView.tsx`
* **Backend Controller**: `backend/controllers/analyticsController.ts` (`GET /api/analytics`)
* **Database Source**: `database/initialAttempts.ts`
* **Flow**: Displays AIR national rank forecast, score velocity trends, and weakness breakdown.

### Step 3: Syllabus Exploration & AI Study Plan
* **Frontend Components**: 
  - `frontend/components/views/CourseAreaView.tsx`
  - `frontend/components/views/CoursesView.tsx`
  - `frontend/components/views/StudyPlanView.tsx`
* **Backend Controller**: `backend/controllers/analyticsController.ts` (`GET /api/syllabus`)
* **Database Source**: `database/syllabusData.ts`
* **Flow**: Student explores unit notes, formula cheatsheets, and builds an AI-driven daily study roadmap.

### Step 4: Test Selection & Custom Calibration
* **Frontend Component**: `frontend/components/views/TestListView.tsx`
* **Backend Controller**: `backend/controllers/questionController.ts` (`GET /api/questions`)
* **Database Source**: `database/questions.ts`
* **Flow**: Candidate selects a mock test or creates a custom practice test and launches the pre-test check.

### Step 5: System Check & Rules Lobby
* **Frontend Components**: 
  - `frontend/components/views/SystemCheckView.tsx`
  - `frontend/components/views/LobbyView.tsx`
* **Flow**: System performs proctoring hardware verification (camera, mic, network). Student agrees to exam rules and marking terms (+4 / -1 penalty).

### Step 6: Exam Execution & Live Palette
* **Frontend Component**: `frontend/components/views/TestTakingView.tsx`
* **Database Source**: `database/questions.ts`
* **Flow**: Candidate answers questions with real-time palette feedback. Upon submission, modal checks answer completeness:
  - **All Answered**: Modal icon and button turn **emerald green** (`bg-emerald-500`).
  - **Unanswered Remaining**: Modal warns in **red** (`bg-red-500`).

### Step 7: Scorecard Evaluation & Answer Review
* **Frontend Component**: `frontend/components/views/EvaluatingView.tsx`
* **Backend Controller**: `backend/controllers/attemptController.ts` (`POST /api/submit-attempt`)
* **Flow**: Calculates overall score, accuracy %, and rank prediction. Provides detailed question explanations with NCERT references.
